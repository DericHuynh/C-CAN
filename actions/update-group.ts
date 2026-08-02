import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound, getProjectOrThrow, saveProject } from "./_project-store.js";

export default defineAction({
  description:
    "Shallow-merge a patch into a group's fields (id is preserved). Returns the updated group.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    groupId: z.string().describe("Group id"),
    patch: z.record(z.string(), z.unknown()).describe("Fields to merge into the group"),
  }),
  run: async ({ projectId, groupId, patch }) => {
    const { app } = await getProjectOrThrow(projectId);
    const group = app.groups.find((g) => g.id === groupId);
    assertFound(group, `Group "${groupId}" not found in project "${projectId}"`);
    const merged = { ...group, ...patch, id: group.id };
    app.groups[app.groups.indexOf(group)] = merged;
    await saveProject(projectId, app);
    return { group: merged };
  },
});
