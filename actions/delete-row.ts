import { projectAudit } from "./_project-audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound, getProjectOrThrow, reindexRows, saveProject } from "./_project-store.js";

export default defineAction({
  audit: projectAudit,
  description: "Delete a row from a CYOA project and re-index the remaining rows.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    rowId: z.string().describe("Row id"),
  }),
  run: async ({ projectId, rowId }) => {
    const { app } = await getProjectOrThrow(projectId);
    const index = app.rows.findIndex((r) => r.id === rowId);
    assertFound(index !== -1, `Row "${rowId}" not found in project "${projectId}"`);
    app.rows.splice(index, 1);
    reindexRows(app.rows);
    await saveProject(projectId, app);
    return { ok: true };
  },
});
