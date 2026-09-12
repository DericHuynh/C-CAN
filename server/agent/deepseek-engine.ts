/**
 * DeepSeek model provider — built on the framework's AI-SDK OpenAI-compatible
 * engine (`createAISDKEngine("openai", { baseUrl })`).
 *
 * DeepSeek exposes an OpenAI Chat Completions API, so instead of hand-rolling
 * SSE parsing, event translation, tool-call reconciliation and error
 * classification (the previous ~670-line implementation), this module reuses
 * the framework's `ai-sdk:openai` engine pointed at `https://api.deepseek.com`
 * and adds the DeepSeek-specific constraints the generic OpenAI engine cannot
 * know:
 *
 *  1. **max_tokens ceiling** — DeepSeek rejects requests above its documented
 *     8192-token output ceiling with a 400. The framework's model catalog
 *     treats unknown models as 64K output and the interactive-chat path asks
 *     for 32K, so the stream wrapper clamps `maxOutputTokens` to 8192 before
 *     the SDK serializes the request.
 *  2. **vision: false** — the current DeepSeek models are text-only; the
 *     OpenAI capability table declares vision, so the wrapper pins the
 *     capability flags to the DeepSeek set (which also gates the agent loop's
 *     attachment handling).
 *  3. **model catalog** — the engine advertises only the app's pinned DeepSeek
 *     models instead of the OpenAI GPT catalog, while `preserveCustomModels`
 *     (implied by the custom base URL) lets any `deepseek-*` id pass through
 *     verbatim.
 *  4. **key handling** — the key comes from the user's stored secret
 *     (`config.apiKey`), with the deployment-level `DEEPSEEK_API_KEY` env var
 *     as a shared default (per AGENTS.md). `allowEnvFallback` is forced off in
 *     the underlying OpenAI provider so it can never silently fall back to
 *     `OPENAI_API_KEY` (a cross-provider key leak), and a missing key fails
 *     closed with the framework's `missing_credentials` code instead of a raw
 *     fetch 401.
 *
 * Reasoning: DeepSeek configures reasoning through a `thinking` object
 * (`thinking.reasoning_effort`: low/high/max), not the top-level
 * `reasoning_effort` parameter the AI SDK OpenAI provider emits. The framework
 * only sends `reasoning_effort` for known GPT/Claude/Gemini reasoning families
 * (`getReasoningEffortOptionsForModel`), and `deepseek-*` models fall through
 * to the empty set — so the field is never serialized and DeepSeek's
 * server-side default (thinking enabled, effort high) applies. `max_tokens`
 * stays `max_tokens` (the SDK's `max_tokens` → `max_completion_tokens`
 * rewrite only fires for OpenAI o-series / gpt-5 models), and
 * `stream_options.include_usage` / `temperature` / `system` messages / tool
 * calls are all part of DeepSeek's documented surface.
 */

import type {
  AgentEngine,
  EngineCapabilities,
  EngineEvent,
  EngineStreamOptions,
} from "@agent-native/core/agent/engine";
import { createAISDKEngine } from "@agent-native/core/agent/engine";

export const DEEPSEEK_API_KEY_ENV = "DEEPSEEK_API_KEY";
export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
export const DEEPSEEK_DEFAULT_MODEL = "deepseek-v4-flash";
export const DEEPSEEK_SUPPORTED_MODELS = ["deepseek-v4-flash"] as const;

/**
 * DeepSeek's documented max-output ceiling (8K). Requests above it are
 * rejected with a 400, so the stream wrapper clamps here rather than trusting
 * caller-supplied ceilings (the interactive-chat path asks for 32K).
 */
export const DEEPSEEK_MAX_OUTPUT_TOKENS = 8192;

export const DEEPSEEK_CAPABILITIES: EngineCapabilities = {
  // deepseek-v4* models run thinking mode by default (server-side).
  thinking: true,
  promptCaching: false,
  vision: false,
  computerUse: false,
  parallelToolCalls: true,
};

/**
 * Clamp the requested max output to DeepSeek's 8192 ceiling. A positive
 * explicit value is honored up to the ceiling; anything else (unset, invalid)
 * falls back to the full 8192 so reasoning-heavy turns keep headroom.
 */
export function resolveMaxOutputTokens(explicit: unknown): number {
  if (typeof explicit === "number" && Number.isFinite(explicit) && explicit > 0) {
    return Math.min(Math.floor(explicit), DEEPSEEK_MAX_OUTPUT_TOKENS);
  }
  return DEEPSEEK_MAX_OUTPUT_TOKENS;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Engine returned when no key is available — fails closed with the
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
 * The AI SDK's `ai-sdk:openai` engine pointed at DeepSeek, wrapped to enforce
 * the DeepSeek-specific constraints above. The framework engine handles all
 * streaming, event translation, first-event timeout, error classification
 * (including `http_401` credential-failure markers), and tool-call recovery.
 */
function createAiSdkDeepSeekEngine(apiKey: string, baseUrl: string): AgentEngine {
  const engine = createAISDKEngine("openai", {
    model: DEEPSEEK_DEFAULT_MODEL,
    baseUrl,
    apiKey,
    // The key must never come from the OpenAI provider's own env fallback
    // (OPENAI_API_KEY) — that would send an OpenAI key to api.deepseek.com.
    allowEnvFallback: false,
  });
  const stream = engine.stream.bind(engine);
  return {
    name: "deepseek",
    label: "DeepSeek",
    defaultModel: DEEPSEEK_DEFAULT_MODEL,
    supportedModels: DEEPSEEK_SUPPORTED_MODELS,
    preserveCustomModels: true,
    capabilities: DEEPSEEK_CAPABILITIES,
    async *stream(opts: EngineStreamOptions): AsyncGenerator<EngineEvent> {
      // Clamp before the SDK serializes: the framework resolves 32K for the
      // interactive-chat path (unknown models default to a 64K ceiling), which
      // DeepSeek rejects. resolveMaxOutputTokens also supplies the 8192 default
      // when the caller left it unset.
      yield* stream({
        ...opts,
        maxOutputTokens: resolveMaxOutputTokens(opts.maxOutputTokens),
      });
    },
  };
}

/**
 * Create the DeepSeek engine.
 *
 * Key precedence (per AGENTS.md "Model Providers"): the user's stored secret
 * (`config.apiKey`, resolved by the engine registry) wins; the deployment-level
 * `DEEPSEEK_API_KEY` env var is the shared default, gated by the registry's
 * `allowEnvFallback` flag so a hosted multi-tenant deployment cannot hand a
 * deploy key to every signed-in user.
 */
export function createDeepSeekEngine(config: Record<string, unknown> = {}): AgentEngine {
  const storedKey = (config.apiKey as string | undefined) ?? "";
  let apiKey = storedKey;
  if (!apiKey && config.allowEnvFallback !== false) {
    // guard:allow-env-credential — AGENTS.md Model Providers explicitly permits this deploy default; Core's registry controls allowEnvFallback and scoped keys take precedence.
    apiKey = process.env.DEEPSEEK_API_KEY ?? "";
  }
  if (!apiKey) return missingKeyEngine();
  const baseUrl = (config.baseUrl as string | undefined) ?? DEEPSEEK_BASE_URL;
  return createAiSdkDeepSeekEngine(apiKey, baseUrl);
}
