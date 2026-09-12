import { editBaseSchema, mergeProjectPatch } from "../server/projects/collaboration.js";
import { projectAudit } from "../server/projects/audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound } from "../shared/assert.js";
import { getProjectOrThrow, saveProject } from "../server/projects/repository.js";

export default defineAction({
  audit: projectAudit,
  description:
    "Shallow-merge a patch into a global requirement's fields (id is preserved). Returns the updated requirement.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    requirementId: z.string().describe("Global requirement id"),
    base: editBaseSchema,
    patch: z.record(z.string(), z.unknown()).describe("Fields to merge into the requirement"),
  }),
  run: async ({ projectId, requirementId, patch, base }, ctx) => {
    const { app, row: storedProject } = await getProjectOrThrow(projectId, ctx, "editor");
    app.globalRequirements ??= [];
    const requirement = app.globalRequirements.find((g) => g.id === requirementId);
    assertFound(
      requirement,
      `Global requirement "${requirementId}" not found in project "${projectId}"`,
    );
    patch = mergeProjectPatch(requirement, patch, base);
    const merged = { ...requirement, ...patch, id: requirement.id };
    app.globalRequirements[app.globalRequirements.indexOf(requirement)] = merged;
    await saveProject(projectId, app, storedProject.json);
    return { requirement: merged };
  },
});
