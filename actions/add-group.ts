import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { createDefaultGroup } from "../shared/cyoa.js";
import { getProjectOrThrow, saveProject } from "./_project-store.js";

export default defineAction({
  description: "Add a new choice group to a project (default name \"Group\") and return it.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    name: z.string().optional().describe("Group name; defaults to \"Group\""),
  }),
  run: async ({ projectId, name }) => {
    const { app } = await getProjectOrThrow(projectId);
    const group = createDefaultGroup(name ?? "Group");
    app.groups.push(group);
    await saveProject(projectId, app);
    return { group };
  },
});
