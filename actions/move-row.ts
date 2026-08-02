import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound, getProjectOrThrow, reindexRows, saveProject } from "./_project-store.js";

export default defineAction({
  description: "Move a row to a new 0-based index in its project and re-index all rows.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    rowId: z.string().describe("Row id"),
    index: z.number().int().min(0).describe("Target 0-based position"),
  }),
  run: async ({ projectId, rowId, index }) => {
    const { app } = await getProjectOrThrow(projectId);
    const from = app.rows.findIndex((r) => r.id === rowId);
    assertFound(from !== -1, `Row "${rowId}" not found in project "${projectId}"`);
    const [row] = app.rows.splice(from, 1);
    const to = Math.min(Math.max(index, 0), app.rows.length);
    app.rows.splice(to, 0, row);
    reindexRows(app.rows);
    await saveProject(projectId, app);
    return { ok: true };
  },
});
