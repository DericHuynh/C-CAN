import { projectAudit } from "../server/projects/audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound } from "../shared/assert.js";
import { getProjectOrThrow, saveProject } from "../server/projects/repository.js";
import { reindexRows } from "../shared/collections.js";

export default defineAction({
  audit: projectAudit,
  description: "Move a row to a new 0-based index in its project and re-index all rows.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    rowId: z.string().describe("Row id"),
    index: z.number().int().min(0).describe("Target 0-based position"),
  }),
  run: async ({ projectId, rowId, index }, ctx) => {
    const { app, row: storedProject } = await getProjectOrThrow(projectId, ctx, "editor");
    const from = app.rows.findIndex((r) => r.id === rowId);
    assertFound(from !== -1, `Row "${rowId}" not found in project "${projectId}"`);
    const [row] = app.rows.splice(from, 1);
    const to = Math.min(Math.max(index, 0), app.rows.length);
    app.rows.splice(to, 0, row);
    reindexRows(app.rows);
    await saveProject(projectId, app, storedProject.json);
    return { ok: true };
  },
});
