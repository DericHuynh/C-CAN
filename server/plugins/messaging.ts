/**
 * Messaging integrations (G9): mount the framework's integrations plugin so
 * the app's agent can be reached conversationally from Slack, email,
 * Telegram, WhatsApp, Discord and Teams — same actions/tools as web chat.
 *
 * Mounting the plugin exposes the inbound webhook routes and the Integrations
 * settings surface; each platform still needs its own credentials (OAuth
 * app / webhook URL / API token) configured per user or org before messages
 * flow. The agent system prompt and engine are inherited from the agent-chat
 * plugin; the action surface is the same registry the chat uses.
 */
import {
  createIntegrationsPlugin,
  loadActionsFromStaticRegistry,
  type IntegrationsPluginOptions,
} from "@agent-native/core/server";

import actionsRegistry from "../../.generated/actions-registry.js";

/** Plugin options — exported so tests can assert the wiring. */
export const messagingOptions: IntegrationsPluginOptions = {
  appId: "iccplus-agent-native",
  actions: loadActionsFromStaticRegistry(actionsRegistry),
};

export default createIntegrationsPlugin(messagingOptions);
