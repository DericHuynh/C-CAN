import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound, getProjectOrThrow, saveProject } from "./_project-store.js";

export default defineAction({
  description:
    "Shallow-merge a patch into a row's fields (id and index are preserved). Returns the updated row.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    rowId: z.string().describe("Row id"),
    patch: z.record(z.string(), z.unknown()).describe("Fields to merge into the row"),
  }),
  run: async ({ projectId, rowId, patch }) => {
    const { app } = await getProjectOrThrow(projectId);
    const row = app.rows.find((r) => r.id === rowId);
    assertFound(row, `Row "${rowId}" not found in project "${projectId}"`);
    const merged = { ...row, ...patch, id: row.id, index: row.index };
    app.rows[app.rows.indexOf(row)] = merged;
    await saveProject(projectId, app);
    return { row: merged };
  },
});
