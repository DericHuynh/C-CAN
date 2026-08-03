import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { createDefaultGlobalRequirement } from "../shared/cyoa.js";
import { getProjectOrThrow, saveProject } from "./_project-store.js";

export default defineAction({
  description:
    'Add a new global requirement to a project (default name "Requirement") and return it.',
  schema: z.object({
    projectId: z.string().describe("Project id"),
    name: z.string().optional().describe('Requirement name; defaults to "Requirement"'),
  }),
  run: async ({ projectId, name }) => {
    const { app } = await getProjectOrThrow(projectId);
    const requirement = createDefaultGlobalRequirement(name ?? "Requirement");
    app.globalRequirements ??= [];
    app.globalRequirements.push(requirement);
    await saveProject(projectId, app);
    return { requirement };
  },
});
