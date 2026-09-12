import { projectAudit } from "./_project-audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound, getProjectOrThrow, saveProject } from "./_project-store.js";

export default defineAction({
  audit: projectAudit,
  description:
    "Shallow-merge a patch into a point type's fields (id is preserved). Returns the updated point type.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    pointTypeId: z.string().describe("Point type id"),
    patch: z.record(z.string(), z.unknown()).describe("Fields to merge into the point type"),
  }),
  run: async ({ projectId, pointTypeId, patch }) => {
    const { app } = await getProjectOrThrow(projectId);
    const pointType = app.pointTypes.find((p) => p.id === pointTypeId);
    assertFound(pointType, `Point type "${pointTypeId}" not found in project "${projectId}"`);
    const merged = { ...pointType, ...patch, id: pointType.id };
    app.pointTypes[app.pointTypes.indexOf(pointType)] = merged;
    await saveProject(projectId, app);
    return { pointType: merged };
  },
});
