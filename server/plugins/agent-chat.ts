import { randomUUID } from "node:crypto";

import { getOrgContext } from "@agent-native/core/org";
import { projectMentions } from "../agent/project-mentions.js";
import { createAgentChatPlugin, loadActionsFromStaticRegistry } from "@agent-native/core/server";

import actionsRegistry from "../../.generated/actions-registry.js";
import { finalResponseGuard } from "../agent/final-response-guard.js";

const INITIAL_TOOL_NAMES = [
  "view-screen",
  "navigate",
  "list-projects",
  "get-project-context",
  "search-project-content",
  "get-project-summary",
];

const EXTERNAL_READ_ONLY_CATALOG = [
  "list-projects",
  "get-project",
  "get-project-summary",
  "get-project-context",
  "search-project-content",
  "list-project-changes",
  "export-project-json",
];

export default createAgentChatPlugin({
  appId: "iccplus-agent-native",
  actions: loadActionsFromStaticRegistry(actionsRegistry),
  initialToolNames: INITIAL_TOOL_NAMES,
  mentionProviders: { projects: projectMentions },
  resolveOrgId: async (event) => (await getOrgContext(event)).orgId,

  // Public CYOAs (visibility "public") must be viewable by anyone with the
  // share link, not just signed-in users. Resolve signed-out requests to a
  // throwaway anonymous owner so read actions pass their access checks;
  // the per-project access checks keep private projects 403 and every
  // mutation (which requires the editor role) blocked for anonymous callers.
  // anonymousReadOnly: false — anonymous visitors get no chat surface.
  anonymousOwner: () => `anon-${randomUUID()}@agent-native.com`,
  anonymousReadOnly: false,

  // --- Framework integration surfaces --------------------------------------
  // Native actions in dev (structured JSON args instead of bash `pnpm action`
  // indirection — the CYOA actions take objects/arrays that do not round-trip
  // through the CLI parser).
  nativeActionsInDev: true,
  // Sandboxed agent-authored extension mini-apps (the app already ships the
  // `/extensions` routes; this exposes the create/manage tools + API).
  extensionTools: true,
  // Durable background runs: long agent turns move to the Netlify background
  // function (15-min budget). Needs A2A_SECRET at runtime + a Netlify deploy;
  // the foreground circuit-breaker falls back to inline turns when unset.
  durableBackgroundRuns: true,
  // External MCP server branding surfaced during the initialize handshake.
  mcpServerInfo: {
    title: "ICCPlus CYOA Studio",
    description: "Build, edit, and play ICCPlus interactive CYOA documents",
    websiteUrl: "/",
  },
  // External-agent policy: auto-advertise actions explicitly marked
  // GET + readOnly + publicAgent.requiresAuth; keep writes behind ask_app.
  externalAgents: {
    authenticatedReads: "auto",
    writes: "ask_app_only",
  },
  connectorCatalog: EXTERNAL_READ_ONLY_CATALOG,

  /**
   * Proof-of-done guard (the version-matched in-loop processor equivalent).
   * When the user asked for durable work and the model claims it is done,
   * require evidence: a mutating project action must have succeeded this turn.
   * A text-only "I did it" answer is rejected with a corrective retry.
   * See server/agent/final-response-guard.ts (unit tested).
   */
  finalResponseGuard,

  systemPrompt: `You are the agent for ICCPlus CYOA Studio, an agent-native port of the ICCPlus Interactive CYOA Creator.

A CYOA ("Choose Your Own Adventure") project is a JSON document (the \`App\` shape in shared/types.ts) stored in the SQLite \`projects\` table. The chat, the UI, and you all share one database, and every durable operation happens through an action — never raw SQL.

## Context and review

Use view-screen first: it returns fresh selected project content. Use search-project-content to find saved row/choice/addon IDs, titles and prose in large projects; page through bounded results and use their target IDs with navigate. This searches saved content, not private planning notes. Use get-project-context for targeted verification and get-project-summary for structure; full get-project responses can be many megabytes. Read get-review-feedback for the project before handling review requests. Resolve a review thread only after verifying the change, with a resolutionNote explaining the evidence. Before bulk rewrites, create-resource-version for resourceType "project" and the project id so the user has a restore point. Open projects at /projects/{id}/editor, /visual-editor, or /viewer.

For visual feedback, use view-screen with screenshot: true or capture-viewer after navigating to a specific target. The returned _agentImages contain actual viewer pixels for vision-capable models; text-only models must not claim to have seen them. Respect reported capture limitations and locked targets; navigation never selects or unlocks choices.

For user-requested automations, discover typed triggers with manage-automations action=list-events. CYOA offers cyoa.project.created and cyoa.planning.status-changed (filter status=review for editorial review). These events are scoped to the actor and omit prose/notes. Read fresh project context or get-project-plan under the job creator's access. Configure jobs only when requested; event-triggered automation writes suppress these events to prevent loops. External integrations need configured connections and explicit MCP tool allowlists.

## Domain model

- A project has rows (\`app.rows\`), each with \`objects\` (choices). Rows and choices carry \`title\`, \`titleText\`/\`text\`, \`image\`, \`requireds\` (requirements), and choices carry \`scores\` and \`groups\`.
- \`app.pointTypes\` are the currencies: \`id\`, \`name\`, \`startingSum\`, \`initValue\`, \`beforeText\` (e.g. "Cost:"), \`afterText\` (e.g. "gold"). A choice's \`scores\` array references point types by \`score.id === pointType.id\`; \`score.value\` is positive for a cost, negative for a reward (total -= value).
- \`app.groups\` (id, name, elements, rowElements): groups tag choices; exclusivity requires explicit not-selected requirements.
- \`app.globalRequirements\` are named requirement sets; \`requireds\` on rows/choices gate visibility/selectability by point totals or selected choice ids.
- \`app.viewerConfig.title\` is the in-viewer title; the \`projects.title\` column is the list metadata. \`update-project-settings\` with \`title\` updates the viewer title; \`update-project\` with \`title\` updates the list title.

## How to help

- For document-style planning, use \`get-project-plan\` for a bounded outline or one row/choice/addon draft, then \`update-planning-entry\` with its revision. Save drafts separately from live prose; apply title/text explicitly after checking the baseline. Mechanics and art notes are not executable rules. Navigate to \`?tab=plan&rowId=…&choiceId=…&addonId=…\` for the linked writing workspace.
- Start with \`view-screen\` when the user's visible context matters, then \`get-project-context\` / \`get-project-summary\` to see what exists.
- To create content: \`create-project\`, then \`add-row\`, \`add-choice\`, \`add-score\`, \`add-point-type\`, \`add-group\`, \`add-global-requirement\`. Edit anything with the matching \`update-*\` patch action; reorder with \`move-row\` / \`move-choice\`; remove with \`delete-*\`.
- Verify your work: after mutating, call \`get-project-context\` with the affected IDs and check content and totals. Request full \`get-project\` only when exact fields absent from compact context are necessary.
- Import existing ICCPlus JSON with \`import-project-json\` (accepts a JSON string or object); export with \`export-project-json\`.
- To source images: \`search-image-source\` searches e621/Derpibooru by tag (metatags like \`rating:safe\` / \`rating:explicit\`, \`species:canine\`, \`order:random\` supported), then \`add-image-from-source\` imports the chosen post with automatic attribution (title, tags, description, source copied onto the resource). NSFW content on Derpibooru needs the account's API key (Settings → Secrets).
- Keep the action surface as the single source of truth — if you are about to reach for a raw db script for normal product behavior, use an action instead.

Be concise: answer in a few sentences, do the work, and report what changed.`,
});
