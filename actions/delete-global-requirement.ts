import { projectAudit } from "../server/projects/audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound } from "../shared/assert.js";
import { getProjectOrThrow, saveProject } from "../server/projects/repository.js";

export default defineAction({
  audit: projectAudit,
  description: "Delete a global requirement from a project.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    requirementId: z.string().describe("Global requirement id"),
  }),
  run: async ({ projectId, requirementId }, ctx) => {
    const { app, row: storedProject } = await getProjectOrThrow(projectId, ctx, "editor");
    app.globalRequirements ??= [];
    const index = app.globalRequirements.findIndex((g) => g.id === requirementId);
    assertFound(
      index !== -1,
      `Global requirement "${requirementId}" not found in project "${projectId}"`,
    );
    app.globalRequirements.splice(index, 1);
    await saveProject(projectId, app, storedProject.json);
    return { ok: true };
  },
});
