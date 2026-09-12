import { projectAudit } from "./_project-audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound, getProjectOrThrow, saveProject } from "./_project-store.js";

export default defineAction({
  audit: projectAudit,
  description: "Delete a choice group from a project.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    groupId: z.string().describe("Group id"),
  }),
  run: async ({ projectId, groupId }) => {
    const { app } = await getProjectOrThrow(projectId);
    const index = app.groups.findIndex((g) => g.id === groupId);
    assertFound(index !== -1, `Group "${groupId}" not found in project "${projectId}"`);
    app.groups.splice(index, 1);
    await saveProject(projectId, app);
    return { ok: true };
  },
});
