import { editBaseSchema, mergeProjectPatch } from "../server/projects/collaboration.js";
import { projectAudit } from "../server/projects/audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getProjectOrThrow, saveProject } from "../server/projects/repository.js";
import { clearDeletedCategoryAssignments } from "../shared/category-assignments.js";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export default defineAction({
  audit: projectAudit,
  description:
    "Update project settings. Special keys: `viewerConfig` (object) is shallow-merged into the document's viewer config, `title` maps to the viewer title (app.viewerConfig.title), `description` updates the DB metadata column; every other key shallow-merges into the top-level app document. Removing categories clears their item assignments.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    base: editBaseSchema,
    patch: z
      .record(z.string(), z.unknown())
      .describe("Settings to apply (viewerConfig / title / description / top-level app fields)"),
  }),
  run: async ({ projectId, patch, base }, ctx) => {
    if (patch.categories !== undefined) {
      // Keep unknown category fields from imported documents.
      patch.categories = z
        .array(z.object({ idx: z.number(), name: z.string(), type: z.string() }).passthrough())
        .parse(patch.categories);
    }
    const { app, row: storedProject } = await getProjectOrThrow(projectId, ctx, "editor");
    if (isPlainObject(base?.viewerConfig) && isPlainObject(patch.viewerConfig)) {
      patch = { ...patch, viewerConfig: { ...base.viewerConfig, ...patch.viewerConfig } };
    }
    patch = mergeProjectPatch(
      { ...app, title: app.viewerConfig.title, description: storedProject.description ?? "" },
      patch,
      base,
    );
    const previousCategories = app.categories;

    if (isPlainObject(patch.viewerConfig)) {
      app.viewerConfig = { ...app.viewerConfig, ...patch.viewerConfig };
    }
    if (patch.title !== undefined) {
      app.viewerConfig.title = String(patch.title);
    }

    const topLevel = app as Record<string, unknown>;
    for (const [key, value] of Object.entries(patch)) {
      if (key === "viewerConfig" || key === "title" || key === "description") continue;
      topLevel[key] = value;
    }
    if (patch.categories !== undefined) clearDeletedCategoryAssignments(app, previousCategories);

    await saveProject(
      projectId,
      app,
      storedProject.json,
      patch.description === undefined ? undefined : { description: String(patch.description) },
    );
    return { ok: true };
  },
});
