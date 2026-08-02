import { describe, it, expect, vi, afterEach } from "vitest";

import {
  createDeepSeekEngine,
  DEEPSEEK_API_KEY_ENV,
  DEEPSEEK_BASE_URL,
  DEEPSEEK_CAPABILITIES,
  DEEPSEEK_DEFAULT_MODEL,
  DEEPSEEK_MAX_OUTPUT_TOKENS,
} from "./deepseek-engine.js";
import type { EngineStreamOptions } from "@agent-native/core/agent/engine";

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

function dataLine(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

const DONE = "data: [DONE]\n\n";

/** Response whose body is an async iterable of SSE text chunks. */
function streamResponse(lines: string[]): any {
  return {
    ok: true,
    status: 200,
    body: (async function* () {
      for (const line of lines) yield new TextEncoder().encode(line);
    })(),
  };
}

/** Run one stream() call against a canned SSE body and collect events. */
async function runStream(opts: EngineStreamOptions, lines: string[]) {
  vi.stubGlobal("fetch", vi.fn(async () => streamResponse(lines)));
  try {
    return await collectEvents(
      createDeepSeekEngine({ apiKey: "test" }).stream(opts),
    );
  } finally {
    vi.unstubAllGlobals();
  }
}

/**
 * Run one stream() call and return the request URL / parsed body / headers the
 * engine handed to fetch — used to assert wire-format details without
 * depending on the response content.
 */
async function captureRequest(opts: EngineStreamOptions): Promise<any> {
  const fetchSpy = vi.fn(async (_url: string, init: any) =>
    streamResponse([
      dataLine({
        choices: [
          {
            index: 0,
            delta: { role: "assistant", content: "ok" },
            finish_reason: "stop",
          },
        ],
      }),
      DONE,
    ]),
  );
  vi.stubGlobal("fetch", fetchSpy);
  try {
    await collectEvents(createDeepSeekEngine({ apiKey: "test" }).stream(opts));
  } finally {
    vi.unstubAllGlobals();
  }
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  const [url, init] = fetchSpy.mock.calls[0];
  return { url, body: JSON.parse(init.body), headers: init.headers };
}

function baseOpts(
  overrides: Partial<EngineStreamOptions> = {},
): EngineStreamOptions {
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
// createDeepSeekEngine
// ---------------------------------------------------------------------------

describe("createDeepSeekEngine", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("creates engine with correct metadata", () => {
    const engine = createDeepSeekEngine({ apiKey: "test-key" });
    expect(engine.name).toBe("deepseek");
    expect(engine.defaultModel).toBe(DEEPSEEK_DEFAULT_MODEL);
    expect(engine.defaultModel).toBe("deepseek-v4-flash");
    // deepseek-v4-flash is the only supported model — the picker's sole
    // selection and the fallback for any other id.
    expect(engine.supportedModels).toEqual(["deepseek-v4-flash"]);
    expect(engine.capabilities).toMatchObject(DEEPSEEK_CAPABILITIES);
  });

  it("stream emits text-delta events from SSE chunks", async () => {
    const events = await runStream(baseOpts(), [
      dataLine({
        choices: [
          {
            index: 0,
            delta: { role: "assistant", content: "Hello, " },
            finish_reason: null,
          },
        ],
      }),
      dataLine({
        choices: [{ index: 0, delta: { content: "world!" }, finish_reason: null }],
      }),
      dataLine({
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      }),
      DONE,
    ]);

    const texts = events
      .filter((e) => e.type === "text-delta")
      .map((e: any) => e.text)
      .join("");
    expect(texts).toBe("Hello, world!");

    const stopEvent = events.find((e) => e.type === "stop");
    expect(stopEvent?.reason).toBe("end_turn");

    const assistant = events.find((e) => e.type === "assistant-content");
    expect(assistant?.parts).toEqual([{ type: "text", text: "Hello, world!" }]);
  });

  it("surfaces reasoning_content deltas as thinking-delta events", async () => {
    const events = await runStream(baseOpts({ model: "deepseek-reasoner" }), [
      dataLine({
        choices: [
          {
            index: 0,
            delta: { role: "assistant", reasoning_content: "Let me think" },
            finish_reason: null,
          },
        ],
      }),
      dataLine({
        choices: [
          { index: 0, delta: { reasoning_content: " carefully" }, finish_reason: null },
        ],
      }),
      dataLine({
        choices: [{ index: 0, delta: { content: "Answer." }, finish_reason: null }],
      }),
      dataLine({
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      }),
      DONE,
    ]);

    const thinking = events
      .filter((e) => e.type === "thinking-delta")
      .map((e: any) => e.text)
      .join("");
    expect(thinking).toBe("Let me think carefully");

    const assistant = events.find((e) => e.type === "assistant-content");
    expect(assistant?.parts).toContainEqual({
      type: "thinking",
      text: "Let me think carefully",
    });
    expect(assistant?.parts).toContainEqual({ type: "text", text: "Answer." });
  });

  it("emits a usage event from the final include_usage chunk", async () => {
    const events = await runStream(baseOpts(), [
      dataLine({
        choices: [{ index: 0, delta: { role: "assistant", content: "Hi" }, finish_reason: null }],
      }),
      dataLine({
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      }),
      dataLine({
        choices: [],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 7,
          total_tokens: 22,
          completion_tokens_details: { reasoning_tokens: 3 },
        },
      }),
      DONE,
    ]);

    const usage = events.find((e) => e.type === "usage");
    expect(usage).toEqual({
      type: "usage",
      inputTokens: 15,
      outputTokens: 7,
      totalTokens: 22,
      reasoningTokens: 3,
    });
  });

  it("posts an OpenAI-compatible chat request to the DeepSeek endpoint", async () => {
    const { url, body, headers } = await captureRequest(
      baseOpts({
        messages: [
          { role: "user", content: [{ type: "text", text: "Hi" }] },
          {
            role: "assistant",
            content: [
              { type: "text", text: "Let me look." },
              {
                type: "tool-call",
                id: "call_1",
                name: "get_weather",
                input: { city: "SF" },
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "tool-result",
                toolCallId: "call_1",
                toolName: "get_weather",
                toolInput: "{}",
                content: "72F",
              },
              { type: "text", text: "Thanks" },
            ],
          },
        ],
        tools: [
          {
            name: "get_weather",
            description: "Get weather",
            inputSchema: {
              type: "object",
              properties: { city: { type: "string" } },
            },
          },
        ],
        temperature: 0.7,
      }),
    );

    expect(url).toBe(`${DEEPSEEK_BASE_URL}/chat/completions`);
    expect(headers.Authorization).toBe("Bearer test");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.Accept).toBe("text/event-stream");

    expect(body.model).toBe("deepseek-v4-flash");
    expect(body.stream).toBe(true);
    expect(body.stream_options).toEqual({ include_usage: true });
    expect(body.temperature).toBe(0.7);
    // The system prompt rides as the leading system message.
    expect(body.messages[0]).toEqual({
      role: "system",
      content: "You are helpful.",
    });
    // Tool results become their own `tool` messages; tool calls render as
    // OpenAI `tool_calls` with JSON-string arguments.
    expect(body.messages).toContainEqual({ role: "user", content: "Hi" });
    expect(body.messages).toContainEqual({
      role: "assistant",
      content: "Let me look.",
      tool_calls: [
        {
          id: "call_1",
          type: "function",
          function: { name: "get_weather", arguments: '{"city":"SF"}' },
        },
      ],
    });
    expect(body.messages).toContainEqual({
      role: "tool",
      tool_call_id: "call_1",
      content: "72F",
    });
    expect(body.tools).toEqual([
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get weather",
          parameters: {
            type: "object",
            properties: { city: { type: "string" } },
          },
        },
      },
    ]);
  });

  it("clamps max_tokens to the DeepSeek 8192 ceiling", async () => {
    // The interactive-chat 32K default must not become a provider 400.
    const high = await captureRequest(baseOpts({ maxOutputTokens: 64_000 }));
    expect(high.body.max_tokens).toBe(DEEPSEEK_MAX_OUTPUT_TOKENS);

    // Small explicit caps are honored as-is.
    const small = await captureRequest(baseOpts({ maxOutputTokens: 512 }));
    expect(small.body.max_tokens).toBe(512);

    // Unset falls back to the full ceiling.
    const none = await captureRequest(baseOpts());
    expect(none.body.max_tokens).toBe(DEEPSEEK_MAX_OUTPUT_TOKENS);
  });

  it("defaults to medium reasoning effort for deepseek-v4-flash", async () => {
    const { body } = await captureRequest(baseOpts());
    expect(body.reasoning_effort).toBe("medium");
  });

  it("uses explicit reasoning effort when provided", async () => {
    const { body } = await captureRequest(
      baseOpts({ reasoningEffort: "high" }),
    );
    expect(body.reasoning_effort).toBe("high");
  });

  it("maps xhigh/max effort down to DeepSeek's high tier", async () => {
    const { body } = await captureRequest(baseOpts({ reasoningEffort: "max" }));
    expect(body.reasoning_effort).toBe("high");
  });

  it("omits reasoning_effort when effort is explicitly none", async () => {
    const { body } = await captureRequest(baseOpts({ reasoningEffort: "none" }));
    expect(body.reasoning_effort).toBeUndefined();
  });

  it("omits reasoning_effort for a non-reasoning model", async () => {
    const { body } = await captureRequest(baseOpts({ model: "deepseek-chat" }));
    expect(body.reasoning_effort).toBeUndefined();
  });

  it("stream emits stop with error when API key is missing", async () => {
    const engine = createDeepSeekEngine({});
    const events = await collectEvents(engine.stream(baseOpts()));
    const stopEvent = events.find((e) => e.type === "stop");
    expect(stopEvent?.reason).toBe("error");
    expect(stopEvent?.error).toContain("Settings → Secrets");
    // Never leaks the raw key name into the message.
    expect(stopEvent?.error).not.toContain(DEEPSEEK_API_KEY_ENV);
    expect(stopEvent?.errorCode).toBe("missing_credentials");
  });

  it("does not use deploy-level DeepSeek keys", async () => {
    vi.stubEnv(DEEPSEEK_API_KEY_ENV, "sk-deploy");
    const engine = createDeepSeekEngine({});
    const events = await collectEvents(engine.stream(baseOpts()));
    const stopEvent = events.find((e) => e.type === "stop");
    expect(stopEvent?.reason).toBe("error");
    expect(stopEvent?.errorCode).toBe("missing_credentials");
  });

  it.each([429, 503])(
    "tags upstream %i backpressure with a structured status",
    async (status) => {
      const mockFetch = vi.fn(async () => ({
        ok: false,
        status,
        json: async () => ({ error: { message: "Rate limit exceeded" } }),
      }));
      vi.stubGlobal("fetch", mockFetch);
      try {
        // The engine yields the terminal stop event and then rethrows, so
        // collect events defensively.
        const events: any[] = [];
        await expect(async () => {
          for await (const e of createDeepSeekEngine({ apiKey: "test" }).stream(
            baseOpts(),
          ))
            events.push(e);
        }).rejects.toThrow();

        const stopEvent = events.find((e) => e.type === "stop");
        expect(stopEvent?.reason).toBe("error");
        expect(stopEvent?.error).toContain("Rate limit exceeded");
        expect(stopEvent?.errorCode).toBe(`http_${status}`);
        expect(stopEvent?.statusCode).toBe(status);
      } finally {
        vi.unstubAllGlobals();
      }
    },
  );

  it("reports a 401 as a structured http_401 stop error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: "Authentication Fails" } }),
      })),
    );
    try {
      const events: any[] = [];
      await expect(async () => {
        for await (const e of createDeepSeekEngine({ apiKey: "test" }).stream(
          baseOpts(),
        ))
          events.push(e);
      }).rejects.toThrow();

      const stopEvent = events.find((e) => e.type === "stop");
      expect(stopEvent?.reason).toBe("error");
      expect(stopEvent?.error).toContain("Authentication Fails");
      expect(stopEvent?.errorCode).toBe("http_401");
      expect(stopEvent?.statusCode).toBe(401);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("falls back to the status line when the error body is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 429,
        json: async () => {
          throw new Error("no body");
        },
      })),
    );
    try {
      const events: any[] = [];
      await expect(async () => {
        for await (const e of createDeepSeekEngine({ apiKey: "test" }).stream(
          baseOpts(),
        ))
          events.push(e);
      }).rejects.toThrow();

      const stopEvent = events.find((e) => e.type === "stop");
      expect(stopEvent?.error).toContain("HTTP 429");
      expect(stopEvent?.errorCode).toBe("http_429");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("tags fetch connection failures as provider_network_error", async () => {
    const socket = Object.assign(new Error("other side closed"), {
      code: "UND_ERR_SOCKET",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw Object.assign(new Error("fetch failed"), { cause: socket });
      }),
    );
    try {
      const events: any[] = [];
      await expect(async () => {
        for await (const e of createDeepSeekEngine({ apiKey: "test" }).stream(
          baseOpts(),
        ))
          events.push(e);
      }).rejects.toThrow("fetch failed");

      const stopEvent = events.find((e) => e.type === "stop");
      expect(stopEvent?.reason).toBe("error");
      // The cause chain survives into the recorded message so the real
      // transport failure is diagnosable after the fact.
      expect(stopEvent?.error).toBe(
        "fetch failed (cause: UND_ERR_SOCKET other side closed)",
      );
      expect(stopEvent?.errorCode).toBe("provider_network_error");
      expect(stopEvent?.providerRetryable).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// ---------------------------------------------------------------------------
// First-event deadline
// ---------------------------------------------------------------------------

describe("createDeepSeekEngine first-event deadline", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("aborts with a retryable network error when the stream produces no data within 120s", async () => {
    let capturedSignal: AbortSignal | undefined;
    const mockFetch = vi.fn(async (_url: string, init: any) => {
      capturedSignal = init?.signal;
      return {
        ok: true,
        status: 200,
        body: (async function* () {
          await new Promise((_resolve, reject) => {
            if (capturedSignal?.aborted) {
              reject(capturedSignal.reason ?? new Error("aborted"));
              return;
            }
            capturedSignal?.addEventListener(
              "abort",
              () => reject(capturedSignal!.reason ?? new Error("aborted")),
              { once: true },
            );
          });
        })(),
      };
    });
    vi.stubGlobal("fetch", mockFetch);
    vi.useFakeTimers();

    const events: any[] = [];
    let settledEarly = false;
    const runPromise = (async () => {
      for await (const e of createDeepSeekEngine({ apiKey: "test" }).stream(
        baseOpts(),
      ))
        events.push(e);
    })();
    void runPromise
      .catch(() => {})
      .then(() => {
        settledEarly = true;
      });

    await vi.advanceTimersByTimeAsync(119_000);
    expect(settledEarly).toBe(false);

    await vi.advanceTimersByTimeAsync(1_000);
    await expect(runPromise).rejects.toThrow();

    const stop = events.find((e) => e.type === "stop");
    expect(stop?.reason).toBe("error");
    expect(stop?.errorCode).toBe("provider_network_error");
    expect(stop?.providerRetryable).toBe(true);
    expect(stop?.error).toContain("120s");
  });

  it("does not abort once the stream has produced a data line", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        streamResponse([
          dataLine({
            choices: [
              {
                index: 0,
                delta: { role: "assistant", content: "Hello" },
                finish_reason: null,
              },
            ],
          }),
          dataLine({
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          }),
          DONE,
        ]),
      ),
    );

    const events = await collectEvents(
      createDeepSeekEngine({ apiKey: "test" }).stream(baseOpts()),
    );

    const stop = events.find((e) => e.type === "stop");
    expect(stop?.reason).toBe("end_turn");
    expect(stop?.errorCode).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Streamed tool-input reconciliation
// ---------------------------------------------------------------------------

describe("createDeepSeekEngine streamed tool-input reconciliation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function runToolInputStream(
    argsDeltas: string[],
    finishReason = "tool_calls",
  ) {
    const lines: string[] = [
      dataLine({
        choices: [
          {
            index: 0,
            delta: { role: "assistant", content: "" },
            finish_reason: null,
          },
        ],
      }),
      dataLine({
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "call_01",
                  type: "function",
                  function: { name: "create_document", arguments: "" },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      }),
      ...argsDeltas.map((args) =>
        dataLine({
          choices: [
            {
              index: 0,
              delta: { tool_calls: [{ index: 0, function: { arguments: args } }] },
              finish_reason: null,
            },
          ],
        }),
      ),
      dataLine({
        choices: [{ index: 0, delta: {}, finish_reason: finishReason }],
      }),
      DONE,
    ];
    return runStream(baseOpts(), lines);
  }

  it("assembles a tool call from multiple argument deltas", async () => {
    const events = await runToolInputStream(['{"title":"Q', '3 plan"', "}"]);

    expect(events.find((e) => e.type === "tool-call")).toEqual({
      type: "tool-call",
      id: "call_01",
      name: "create_document",
      input: { title: "Q3 plan" },
    });
    expect(
      events.find((e) => e.type === "assistant-content")?.parts,
    ).toContainEqual({
      type: "tool-call",
      id: "call_01",
      name: "create_document",
      input: { title: "Q3 plan" },
    });
    expect(events.find((e) => e.type === "stop")?.reason).toBe("tool_use");
  });

  it("yields tool-input progress events carrying the call id and name", async () => {
    const events = await runToolInputStream(['{"a":', "1}"]);

    const start = events.find((e) => e.type === "tool-input-start");
    expect(start).toEqual({
      type: "tool-input-start",
      id: "call_01",
      name: "create_document",
    });

    const deltas = events.filter((e) => e.type === "tool-input-delta");
    expect(deltas.map((e: any) => e.text).join("")).toBe('{"a":1}');
    expect(
      deltas.every((e: any) => e.id === "call_01" && e.name === "create_document"),
    ).toBe(true);
  });

  it("reports a tool call truncated mid-arguments as an in-band tool-call error", async () => {
    const events = await runToolInputStream(['{"title":"Q']);

    expect(events.find((e) => e.type === "tool-call-error")).toMatchObject({
      id: "call_01",
      name: "create_document",
      input: '{"title":"Q',
    });
    expect(events.some((e) => e.type === "tool-call")).toBe(false);
  });
});
