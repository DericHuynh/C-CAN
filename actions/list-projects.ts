import { defineAction } from "@agent-native/core/action";
import { accessFilter } from "@agent-native/core/sharing";
import { z } from "zod";

import { desc } from "./_drizzle.js";

import { getDb } from "../server/db/index.js";
import { projectShares, projects } from "../server/db/schema.js";
import { toProjectSummary } from "./_project-store.js";

export default defineAction({
  description:
    "List all CYOA projects as lightweight summaries (id, title, counts), ordered by most recently updated first.",
  schema: z.object({}),
  http: { method: "GET" },
  readOnly: true,
  // Authenticated read exposure for external MCP/A2A hosts (the agent-chat
  // plugin's `externalAgents.authenticatedReads: "auto"` + `connectorCatalog`
  // pick this up). Requires the standard auth/session — never public.
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  // Render the result as a native data-table widget in Agent-Native chat.
  // The widget reads the additive `columns`/`rows` keys below; `projects`
  // stays untouched for existing frontend consumers (useActionQuery).
  chatUI: {
    renderer: "core.data-table",
    title: "CYOA Projects",
    description: "All projects, most recently updated first",
  },
  run: async (_params, ctx) => {
    const db = getDb();
    // Only list projects the caller can see (own, shared with them, or public
    // when the list opts into cross-user discovery — private stays private).
    const rows = await db
      .select()
      .from(projects)
      .where(
        accessFilter(projects, projectShares, ctx ? { ...ctx, orgId: ctx.orgId ?? undefined } : undefined),
      )
      .orderBy(desc(projects.updatedAt));
    const summaries = rows.map((row) => toProjectSummary(row));
    return {
      projects: summaries,
      columns: [
        { key: "title", label: "Title" },
        { key: "rows", label: "Rows", align: "right" },
        { key: "choices", label: "Choices", align: "right" },
        { key: "pointTypes", label: "Point types", align: "right" },
        { key: "updatedAt", label: "Updated" },
      ],
      rows: summaries.map((p) => ({
        title: p.title || "Untitled",
        rows: p.rowCount,
        choices: p.choiceCount,
        pointTypes: p.pointTypeCount,
        updatedAt: new Date(p.updatedAt).toLocaleString(),
      })),
    };
  },
});
