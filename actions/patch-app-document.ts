import { projectAudit } from "./_project-audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getProjectOrThrow, saveProject } from "./_project-store.js";

export default defineAction({
  audit: projectAudit,
  description:
    "Apply a large, whole-document patch to a project in one call: every top-level key in `patch` REPLACES the corresponding app field wholesale (rows, images, pointTypes, groups, backpack, variables, words, soundEffects, viewerConfig, …). This is the sanctioned way to rewrite a big chunk of the document (e.g. replace the full `rows` array with a rebuilt section) without hundreds of small mutations. Pass complete arrays — existing rows/choices you want to keep must be included verbatim (their `styling` objects included). `viewerConfig` is shallow-merged; `title` sets the viewer title.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    patch: z
      .record(z.string(), z.unknown())
      .describe("Top-level app fields to replace wholesale (rows, images, pointTypes, groups, …)"),
  }),
  run: async ({ projectId, patch }) => {
    const { app } = await getProjectOrThrow(projectId);
    if (patch.title !== undefined) {
      app.viewerConfig.title = String(patch.title);
    }
    const topLevel = app as Record<string, unknown>;
    for (const [key, value] of Object.entries(patch)) {
      if (key === "title") continue;
      if (key === "viewerConfig" && value && typeof value === "object" && !Array.isArray(value)) {
        topLevel.viewerConfig = {
          ...(topLevel.viewerConfig as Record<string, unknown>),
          ...(value as Record<string, unknown>),
        };
        continue;
      }
      topLevel[key] = value;
    }
    await saveProject(projectId, app);
    return { ok: true };
  },
});
