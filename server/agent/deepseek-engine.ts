/**
 * DeepSeekEngine — wraps the DeepSeek OpenAI-compatible Chat Completions API
 * (`https://api.deepseek.com`) for use as an AgentEngine.
 *
 * DeepSeek exposes an OpenAI-compatible HTTP API, so unlike the framework's
 * AI-SDK wrapper this engine talks to it directly (fetch + SSE) and owns its
 * own message/tool translation and error classification instead of inheriting
 * the OpenAI provider's GPT-specific assumptions (Responses-vs-ChatCompletions
 * routing, the `reasoning_effort`-with-tools rejection workaround, GPT model
 * catalogs). It is this app's BYOK engine: the key comes exclusively from the
 * caller's stored secret via `config.apiKey` — never from the environment.
 *
 * Model-specific behavior:
 *  - `deepseek-reasoner` (and reasoning-capable `deepseek-v4*` models) stream
 *    chain-of-thought via `delta.reasoning_content`, surfaced here as
 *    `thinking-delta` events. `reasoning_effort` (low/medium/high) is
 *    forwarded when a tier is requested; the provider's medium default applies
 *    when none is (matching the framework's own default effort).
 *  - Output is capped at DeepSeek's documented 8192-token maximum no matter
 *    what the caller asks for, so the interactive-chat 32K default can never
 *    turn into a provider 400.
 *  - Tool calls stream through the standard OpenAI `delta.tool_calls`
 *    protocol. Announced calls whose arguments are cut off at stream end are
 *    reported in-band as `tool-call-error` instead of vanishing, so the turn
 *    never claims an action it did not run.
 *
 * Errors are tagged the same way the framework engines tag them: HTTP
 * failures carry `http_<status>` / `statusCode`, transport failures carry
 * `provider_network_error` with `providerRetryable: true`, and a missing key
 * fails closed with `missing_credentials` — so run-level retries, run-level
 * resume, and the settings UI all classify this engine correctly.
 */

import type {
  AgentEngine,
  EngineCapabilities,
  EngineContentPart,
  EngineEvent,
  EngineMessage,
  EngineStreamOptions,
  EngineTool,
} from "@agent-native/core/agent/engine";

export const DEEPSEEK_API_KEY_ENV = "DEEPSEEK_API_KEY";
export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
export const DEEPSEEK_DEFAULT_MODEL = "deepseek-v4-flash";
export const DEEPSEEK_SUPPORTED_MODELS = ["deepseek-v4-flash"] as const;

/**
 * DeepSeek's documented max-output ceiling (8K) for both chat and reasoning
 * models. Requests above it are rejected with a 400, so the engine clamps
 * here rather than trusting caller-supplied ceilings.
 */
export const DEEPSEEK_MAX_OUTPUT_TOKENS = 8192;

/** Same "first stream event" deadline the framework engines use. */
const FIRST_STREAM_EVENT_TIMEOUT_MS = 120_000;

export const DEEPSEEK_CAPABILITIES: EngineCapabilities = {
  // deepseek-reasoner (and reasoning-capable deepseek-v4* models) expose
  // chain-of-thought "thinking" through the OpenAI-compatible reasoning path.
  thinking: true,
  promptCaching: false,
  vision: false,
  computerUse: false,
  parallelToolCalls: true,
};

const TRUNCATED_TOOL_INPUT_ERROR =
  "The arguments never finished streaming, so this call was not executed and nothing changed. Call the tool again with complete arguments.";

/** Models that accept `reasoning_effort` and emit `reasoning_content`. */
const DEEPSEEK_REASONING_MODEL_PREFIXES = ["deepseek-reasoner", "deepseek-v"];

function isDeepSeekReasoningModel(model: string): boolean {
  const id = model.toLowerCase();
  return (
    DEEPSEEK_REASONING_MODEL_PREFIXES.some((prefix) => id.startsWith(prefix)) ||
    id.includes("deepseek-reasoner")
  );
}

/** Map the shared effort ladder onto DeepSeek's low/medium/high tiers. */
const DEEPSEEK_EFFORT_TIERS: Record<string, string | undefined> = {
  minimal: "low",
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: "high",
  max: "high",
};

function resolveReasoningEffort(
  model: string,
  effort: string | undefined,
): string | undefined {
  if (!isDeepSeekReasoningModel(model)) return undefined;
  // The provider's default is medium, and so is the framework's default
  // effort — an unset/auto tier maps to the same value the API would pick
  // anyway, made explicit so the request is deterministic.
  if (!effort || effort === "auto") return "medium";
  if (effort === "none") return undefined;
  return DEEPSEEK_EFFORT_TIERS[effort];
}

/**
 * Clamp the requested max output to DeepSeek's 8192 ceiling. A positive
 * explicit value is honored up to the ceiling; anything else (unset, invalid)
 * falls back to the full 8192 so reasoning-heavy turns keep headroom.
 */
export function resolveMaxOutputTokens(explicit: unknown): number {
  if (
    typeof explicit === "number" &&
    Number.isFinite(explicit) &&
    explicit > 0
  ) {
    return Math.min(Math.floor(explicit), DEEPSEEK_MAX_OUTPUT_TOKENS);
  }
  return DEEPSEEK_MAX_OUTPUT_TOKENS;
}

// ---------------------------------------------------------------------------
// Engine → OpenAI wire format
// ---------------------------------------------------------------------------

function engineToolsToDeepSeek(tools: EngineTool[]): unknown[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

function engineMessagesToDeepSeek(messages: EngineMessage[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const msg of messages) {
    if (msg.role === "user") {
      // OpenAI requires tool results as their own `tool` messages, so split
      // them out of the user turn (mirrors the AI-SDK translator's order:
      // tool results first, then the remaining user text).
      for (const result of msg.content) {
        if (result.type !== "tool-result") continue;
        out.push({
          role: "tool",
          tool_call_id: result.toolCallId,
          content: result.content,
        });
      }
      const text = textFromParts(msg.content);
      if (text) out.push({ role: "user", content: text });
    } else {
      const assistant: Record<string, unknown> = { role: "assistant" };
      const text = textFromParts(msg.content);
      if (text) assistant.content = text;
      const toolCalls = msg.content
        .filter((part) => part.type === "tool-call")
        .map((part) => ({
          id: part.id,
          type: "function",
          function: {
            name: part.name,
            arguments: JSON.stringify(part.input ?? {}),
          },
        }));
      if (toolCalls.length > 0) assistant.tool_calls = toolCalls;
      // DeepSeek rejects assistant turns with neither content nor tool_calls
      // (HTTP 400 "content or tool_calls must be set"). A reasoning-only turn
      // — no text, no tool call, just chain-of-thought — must still send
      // content, so fall back to the thinking text instead of an empty
      // assistant message. A fully-empty turn is dropped entirely.
      if (assistant.content === undefined && toolCalls.length === 0) {
        const thinking = msg.content
          .filter((part) => part.type === "thinking")
          .map((part) => part.text)
          .join("");
        if (thinking) assistant.content = thinking;
      }
      if (assistant.content !== undefined || assistant.tool_calls !== undefined) {
        out.push(assistant);
      }
    }
  }
  return out;
}

/**
 * Text for a message turn. DeepSeek has no vision, so image parts are dropped
 * (the tool-dispatch loop already appends `[image: …]` notes to result text);
 * file parts degrade to a placeholder so the model still knows they existed.
 * Thinking parts are not echoed back — DeepSeek rejects them on resend.
 */
function textFromParts(parts: EngineContentPart[]): string {
  return parts
    .filter((part) => part.type === "text" || part.type === "file")
    .map((part) =>
      part.type === "text"
        ? part.text
        : `[Attached file: ${part.filename ?? "attachment"} (${part.mediaType})]`,
    )
    .join("");
}

function buildRequestBody(opts: EngineStreamOptions): Record<string, unknown> {
  const messages = engineMessagesToDeepSeek(opts.messages);
  if (opts.systemPrompt) {
    messages.unshift({ role: "system", content: opts.systemPrompt });
  }
  // Final safety net: DeepSeek hard-rejects (HTTP 400) any assistant message
  // with neither content nor tool_calls. The translator already repairs
  // thinking-only turns and drops empty ones, but this pass guarantees no
  // malformed assistant message can ever reach the wire, whatever shape the
  // framework handed us (e.g. whitespace-only content).
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    const hasToolCalls = Array.isArray(message.tool_calls) && message.tool_calls.length > 0;
    if (hasToolCalls) continue;
    const content = typeof message.content === "string" ? message.content.trim() : "";
    if (content) {
      message.content = content;
      continue;
    }
    // Nothing to salvage — drop the empty assistant turn entirely.
    messages.splice(messages.indexOf(message), 1);
  }
  const body: Record<string, unknown> = {
    model: opts.model,
    messages,
    max_tokens: resolveMaxOutputTokens(opts.maxOutputTokens),
    stream: true,
    stream_options: { include_usage: true },
  };
  if (opts.tools.length > 0) {
    body.tools = engineToolsToDeepSeek(opts.tools);
  }
  if (opts.temperature !== undefined) {
    body.temperature = opts.temperature;
  }
  const reasoningEffort = resolveReasoningEffort(
    opts.model,
    opts.reasoningEffort,
  );
  if (reasoningEffort) body.reasoning_effort = reasoningEffort;
  return body;
}

// ---------------------------------------------------------------------------
// SSE parsing
// ---------------------------------------------------------------------------

async function* sseDataLines(
  body: AsyncIterable<Uint8Array>,
): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const raw of body) {
    buffer += decoder.decode(raw, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      const data = sseLineData(line);
      if (data !== undefined) yield data;
    }
  }
  const tail = sseLineData(buffer.trimEnd());
  if (tail !== undefined) yield tail;
}

function sseLineData(line: string): string | undefined {
  // Skip blank lines, ":" comments (keepalives), and the terminal marker.
  if (!line.startsWith("data:")) return undefined;
  const data = line.slice("data:".length).trim();
  if (!data || data === "[DONE]") return undefined;
  return data;
}

// ---------------------------------------------------------------------------
// Error helpers (mirror the framework engine helpers, which are not exported)
// ---------------------------------------------------------------------------

function describeErrorWithCauses(err: unknown, maxLinks = 4): string {
  const head =
    err instanceof Error ? err.message : String(err ?? "Unknown error");
  const links: string[] = [];
  const seen = new Set<unknown>([err]);
  let cause: unknown = (err as { cause?: unknown } | null)?.cause;
  while (cause !== undefined && cause !== null && links.length < maxLinks) {
    if (seen.has(cause)) break;
    seen.add(cause);
    const code = (cause as { code?: unknown }).code;
    const message = cause instanceof Error ? cause.message : String(cause);
    const text = (typeof code === "string" ? `${code} ${message}` : message)
      .trim()
      .slice(0, 200);
    if (text) links.push(text);
    cause = (cause as { cause?: unknown }).cause;
  }
  return links.length > 0 ? `${head} (cause: ${links.join(" <- ")})` : head;
}

function isConnectionErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("connection error") ||
    normalized.includes("cannot connect to api") ||
    normalized.includes("fetch failed") ||
    normalized.includes("econnreset") ||
    normalized.includes("econnrefused") ||
    normalized.includes("und_err_socket") ||
    normalized.includes("socket hang up") ||
    normalized.includes("other side closed") ||
    normalized.includes("ssl") ||
    normalized.includes("tls")
  );
}

/**
 * Extract a user-facing message from a non-2xx response. DeepSeek errors are
 * `{"error": {"message": …}}`; fall back to the status line for empty/HTML
 * bodies so a bare rate limit never shows up as "undefined".
 */
async function describeHttpError(res: Response): Promise<string> {
  let message = "";
  try {
    const parsed = await res.json();
    message =
      typeof parsed?.error?.message === "string"
        ? parsed.error.message
        : typeof parsed?.message === "string"
          ? parsed.message
          : "";
  } catch {
    // Non-JSON error body — fall back to the status line below.
  }
  const statusText = res.statusText ? ` ${res.statusText}` : "";
  return message
    ? `${message} (HTTP ${res.status})`
    : `DeepSeek API error: HTTP ${res.status}${statusText}`;
}

/**
 * Layer a first-event deadline on top of the caller's AbortSignal: abort the
 * request if no stream data arrives within `FIRST_STREAM_EVENT_TIMEOUT_MS`.
 * A connection that streams zero events is wedged, not slow — bounding this
 * separately turns a silent multi-minute hang into a fast abort-and-retry.
 */
interface FirstEventAbortController {
  readonly signal: AbortSignal;
  /** Idempotent. Call once the first real stream data line arrives. */
  markFirstEvent: () => void;
  didTimeout: () => boolean;
  cleanup: () => void;
}

function createFirstEventAbortController(
  parentSignal: AbortSignal,
): FirstEventAbortController {
  const controller = new AbortController();
  let timedOut = false;
  let firstEventSeen = false;

  const abortFromParent = () => {
    if (!controller.signal.aborted) controller.abort(parentSignal.reason);
  };

  const timeout = setTimeout(() => {
    timedOut = true;
    if (!controller.signal.aborted) {
      controller.abort(
        new Error(
          `Model request produced no stream events within ${FIRST_STREAM_EVENT_TIMEOUT_MS / 1000}s`,
        ),
      );
    }
  }, FIRST_STREAM_EVENT_TIMEOUT_MS);

  if (parentSignal.aborted) abortFromParent();
  parentSignal.addEventListener("abort", abortFromParent, { once: true });

  return {
    signal: controller.signal,
    markFirstEvent: () => {
      if (firstEventSeen) return;
      firstEventSeen = true;
      clearTimeout(timeout);
    },
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timeout);
      parentSignal.removeEventListener("abort", abortFromParent);
    },
  };
}

// ---------------------------------------------------------------------------
// DeepSeekEngine
// ---------------------------------------------------------------------------

class DeepSeekEngine implements AgentEngine {
  readonly name = "deepseek";
  readonly label = "DeepSeek";
  readonly defaultModel = DEEPSEEK_DEFAULT_MODEL;
  readonly supportedModels = DEEPSEEK_SUPPORTED_MODELS;
  readonly capabilities = DEEPSEEK_CAPABILITIES;

  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl: string = DEEPSEEK_BASE_URL) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async *stream(opts: EngineStreamOptions): AsyncIterable<EngineEvent> {
    const requestBody = buildRequestBody(opts);
    const firstEventAbort = createFirstEventAbortController(opts.abortSignal);

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "text/event-stream",
        },
        body: JSON.stringify(requestBody),
        signal: firstEventAbort.signal,
      });
    } catch (err: any) {
      const timedOut = firstEventAbort.didTimeout();
      const rawMessage: string = err?.message ?? String(err);
      const errorMessage = timedOut
        ? `Model request produced no stream events within ${FIRST_STREAM_EVENT_TIMEOUT_MS / 1000}s; the connection appears wedged.`
        : describeErrorWithCauses(err);
      // A fetch rejection with no HTTP status is a transport failure: tag it
      // so run-level retries treat it as a transient blip, never a hard stop.
      const isConnectionError =
        !timedOut && isConnectionErrorMessage(rawMessage);
      yield {
        type: "stop",
        reason: "error",
        error: errorMessage,
        ...(isConnectionError || timedOut
          ? { errorCode: "provider_network_error", providerRetryable: true }
          : {}),
      };
      throw err;
    }

    if (!res.ok) {
      const errorMessage = await describeHttpError(res);
      const error = new Error(errorMessage) as Error & {
        statusCode?: number;
        status?: number;
        errorCode?: string;
      };
      error.statusCode = res.status;
      error.status = res.status;
      error.errorCode = `http_${res.status}`;
      yield {
        type: "stop",
        reason: "error",
        error: errorMessage,
        errorCode: `http_${res.status}`,
        statusCode: res.status,
      };
      throw error;
    }

    try {
      let fullText = "";
      let reasoningText = "";
      let finishReason: string | null = null;
      let usage: Record<string, unknown> | null = null;
      const toolCallsByIndex = new Map<
        number,
        { id?: string; name?: string; arguments: string }
      >();
      const startedIndices = new Set<number>();

      for await (const data of sseDataLines(
        res.body as unknown as AsyncIterable<Uint8Array>,
      )) {
        // The first data line proves the provider is actually streaming.
        firstEventAbort.markFirstEvent();

        let chunk: any;
        try {
          chunk = JSON.parse(data);
        } catch {
          continue;
        }
        const choice = chunk?.choices?.[0];
        const delta = choice?.delta;

        if (
          typeof delta?.reasoning_content === "string" &&
          delta.reasoning_content
        ) {
          reasoningText += delta.reasoning_content;
          yield { type: "thinking-delta", text: delta.reasoning_content };
        }
        if (typeof delta?.content === "string" && delta.content) {
          fullText += delta.content;
          yield { type: "text-delta", text: delta.content };
        }
        if (Array.isArray(delta?.tool_calls)) {
          for (const toolCall of delta.tool_calls) {
            const index = typeof toolCall?.index === "number" ? toolCall.index : 0;
            let entry = toolCallsByIndex.get(index);
            if (!entry) {
              entry = { arguments: "" };
              toolCallsByIndex.set(index, entry);
            }
            if (typeof toolCall?.id === "string") entry.id = toolCall.id;
            if (typeof toolCall?.function?.name === "string") {
              entry.name = toolCall.function.name;
            }
            if (typeof toolCall?.function?.arguments === "string") {
              entry.arguments += toolCall.function.arguments;
            }
            // First delta for this call carries id + name; surface the
            // progress signal exactly once, then stream argument fragments.
            if (!startedIndices.has(index)) {
              startedIndices.add(index);
              yield {
                type: "tool-input-start",
                ...(entry.id ? { id: entry.id } : {}),
                ...(entry.name ? { name: entry.name } : {}),
              };
            }
            if (
              typeof toolCall?.function?.arguments === "string" &&
              toolCall.function.arguments
            ) {
              yield {
                type: "tool-input-delta",
                ...(entry.id ? { id: entry.id } : {}),
                ...(entry.name ? { name: entry.name } : {}),
                text: toolCall.function.arguments,
              };
            }
          }
        }
        if (typeof choice?.finish_reason === "string") {
          finishReason = choice.finish_reason;
        }
        if (chunk?.usage) usage = chunk.usage;
      }

      // Assemble the assistant turn from everything the stream delivered.
      // Thinking first, then text — the same order the stream produced them,
      // so the persisted message matches the live preview. (A text-first
      // assembly made the answer jump above the "Thought" cell on completion
      // and the message re-render look like the text was overwriting itself.)
      const assistantParts: EngineContentPart[] = [];
      if (reasoningText) {
        assistantParts.push({ type: "thinking", text: reasoningText });
      }
      if (fullText) assistantParts.push({ type: "text", text: fullText });

      // A tool call the stream announced but never finished must not vanish:
      // recover it from its deltas when the JSON parses, or report it in-band
      // so the model can retry instead of the turn claiming an action it never
      // ran (mirrors the framework's finalizeStreamedToolInputs).
      const deliveredIds = new Set<string>();
      for (const entry of toolCallsByIndex.values()) {
        if (!entry.id) continue;
        const input = parseToolArguments(entry.arguments);
        if (input !== undefined) {
          deliveredIds.add(entry.id);
          assistantParts.push({
            type: "tool-call",
            id: entry.id,
            name: entry.name ?? "unknown-tool",
            input,
          });
          yield {
            type: "tool-call",
            id: entry.id,
            name: entry.name ?? "unknown-tool",
            input,
          };
        }
      }
      for (const entry of toolCallsByIndex.values()) {
        if (!entry.id || deliveredIds.has(entry.id)) continue;
        yield {
          type: "tool-call-error",
          id: entry.id,
          name: entry.name || "unknown-tool",
          input: entry.arguments,
          error: TRUNCATED_TOOL_INPUT_ERROR,
        };
      }

      if (usage) {
        yield {
          type: "usage",
          inputTokens: (usage.prompt_tokens as number | undefined) ?? 0,
          outputTokens: (usage.completion_tokens as number | undefined) ?? 0,
          totalTokens:
            typeof usage.total_tokens === "number"
              ? usage.total_tokens
              : ((usage.prompt_tokens as number | undefined) ?? 0) +
                ((usage.completion_tokens as number | undefined) ?? 0),
          reasoningTokens: (usage as any).completion_tokens_details
            ?.reasoning_tokens,
        };
      }

      yield { type: "assistant-content", parts: assistantParts };
      yield { type: "stop", reason: stopReasonFromFinishReason(finishReason) };
    } catch (err: any) {
      const timedOut = firstEventAbort.didTimeout();
      const rawMessage: string = err?.message ?? String(err);
      const errorMessage = timedOut
        ? `Model request produced no stream events within ${FIRST_STREAM_EVENT_TIMEOUT_MS / 1000}s; the connection appears wedged.`
        : describeErrorWithCauses(err);
      const isConnectionError =
        !timedOut && isConnectionErrorMessage(rawMessage);
      yield {
        type: "stop",
        reason: "error",
        error: errorMessage,
        ...(isConnectionError || timedOut
          ? { errorCode: "provider_network_error", providerRetryable: true }
          : {}),
      };
      throw err;
    } finally {
      firstEventAbort.cleanup();
    }
  }
}

function stopReasonFromFinishReason(
  finishReason: string | null | undefined,
): "end_turn" | "tool_use" | "max_tokens" | "stop_sequence" | "error" {
  switch (finishReason) {
    case "tool_calls":
      return "tool_use";
    case "length":
      return "max_tokens";
    default:
      return "end_turn";
  }
}

function parseToolArguments(
  text: string,
): Record<string, unknown> | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Engine returned when no per-user key is available — fails closed with the
 * framework's standard missing-credentials error code instead of leaking a
 * raw fetch 401. */
function missingKeyEngine(): AgentEngine {
  return {
    name: "deepseek",
    label: "DeepSeek",
    defaultModel: DEEPSEEK_DEFAULT_MODEL,
    supportedModels: DEEPSEEK_SUPPORTED_MODELS,
    capabilities: DEEPSEEK_CAPABILITIES,
    stream: async function* () {
      yield {
        type: "stop",
        reason: "error",
        error:
          "DeepSeek API key is missing. Add your key in Settings → Secrets — each user brings their own key.",
        errorCode: "missing_credentials",
      };
    },
  };
}

/**
 * Create a DeepSeekEngine instance.
 * BYOK only: the key comes exclusively from `config.apiKey` (resolved by the
 * engine registry from the user's stored secret). Never reads .env.
 */
export function createDeepSeekEngine(
  config: Record<string, unknown> = {},
): AgentEngine {
  const apiKey = (config.apiKey as string | undefined) ?? "";
  if (!apiKey) return missingKeyEngine();
  const baseUrl = (config.baseUrl as string | undefined) ?? DEEPSEEK_BASE_URL;
  return new DeepSeekEngine(apiKey, baseUrl);
}
