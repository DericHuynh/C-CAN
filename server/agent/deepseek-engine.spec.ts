import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";

import {
  createDeepSeekEngine,
  DEEPSEEK_API_KEY_ENV,
  DEEPSEEK_BASE_URL,
  DEEPSEEK_CAPABILITIES,
  DEEPSEEK_DEFAULT_MODEL,
  DEEPSEEK_MAX_OUTPUT_TOKENS,
  DEEPSEEK_SUPPORTED_MODELS,
  resolveMaxOutputTokens,
} from "./deepseek-engine.js";
import type { EngineStreamOptions } from "@agent-native/core/agent/engine";

// Do not inherit developer credentials, or leak a test's env into another test.
beforeEach(() => vi.stubEnv(DEEPSEEK_API_KEY_ENV, undefined));
afterEach(() => vi.unstubAllEnvs());

// Helper to collect all events from an async iterable
async function collectEvents(iterable: AsyncIterable<any>) {
  const events: any[] = [];
  for await (const e of iterable) {
    events.push(e);
  }
  return events;
}

// ---------------------------------------------------------------------------
// SSE / fetch mocks
// ---------------------------------------------------------------------------

/** Response whose body is a web ReadableStream of DeepSeek SSE chunks. The
 * AI SDK provider reads `response.body.getReader()`, so a plain async
 * generator would not work here. */
function sseResponse(payloads: unknown[]): Response {
  const encoder = new TextEncoder();
  const chunks: string[] = [
    ...payloads.map((p) => `data: ${JSON.stringify(p)}\n\n`),
    "data: [DONE]\n\n",
  ];
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

function textChunk(content: string): unknown {
  return {
    choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }],
  };
}

function finishChunk(): unknown {
  return { choices: [{ index: 0, delta: {}, finish_reason: "stop" }] };
}

/** Run one stream() call against a canned SSE body and collect events. */
async function runStream(opts: EngineStreamOptions, payloads: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, _init: RequestInit) => sseResponse(payloads)),
  );
  try {
    return await collectEvents(createDeepSeekEngine({ apiKey: "test-key" }).stream(opts));
  } finally {
    vi.unstubAllGlobals();
  }
}

/**
 * Run one stream() call and return the request URL / parsed body / headers the
 * engine handed to fetch — used to assert wire-format details without
 * depending on the response content.
 */
async function captureRequest(
  opts: EngineStreamOptions,
  engineConfig: Record<string, unknown> = { apiKey: "test-key" },
): Promise<{ url: string; body: any; headers: Headers }> {
  const fetchSpy = vi.fn(async (_url: string, init: RequestInit) =>
    sseResponse([
      {
        choices: [{ index: 0, delta: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
      },
    ]),
  );
  vi.stubGlobal("fetch", fetchSpy);
  try {
    await collectEvents(createDeepSeekEngine(engineConfig).stream(opts));
  } finally {
    vi.unstubAllGlobals();
  }
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  const [url, init] = fetchSpy.mock.calls[0];
  return {
    url: String(url),
    body: JSON.parse(init.body as string),
    headers:
      init.headers instanceof Headers
        ? init.headers
        : new Headers(init.headers as Record<string, string>),
  };
}

function baseOpts(overrides: Partial<EngineStreamOptions> = {}): EngineStreamOptions {
  return {
    model: "deepseek-v4-flash",
    systemPrompt: "You are helpful.",
    messages: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
    tools: [],
    abortSignal: new AbortController().signal,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// createDeepSeekEngine — metadata
// ---------------------------------------------------------------------------

describe("createDeepSeekEngine", () => {
  it("exposes DeepSeek metadata on the engine", () => {
    const engine = createDeepSeekEngine({ apiKey: "test-key" });
    expect(engine.name).toBe("deepseek");
    expect(engine.label).toBe("DeepSeek");
    expect(engine.defaultModel).toBe(DEEPSEEK_DEFAULT_MODEL);
    expect(engine.supportedModels).toEqual(DEEPSEEK_SUPPORTED_MODELS);
    // The generic OpenAI capability table declares vision:true; DeepSeek's
    // current models are text-only, so the wrapper must pin the flag off.
    expect(engine.capabilities).toEqual(DEEPSEEK_CAPABILITIES);
    expect(engine.capabilities.vision).toBe(false);
    expect(engine.capabilities.thinking).toBe(true);
    // Custom base URL ⇒ provider-defined model ids pass through verbatim.
    expect(engine.preserveCustomModels).toBe(true);
  });

  it("fails closed with missing_credentials when no key is available", async () => {
    const engine = createDeepSeekEngine({});
    const events = await collectEvents(engine.stream(baseOpts()));
    const stop = events.find((e) => e.type === "stop");
    expect(stop).toBeDefined();
    expect(stop.reason).toBe("error");
    expect(stop.errorCode).toBe("missing_credentials");
  });
});

// ---------------------------------------------------------------------------
// resolveMaxOutputTokens
// ---------------------------------------------------------------------------

describe("resolveMaxOutputTokens", () => {
  it("clamps values above DeepSeek's 8192 ceiling", () => {
    expect(resolveMaxOutputTokens(32_000)).toBe(DEEPSEEK_MAX_OUTPUT_TOKENS);
    expect(resolveMaxOutputTokens(9_000)).toBe(DEEPSEEK_MAX_OUTPUT_TOKENS);
  });

  it("honors explicit values at or below the ceiling", () => {
    expect(resolveMaxOutputTokens(512)).toBe(512);
    expect(resolveMaxOutputTokens(8_192)).toBe(8_192);
  });

  it("falls back to the full ceiling for unset or invalid values", () => {
    expect(resolveMaxOutputTokens(undefined)).toBe(DEEPSEEK_MAX_OUTPUT_TOKENS);
    expect(resolveMaxOutputTokens(0)).toBe(DEEPSEEK_MAX_OUTPUT_TOKENS);
    expect(resolveMaxOutputTokens(-5)).toBe(DEEPSEEK_MAX_OUTPUT_TOKENS);
    expect(resolveMaxOutputTokens(Number.NaN)).toBe(DEEPSEEK_MAX_OUTPUT_TOKENS);
    expect(resolveMaxOutputTokens("lots" as unknown)).toBe(DEEPSEEK_MAX_OUTPUT_TOKENS);
  });
});

// ---------------------------------------------------------------------------
// Key handling — stored secret wins, deploy env is the gated shared default
// ---------------------------------------------------------------------------

describe("createDeepSeekEngine key handling", () => {
  const withEnvKey = async (value: string | undefined, fn: () => Promise<void>) => {
    vi.stubEnv(DEEPSEEK_API_KEY_ENV, value);
    await fn();
  };

  it("uses the deployment-level DEEPSEEK_API_KEY as the shared default", async () => {
    await withEnvKey("deploy-key", async () => {
      const { headers } = await captureRequest(baseOpts(), {});
      expect(headers.get("authorization")).toBe("Bearer deploy-key");
    });
  });

  it("lets a user's stored secret override the deployment env var", async () => {
    await withEnvKey("deploy-key", async () => {
      const { headers } = await captureRequest(baseOpts(), { apiKey: "user-key" });
      expect(headers.get("authorization")).toBe("Bearer user-key");
    });
  });

  it("blocks the deploy env fallback when allowEnvFallback is false", async () => {
    await withEnvKey("deploy-key", async () => {
      const engine = createDeepSeekEngine({ allowEnvFallback: false });
      const events = await collectEvents(engine.stream(baseOpts()));
      const stop = events.find((e) => e.type === "stop");
      expect(stop.errorCode).toBe("missing_credentials");
    });
  });
});

// ---------------------------------------------------------------------------
// Wire format — posts an OpenAI-compatible request to the DeepSeek endpoint
// ---------------------------------------------------------------------------

describe("createDeepSeekEngine wire format", () => {
  it("posts to the DeepSeek chat completions endpoint with Bearer auth", async () => {
    const { url, headers } = await captureRequest(baseOpts());
    expect(url).toBe(`${DEEPSEEK_BASE_URL}/chat/completions`);
    expect(headers.get("authorization")).toBe("Bearer test-key");
    expect(headers.get("content-type")).toContain("application/json");
  });

  it("sends the model id and OpenAI-compatible stream options", async () => {
    const { body } = await captureRequest(baseOpts());
    expect(body.model).toBe(DEEPSEEK_DEFAULT_MODEL);
    expect(body.stream).toBe(true);
    expect(body.stream_options).toEqual({ include_usage: true });
  });

  it("clamps max_tokens to DeepSeek's 8192 ceiling for the interactive-chat 32K default", async () => {
    const { body } = await captureRequest(baseOpts({ maxOutputTokens: 32_000 }));
    expect(body.max_tokens).toBe(DEEPSEEK_MAX_OUTPUT_TOKENS);
  });

  it("defaults max_tokens to the ceiling when the caller leaves it unset", async () => {
    const { body } = await captureRequest(baseOpts({ maxOutputTokens: undefined }));
    expect(body.max_tokens).toBe(DEEPSEEK_MAX_OUTPUT_TOKENS);
  });

  it("never sends top-level reasoning_effort (DeepSeek configures effort via its thinking object)", async () => {
    const { body } = await captureRequest(baseOpts());
    expect(body).not.toHaveProperty("reasoning_effort");
  });

  it("passes custom deepseek model ids through verbatim", async () => {
    const { body } = await captureRequest(baseOpts({ model: "deepseek-v4-pro" }));
    expect(body.model).toBe("deepseek-v4-pro");
  });

  it("serializes system + user messages for the DeepSeek surface", async () => {
    const { body } = await captureRequest(baseOpts());
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0]).toEqual({ role: "system", content: "You are helpful." });
    expect(body.messages[1]).toEqual({ role: "user", content: "Hi" });
  });

  it("serializes tools in the OpenAI function format without reasoning_effort", async () => {
    const { body } = await captureRequest(
      baseOpts({
        tools: [
          {
            name: "get_weather",
            description: "Get the weather",
            inputSchema: {
              type: "object",
              properties: { city: { type: "string" } },
              required: ["city"],
            },
          },
        ],
      }),
    );
    expect(body.tools).toHaveLength(1);
    expect(body.tools[0].type).toBe("function");
    expect(body.tools[0].function.name).toBe("get_weather");
    expect(body.tools[0].function.parameters.properties.city.type).toBe("string");
    // The OpenAI provider's reasoning_effort-with-tools workaround must stay
    // inert for DeepSeek: the field is only emitted for known OpenAI/Claude/
    // Gemini reasoning families, and deepseek models are not one of them.
    expect(body).not.toHaveProperty("reasoning_effort");
  });
});

// ---------------------------------------------------------------------------
// Stream behavior — events flow through the AI SDK engine
// ---------------------------------------------------------------------------

describe("createDeepSeekEngine stream", () => {
  it("emits text-delta events followed by assistant-content and a terminal stop", async () => {
    const events = await runStream(baseOpts(), [textChunk("Hel"), textChunk("lo"), finishChunk()]);
    const texts = events.filter((e) => e.type === "text-delta").map((e) => e.text);
    expect(texts.join("")).toBe("Hello");
    expect(events.some((e) => e.type === "assistant-content")).toBe(true);
    expect(events[events.length - 1]).toMatchObject({ type: "stop" });
  });

  it("emits a usage event from the include_usage chunk", async () => {
    const events = await runStream(baseOpts(), [
      textChunk("ok"),
      finishChunk(),
      {
        choices: [],
        usage: { prompt_tokens: 17, completion_tokens: 9, total_tokens: 26 },
      },
    ]);
    const usage = events.find((e) => e.type === "usage");
    expect(usage).toBeDefined();
    expect(usage.inputTokens).toBe(17);
    expect(usage.outputTokens).toBe(9);
    expect(usage.totalTokens).toBe(26);
  });

  it("tolerates DeepSeek's reasoning_content deltas (thinking mode) without crashing", async () => {
    const events = await runStream(baseOpts(), [
      {
        choices: [
          {
            index: 0,
            delta: { role: "assistant", reasoning_content: "thinking..." },
            finish_reason: null,
          },
        ],
      },
      textChunk("Answer"),
      finishChunk(),
    ]);
    const texts = events.filter((e) => e.type === "text-delta").map((e) => e.text);
    expect(texts.join("")).toBe("Answer");
    expect(events[events.length - 1]).toMatchObject({ type: "stop" });
  });
});
