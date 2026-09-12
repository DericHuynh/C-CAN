import { editBaseSchema, mergeProjectPatch } from "../server/projects/collaboration.js";
import { projectAudit } from "../server/projects/audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound } from "../shared/assert.js";
import { getProjectOrThrow, saveProject } from "../server/projects/repository.js";

export default defineAction({
  audit: projectAudit,
  description:
    "Shallow-merge a patch into a point type's fields (id is preserved). Returns the updated point type.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    pointTypeId: z.string().describe("Point type id"),
    base: editBaseSchema,
    patch: z.record(z.string(), z.unknown()).describe("Fields to merge into the point type"),
  }),
  run: async ({ projectId, pointTypeId, patch, base }, ctx) => {
    const { app, row: storedProject } = await getProjectOrThrow(projectId, ctx, "editor");
    const pointType = app.pointTypes.find((p) => p.id === pointTypeId);
    assertFound(pointType, `Point type "${pointTypeId}" not found in project "${projectId}"`);
    patch = mergeProjectPatch(pointType, patch, base);
    const merged = { ...pointType, ...patch, id: pointType.id };
    app.pointTypes[app.pointTypes.indexOf(pointType)] = merged;
    await saveProject(projectId, app, storedProject.json);
    return { pointType: merged };
  },
});
