import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound, getProjectOrThrow, saveProject } from "./_project-store.js";

export default defineAction({
  description: "Delete a global requirement from a project.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    requirementId: z.string().describe("Global requirement id"),
  }),
  run: async ({ projectId, requirementId }) => {
    const { app } = await getProjectOrThrow(projectId);
    app.globalRequirements ??= [];
    const index = app.globalRequirements.findIndex((g) => g.id === requirementId);
    assertFound(
      index !== -1,
      `Global requirement "${requirementId}" not found in project "${projectId}"`
    );
    app.globalRequirements.splice(index, 1);
    await saveProject(projectId, app);
    return { ok: true };
  },
});
