/**
 * Core agent-native routes, with the DeepSeek provider key added to the
 * env-status/env-vars allowlist.
 *
 * The chat model picker (useChatModels → buildChatModelGroups) marks an engine
 * group "configured" only when its `requiredEnvVars[0]` appears in the
 * `/_agent-native/env-status` response. That endpoint reports the framework's
 * provider keys (Anthropic/OpenAI/Google/…) plus whatever `envKeys` this app
 * registers here — so without this file the DeepSeek engine always rendered as
 * "(api key required)" in the chat picker even after the user saved their key
 * in Settings → Secrets. The per-user secret is resolved per request; this only
 * puts the key name on the allowlist that the picker and the legacy env-vars
 * save route consult.
 */
import { createCoreRoutesPlugin, defineAppConfig } from "@agent-native/core/server";

import { DEEPSEEK_API_KEY_ENV } from "../agent/deepseek-engine.js";

defineAppConfig({ app: { id: "iccplus-agent-native", name: "ICCPlus CYOA Studio" } });

export default createCoreRoutesPlugin({
  // Allow authenticated extension creation (POST /_agent-native/extensions) —
  // the agent-side create/manage tools are enabled in agent-chat.ts.
  extensionTools: true,
  // Branding for the /mcp/connect browser page + device-code flow.
  mcp: { serverName: "iccplus-agent-native" },
  envKeys: [
    {
      key: DEEPSEEK_API_KEY_ENV,
      label: "DeepSeek API Key",
      required: true,
      helpText:
        "DeepSeek model provider key (deepseek-v4-flash). Bring your own key — saved per user, encrypted at rest.",
    },
  ],
});
