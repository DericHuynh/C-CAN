import { projectAudit } from "../server/projects/audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { createDefaultGroup } from "../shared/cyoa.js";
import { getProjectOrThrow, saveProject } from "../server/projects/repository.js";

export default defineAction({
  audit: projectAudit,
  description: 'Add a new choice group to a project (default name "Group") and return it.',
  schema: z.object({
    projectId: z.string().describe("Project id"),
    name: z.string().optional().describe('Group name; defaults to "Group"'),
    rowElements: z.array(z.string()).optional().describe("Initial row ids"),
    elements: z.array(z.string()).optional().describe("Initial choice ids"),
  }),
  run: async ({ projectId, name, rowElements, elements }, ctx) => {
    const { app, row: storedProject } = await getProjectOrThrow(projectId, ctx, "editor");
    const group = createDefaultGroup(name ?? "Group");
    group.rowElements = [...new Set(rowElements ?? [])];
    group.elements = [...new Set(elements ?? [])];
    app.groups.push(group);
    await saveProject(projectId, app, storedProject.json);
    return { group };
  },
});
