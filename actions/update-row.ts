import { editBaseSchema, mergeProjectPatch } from "../server/projects/collaboration.js";
import { projectAudit } from "../server/projects/audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound } from "../shared/assert.js";
import { getProjectOrThrow, saveProject } from "../server/projects/repository.js";

export default defineAction({
  audit: projectAudit,
  description:
    "Shallow-merge a patch into a row's fields (id and index are preserved). Returns the updated row.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    rowId: z.string().describe("Row id"),
    base: editBaseSchema,
    patch: z.record(z.string(), z.unknown()).describe("Fields to merge into the row"),
  }),
  run: async ({ projectId, rowId, patch, base }, ctx) => {
    const { app, row: storedProject } = await getProjectOrThrow(projectId, ctx, "editor");
    const row = app.rows.find((r) => r.id === rowId);
    assertFound(row, `Row "${rowId}" not found in project "${projectId}"`);
    patch = mergeProjectPatch(row, patch, base);
    const merged = { ...row, ...patch, id: row.id, index: row.index };
    app.rows[app.rows.indexOf(row)] = merged;
    await saveProject(projectId, app, storedProject.json);
    return { row: merged };
  },
});
