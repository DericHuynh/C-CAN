import { createAuthPlugin } from "@agent-native/core/server";

const rawAppTitle = "ICCPlus CYOA Studio";
const appTitle = rawAppTitle === "{" + "{APP_TITLE}}" ? "Chat" : rawAppTitle;

export default createAuthPlugin({
  // CYOA share links (`/projects/{id}/viewer`) must open for recipients
  // without an account. Signed-out visitors may load project pages and call
  // the read-only actions that back them; everything else stays behind the
  // auth guard. The per-project access checks still gate the DATA — private
  // projects 403 and every mutation requires the owner/editor role — so
  // anonymous callers can only view (and only projects marked Public).
  publicPaths: [
    "/projects",
    "/_agent-native/actions/get-project",
    "/_agent-native/actions/get-project-summary",
  ],
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
