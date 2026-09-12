import { editBaseSchema, mergeProjectPatch } from "../server/projects/collaboration.js";
import { projectRevision } from "../server/projects/revision.js";
import { projectAudit } from "../server/projects/audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound } from "../shared/assert.js";
import { getProjectOrThrow, saveProject } from "../server/projects/repository.js";

export default defineAction({
  audit: projectAudit,
  description:
    "Shallow-merge a patch into a choice's fields (id and index are preserved). Returns the updated choice.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    rowId: z.string().describe("Row id"),
    choiceId: z.string().describe("Choice id"),
    expectedRevision: z.string().optional(),
    expected: z.record(z.string(), z.unknown()).optional(),
    base: editBaseSchema,
    patch: z.record(z.string(), z.unknown()).describe("Fields to merge into the choice"),
  }),
  run: async ({ projectId, rowId, choiceId, patch, expectedRevision, expected, base }, ctx) => {
    const { app, row: storedProject } = await getProjectOrThrow(projectId, ctx, "editor");
    if (expectedRevision && projectRevision(storedProject.json) !== expectedRevision)
      throw new Error("Conflict: project changed since inspection.");
    const row = app.rows.find((r) => r.id === rowId);
    assertFound(row, `Row "${rowId}" not found in project "${projectId}"`);
    const choice = row.objects.find((c) => c.id === choiceId);
    assertFound(choice, `Choice "${choiceId}" not found in row "${rowId}"`);
    for (const [key, value] of Object.entries(expected ?? {}))
      if (JSON.stringify(choice[key]) !== JSON.stringify(value))
        throw new Error(`Conflict: choice ${key} changed since inspection.`);
    patch = mergeProjectPatch(choice, patch, base);
    const merged = { ...choice, ...patch, id: choice.id, index: choice.index };
    row.objects[row.objects.indexOf(choice)] = merged;
    await saveProject(projectId, app, storedProject.json);
    return { choice: merged };
  },
});
