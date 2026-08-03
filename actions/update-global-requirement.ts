import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound, getProjectOrThrow, saveProject } from "./_project-store.js";

export default defineAction({
  description:
    "Shallow-merge a patch into a global requirement's fields (id is preserved). Returns the updated requirement.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    requirementId: z.string().describe("Global requirement id"),
    patch: z.record(z.string(), z.unknown()).describe("Fields to merge into the requirement"),
  }),
  run: async ({ projectId, requirementId, patch }) => {
    const { app } = await getProjectOrThrow(projectId);
    app.globalRequirements ??= [];
    const requirement = app.globalRequirements.find((g) => g.id === requirementId);
    assertFound(
      requirement,
      `Global requirement "${requirementId}" not found in project "${projectId}"`,
    );
    const merged = { ...requirement, ...patch, id: requirement.id };
    app.globalRequirements[app.globalRequirements.indexOf(requirement)] = merged;
    await saveProject(projectId, app);
    return { requirement: merged };
  },
});
