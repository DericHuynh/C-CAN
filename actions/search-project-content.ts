import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { getProjectOrThrow } from "./_project-store.js";
import { planningEntries } from "../shared/planning.js";
import { projectPath } from "../shared/project-routes.js";

/** Plain authored prose only: attributes, media, scripts and planning drafts stay out. */
function text(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/data:[^\s<>"']+/gi, "[media omitted]")
    .replace(
      /&(?:amp|lt|gt|quot|apos|nbsp);/g,
      (entity) =>
        ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&nbsp;": " " })[
          entity
        ]!,
    )
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(value: string, query: string): string {
  const hit = query ? value.toLocaleLowerCase().indexOf(query) : 0;
  const start = Math.max(0, hit - 80);
  return `${start ? "…" : ""}${value.slice(start, start + 320)}${value.length > start + 320 ? "…" : ""}`;
}

export default defineAction({
  description:
    "Search saved CYOA row, choice and addon IDs, titles and prose without loading the whole document. Includes nonselectable and locked content, but no planning notes or images. Results have bounded excerpts, parent IDs, editor/viewer links, and pagination. Use get-project-context for a result's mechanics or navigate to its target; links do not unlock or select choices. Use get-project-plan for editorial drafts (editor access).",
  schema: z.object({
    projectId: z.string(),
    query: z.string().max(200).default(""),
    kind: z.enum(["row", "choice", "addon"]).optional(),
    rowId: z.string().optional(),
    offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
  http: { method: "GET" },
  readOnly: true,
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  chatUI: {
    renderer: "core.data-table",
    title: "CYOA search",
    description: "Saved content and navigation targets",
  },
  run: async ({ projectId, query = "", kind, rowId, offset = 0, limit = 20 }, ctx) => {
    const { app, row: project } = await getProjectOrThrow(projectId, ctx, "viewer");
    const needle = query.trim().toLocaleLowerCase();
    let total = 0;
    const results: Array<{
      kind: string;
      id: string;
      title: string;
      excerpt: string;
      target: { rowId: string; choiceId?: string; addonId?: string };
      editorPath: string;
      viewerPath: string;
    }> = [];
    for (const entry of planningEntries(app)) {
      if ((kind && entry.kind !== kind) || (rowId && entry.target.rowId !== rowId)) continue;
      const title = text(entry.entity.title) || entry.entity.id;
      const body = text(entry.kind === "row" ? entry.row.titleText : entry.entity.text);
      if (
        needle &&
        ![entry.entity.id, title, body].some((value) => value.toLocaleLowerCase().includes(needle))
      )
        continue;
      const position = total++;
      if (position < offset || results.length >= limit) continue;
      const params = new URLSearchParams(Object.entries(entry.target));
      results.push({
        kind: entry.kind,
        id: entry.entity.id,
        title: title.slice(0, 200),
        excerpt: excerpt(body, needle),
        target: entry.target,
        editorPath: `${projectPath(projectId, "editor")}?${params}`,
        viewerPath: `${projectPath(projectId, "viewer")}?${params}`,
      });
    }
    return {
      projectId,
      updatedAt: project.updatedAt,
      total,
      offset,
      nextOffset: offset + results.length < total ? offset + results.length : null,
      results,
      table: {
        columns: [
          { key: "title", label: "Title" },
          { key: "kind", label: "Kind" },
          { key: "excerpt", label: "Excerpt" },
        ],
        rows: results.map(({ title, kind, excerpt }) => ({ title, kind, excerpt })),
      },
    };
  },
});
