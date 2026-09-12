import { listAccessibleProjects } from "../server/projects/queries.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { toProjectSummary } from "../server/projects/presentation.js";

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
    const rows = await listAccessibleProjects(ctx);
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
