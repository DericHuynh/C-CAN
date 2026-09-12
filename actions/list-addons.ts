import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { getProjectOrThrow } from "../server/projects/repository.js";
import { projectEntities, resolveEntity, entityTarget } from "../shared/project-workflow.js";
import { projectRevision } from "../server/projects/workflow.js";
import { projectPath } from "../shared/project-routes.js";
export default defineAction({
  description:
    "List addons with stable IDs, display titles, parent choice, array position and complete editor/viewer targets. Blank authored titles get a readable display fallback. Paginated; use inspect-project for prose or mechanics.",
  schema: z.object({
    projectId: z.string(),
    choiceId: z.string().optional(),
    offset: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  }),
  http: { method: "GET" },
  readOnly: true,
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  run: async ({ projectId, choiceId, offset = 0, limit = 30 }, ctx) => {
    const { app, row } = await getProjectOrThrow(projectId, ctx, "viewer");
    const entries = projectEntities(app);
    const parent = choiceId ? resolveEntity(entries, choiceId, "choice") : undefined;
    const all = entries.filter((e) => e.kind === "addon" && (!parent || e.parentId === parent.id));
    return {
      projectId,
      revision: projectRevision(row.json),
      total: all.length,
      nextOffset: offset + limit < all.length ? offset + limit : null,
      addons: all.slice(offset, offset + limit).map((e) => {
        const target = entityTarget(e),
          query = new URLSearchParams(target);
        return {
          id: e.id,
          title: e.title,
          authoredTitle: e.entity.title,
          parentId: e.parentId,
          addonIndex: e.index,
          target: { projectId, ...target },
          editorPath: `${projectPath(projectId)}?${query}`,
          viewerPath: `${projectPath(projectId, "viewer")}?${query}`,
        };
      }),
    };
  },
});
