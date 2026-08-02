/**
 * DeepSeek model provider — registered through the framework's standard
 * extension points:
 *
 * 1. `registerAgentEngine()` — adds DeepSeek to the settings engine picker
 *    and the agent runtime. The engine (server/agent/deepseek-engine.ts) is
 *    a dedicated AgentEngine that talks directly to DeepSeek's
 *    OpenAI-compatible API (`https://api.deepseek.com`), rather than
 *    inheriting the AI-SDK OpenAI provider's GPT-specific assumptions.
 * 2. `registerRequiredSecret()` — the framework's standard BYOK flow: each
 *    signed-in user enters their own key in Settings → Secrets (stored
 *    encrypted, scoped to that user, validated against the DeepSeek API).
 *
 * There is deliberately NO deployment-level env-var fallback: this app is
 * BYOK — a user's key comes from their own stored secret, nothing else.
 *
 * Model selection is pinned: `deepseek-v4-flash` is the app's default and its
 * only supported model.
 */
import { defineNitroPlugin } from "@agent-native/core/server";
import {
  registerAgentEngine,
  registerBuiltinEngines,
} from "@agent-native/core/agent/engine";
import { registerRequiredSecret } from "@agent-native/core/secrets";
import {
  createDeepSeekEngine,
  DEEPSEEK_API_KEY_ENV,
  DEEPSEEK_BASE_URL,
  DEEPSEEK_CAPABILITIES,
  DEEPSEEK_DEFAULT_MODEL,
  DEEPSEEK_SUPPORTED_MODELS,
} from "../agent/deepseek-engine.js";

/**
 * Health check used by the framework's secrets "Test" button and the
 * `manage-agent-engine` test tool. Cheap DeepSeek call: list models with the
 * key. The key value is only used in the Authorization header, never logged.
 */
async function validateDeepSeekKey(value: string) {
  try {
    const res = await fetch(`${DEEPSEEK_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${value}` },
    });
    if (res.ok) {
      return { ok: true as const };
    }
    return {
      ok: false as const,
      error: `DeepSeek rejected the key (HTTP ${res.status})`,
    };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Could not reach DeepSeek",
    };
  }
}

// Standard secrets registration — runs at module load so the framework's
// Settings → Secrets UI and its write/test/delete routes pick it up.
registerRequiredSecret({
  key: DEEPSEEK_API_KEY_ENV,
  label: "DeepSeek API Key",
  description:
    "DeepSeek model provider key (deepseek-v4-flash). Bring your own key — saved per user, encrypted at rest.",
  docsUrl: "https://platform.deepseek.com/api_keys",
  scope: "user",
  kind: "api-key",
  validator: validateDeepSeekKey,
});

export default defineNitroPlugin(() => {
  // Builtins must be registered first so provider priority in auto-detection
  // stays framework-defined (e.g. an OPENAI_API_KEY still wins over a stored
  // DeepSeek key when both exist). Idempotent — safe to call again.
  registerBuiltinEngines();

  registerAgentEngine({
    name: "deepseek",
    label: "DeepSeek",
    description:
      "DeepSeek (deepseek-v4-flash) via the OpenAI-compatible DeepSeek API. BYOK — each user adds their key in Settings → Secrets.",
    capabilities: DEEPSEEK_CAPABILITIES,
    defaultModel: DEEPSEEK_DEFAULT_MODEL,
    supportedModels: DEEPSEEK_SUPPORTED_MODELS,
    requiredEnvVars: [DEEPSEEK_API_KEY_ENV],
    create: (config) => {
      // BYOK only: the key comes exclusively from the caller's stored secret
      // (resolved by the registry as config.apiKey). Never read .env.
      return createDeepSeekEngine(config);
    },
  });
});
