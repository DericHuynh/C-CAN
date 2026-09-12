import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { getProjectOrThrow } from "../server/projects/repository.js";
import { projectRevision } from "../server/projects/workflow.js";
import {
  projectEntities,
  resolveEntity,
  entityTarget,
  entityKindSchema,
} from "../shared/project-workflow.js";
import { validateProject } from "../shared/project-validation.js";
import { projectPath } from "../shared/project-routes.js";

export default defineAction({
  description:
    "Focused project/reference inspection with usable IDs, parent targets and revision. Read prose, mechanics, dependency edges, or aggregate reference patterns without a full project payload. Pagination and text slices are explicit; excerpts are not replacement documents. Titles resolve only when unambiguous.",
  schema: z.object({
    projectId: z.string(),
    projection: z
      .enum(["summary", "prose", "mechanics", "dependencies", "reference"])
      .default("summary"),
    kind: entityKindSchema.optional(),
    id: z.string().optional(),
    rowId: z.string().optional(),
    offset: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    textOffset: z.coerce.number().int().min(0).default(0),
    textLimit: z.coerce.number().int().min(1).max(4000).default(1200),
  }),
  http: { method: "GET" },
  readOnly: true,
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  run: async (
    {
      projectId,
      projection = "summary",
      kind,
      id,
      rowId,
      offset = 0,
      limit = 20,
      textOffset = 0,
      textLimit = 1200,
    },
    ctx,
  ) => {
    const { app, row } = await getProjectOrThrow(projectId, ctx, "viewer");
    const all = projectEntities(app);
    const target = id ? resolveEntity(all, id, kind) : undefined;
    const rowTarget = rowId ? resolveEntity(all, rowId, "row") : undefined;
    const entries = all.filter(
      (e) =>
        (!kind || e.kind === kind) &&
        (!target || e.id === target.id) &&
        (!rowTarget || e.rowId === rowTarget.id),
    );
    const page = entries.slice(offset, offset + limit);
    const budget = { remaining: 30000 };
    const bounded = (value: unknown) => {
      const json = JSON.stringify(value ?? null);
      const size = Math.min(4000, budget.remaining);
      budget.remaining = Math.max(0, budget.remaining - Math.min(json.length, size));
      return json.length <= size
        ? value
        : { excerpt: json.slice(0, size), truncated: true, totalChars: json.length };
    };
    const results = page.map((e) => {
      const target = entityTarget(e),
        query = new URLSearchParams(target);
      const text = String(e.kind === "row" ? (e.entity.titleText ?? "") : (e.entity.text ?? ""));
      const count = Math.min(textLimit, budget.remaining);
      if (projection === "prose")
        budget.remaining -= Math.min(count, Math.max(0, text.length - textOffset));
      return {
        kind: e.kind,
        id: e.id,
        title: e.title.slice(0, 300),
        parentId: e.parentId,
        target: { projectId, ...target },
        editorPath: `${projectPath(projectId)}?${query}`,
        viewerPath: `${projectPath(projectId, "viewer")}?${query}`,
        ...(projection === "prose"
          ? {
              text: text.slice(textOffset, textOffset + count),
              textOffset,
              totalChars: text.length,
              nextTextOffset: textOffset + count < text.length ? textOffset + count : null,
            }
          : {}),
        ...(projection === "mechanics"
          ? {
              mechanics: bounded({
                scores: e.entity.scores,
                requireds: e.entity.requireds,
                groups: e.entity.groups,
                isSelectableMultiple: e.entity.isSelectableMultiple,
                numMultipleTimesPluss: e.entity.numMultipleTimesPluss,
                numMultipleTimesMinus: e.entity.numMultipleTimesMinus,
              }),
            }
          : {}),
      };
    });
    let details: unknown;
    if (projection === "dependencies") {
      const report = validateProject(app),
        ids = new Set(page.map((e) => e.id));
      const edges = report.references.filter(
        (r) => ids.has(r.source) || ids.has(r.value.split("/ON#")[0]),
      );
      details = {
        edges: bounded(edges),
        issues: bounded(report.issues.filter((i) => ids.has(i.source))),
        limitations: report.limitations,
      };
    }
    if (projection === "reference") {
      const countBy = (values: string[]) =>
        Object.entries(
          values.reduce<Record<string, number>>(
            (counts, k) => ((counts[k] = (counts[k] ?? 0) + 1), counts),
            {},
          ),
        )
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([pattern, count]) => ({ pattern, count }));
      details = {
        scope: "entire filtered selection",
        entities: entries.length,
        averageProseChars: entries.length
          ? Math.round(
              entries.reduce(
                (n, e) => n + String(e.entity.titleText ?? e.entity.text ?? "").length,
                0,
              ) / entries.length,
            )
          : 0,
        hierarchy: countBy(entries.map((e) => e.kind)),
        addonPatterns: countBy(
          entries
            .filter((e) => e.kind === "addon")
            .map(
              (e) =>
                `selectable=${e.entity.isSelectable === true}; template=${e.entity.template}; width=${e.entity.addonWidth}`,
            ),
        ),
        scorePatterns: countBy(
          entries.flatMap((e) => (e.entity.scores ?? []).map((s: any) => `${s.id}: ${s.value}`)),
        ),
        requirementPatterns: countBy(
          entries.flatMap((e) =>
            (e.entity.requireds ?? []).map(
              (r: any) => `${r.type}:${r.operator ?? ""}:${r.required !== false}`,
            ),
          ),
        ),
        styling: bounded(app.styling),
      };
    }
    return {
      projectId,
      title: row.title,
      viewerTitle: app.viewerConfig?.title,
      revision: projectRevision(row.json),
      projection,
      total: entries.length,
      offset,
      nextOffset: offset + page.length < entries.length ? offset + page.length : null,
      results,
      ...(details ? { details } : {}),
      note: "Inspection never modifies the reference project. Truncated excerpts must not replace complete fields.",
    };
  },
});
