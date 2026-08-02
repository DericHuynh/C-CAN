import { createAuthPlugin } from "@agent-native/core/server";

const rawAppTitle = "ICCPlus CYOA Studio";
const appTitle = rawAppTitle === "{" + "{APP_TITLE}}" ? "Chat" : rawAppTitle;

export default createAuthPlugin({
  marketing: {
    appName: appTitle,
    tagline:
      "Agent-native Interactive CYOA creator: build, play, and chat your way through Choose Your Own Adventure projects.",
    features: [
      "Full-page chat with durable threads and tool call history",
      "Build CYOAs with rows, choices, points, groups, and requirements",
      "Agent and UI share one database — chat with the agent to shape your CYOA",
      "Import and export the original ICCPlus JSON document format",
    ],
  },
});
