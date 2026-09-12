import { projectAudit } from "../server/projects/audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { createDefaultGlobalRequirement } from "../shared/cyoa.js";
import { getProjectOrThrow, saveProject } from "../server/projects/repository.js";

export default defineAction({
  audit: projectAudit,
  description:
    'Add a new global requirement to a project (default name "Requirement") and return it.',
  schema: z.object({
    projectId: z.string().describe("Project id"),
    name: z.string().optional().describe('Requirement name; defaults to "Requirement"'),
  }),
  run: async ({ projectId, name }, ctx) => {
    const { app, row: storedProject } = await getProjectOrThrow(projectId, ctx, "editor");
    const requirement = createDefaultGlobalRequirement(name ?? "Requirement");
    app.globalRequirements ??= [];
    app.globalRequirements.push(requirement);
    await saveProject(projectId, app, storedProject.json);
    return { requirement };
  },
});
