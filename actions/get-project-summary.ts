import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getProjectOrThrow } from "./_project-store.js";

/** Compact ids referenced by a requirement list (choice ids, point types, …). */
function requiredIds(requireds: unknown[] | undefined): string[] {
  if (!Array.isArray(requireds)) return [];
  const ids = new Set<string>();
  for (const req of requireds) {
    if (req && typeof req === "object") {
      const reqId = (req as { reqId?: unknown }).reqId;
      if (typeof reqId === "string" && reqId) ids.add(reqId);
    }
  }
  return [...ids];
}

export default defineAction({
  description:
    "Lightweight project structure read (no embedded images, no choice/row bodies): the project title, every row with its id / index / title / choice count / addon count / requirement targets, every choice's id / index / title / requirement targets, plus point type and group id/name lists. Use this to plan rows, choices and requireds wiring without loading the full document.",
  readOnly: true,
  schema: z.object({
    projectId: z.string().describe("Project id"),
  }),
  run: async ({ projectId }) => {
    const { row, app } = await getProjectOrThrow(projectId);
    const pointTypes = (app.pointTypes ?? []).map((pt) => ({ id: pt.id, name: pt.name }));
    const groups = (app.groups ?? []).map((g) => ({ id: g.id, name: g.name }));
    const rows = (app.rows ?? []).map((r) => ({
      id: r.id,
      index: r.index,
      title: r.title ?? "",
      choiceCount: (r.objects ?? []).length,
      addonCount: (r.objects ?? []).reduce((sum, c) => sum + (c.addons?.length ?? 0), 0),
      requiredIds: requiredIds(r.requireds),
      choices: (r.objects ?? []).map((c) => ({
        id: c.id,
        index: c.index,
        title: c.title ?? "",
        addonCount: (c.addons ?? []).length,
        requiredIds: requiredIds(c.requireds),
        scoreIds: (c.scores ?? [])
          .map((s) => s.id ?? s.type)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
        groupIds: c.groups ?? [],
      })),
    }));
    return {
      projectId,
      title: row.title,
      updatedAt: row.updatedAt,
      pointTypes,
      groups,
      rows,
    };
  },
});
