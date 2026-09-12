import { projectAudit } from "./_project-audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound, getProjectOrThrow, saveProject } from "./_project-store.js";

export default defineAction({
  audit: projectAudit,
  description:
    "Delete an image resource from a project. Entities that reference it fall back to showing nothing (their image reference becomes dangling).",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    imageId: z.string().describe("Image resource id"),
  }),
  run: async ({ projectId, imageId }) => {
    const { app } = await getProjectOrThrow(projectId);
    const index = app.images.findIndex((img) => img.id === imageId);
    assertFound(index !== -1, `Image "${imageId}" not found in project "${projectId}"`);
    app.images.splice(index, 1);
    await saveProject(projectId, app);
    return { ok: true };
  },
});
