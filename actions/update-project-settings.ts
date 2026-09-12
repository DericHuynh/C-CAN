import { projectAudit } from "./_project-audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { eq } from "./_drizzle.js";

import { getDb } from "../server/db/index.js";
import { projects, type NewProject } from "../server/db/schema.js";
import { getProjectOrThrow, saveProject } from "./_project-store.js";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export default defineAction({
  audit: projectAudit,
  description:
    "Update project settings. Special keys: `viewerConfig` (object) is shallow-merged into the document's viewer config, `title` maps to the viewer title (app.viewerConfig.title), `description` updates the DB metadata column; every other key shallow-merges into the top-level app document.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    patch: z
      .record(z.string(), z.unknown())
      .describe("Settings to apply (viewerConfig / title / description / top-level app fields)"),
  }),
  run: async ({ projectId, patch }) => {
    const { app } = await getProjectOrThrow(projectId);

    if (isPlainObject(patch.viewerConfig)) {
      app.viewerConfig = { ...app.viewerConfig, ...patch.viewerConfig };
    }
    if (patch.title !== undefined) {
      app.viewerConfig.title = String(patch.title);
    }

    const metadata: Partial<NewProject> = { updatedAt: new Date().toISOString() };
    if (patch.description !== undefined) {
      metadata.description = String(patch.description);
    }

    const topLevel = app as Record<string, unknown>;
    for (const [key, value] of Object.entries(patch)) {
      if (key === "viewerConfig" || key === "title" || key === "description") continue;
      topLevel[key] = value;
    }

    const db = getDb();
    await db.update(projects).set(metadata).where(eq(projects.id, projectId));
    await saveProject(projectId, app);
    return { ok: true };
  },
});
