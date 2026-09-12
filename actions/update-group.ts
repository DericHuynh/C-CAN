import { editBaseSchema, mergeProjectPatch } from "../server/projects/collaboration.js";
import { projectAudit } from "../server/projects/audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound } from "../shared/assert.js";
import { getProjectOrThrow, saveProject } from "../server/projects/repository.js";

export default defineAction({
  audit: projectAudit,
  description:
    "Shallow-merge a patch into a group's fields (id is preserved). Returns the updated group.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    groupId: z.string().describe("Group id"),
    base: editBaseSchema,
    patch: z.record(z.string(), z.unknown()).describe("Fields to merge into the group"),
  }),
  run: async ({ projectId, groupId, patch, base }, ctx) => {
    const { app, row: storedProject } = await getProjectOrThrow(projectId, ctx, "editor");
    const group = app.groups.find((g) => g.id === groupId);
    assertFound(group, `Group "${groupId}" not found in project "${projectId}"`);
    patch = mergeProjectPatch(group, patch, base);
    const merged = { ...group, ...patch, id: group.id };
    app.groups[app.groups.indexOf(group)] = merged;
    await saveProject(projectId, app, storedProject.json);
    return { group: merged };
  },
});
