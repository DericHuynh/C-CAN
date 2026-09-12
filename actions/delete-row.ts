import { projectAudit } from "../server/projects/audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound } from "../shared/assert.js";
import { getProjectOrThrow, saveProject } from "../server/projects/repository.js";
import { reindexRows } from "../shared/collections.js";

export default defineAction({
  audit: projectAudit,
  description: "Delete a row from a CYOA project and re-index the remaining rows.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    rowId: z.string().describe("Row id"),
  }),
  run: async ({ projectId, rowId }, ctx) => {
    const { app, row: storedProject } = await getProjectOrThrow(projectId, ctx, "editor");
    const index = app.rows.findIndex((r) => r.id === rowId);
    assertFound(index !== -1, `Row "${rowId}" not found in project "${projectId}"`);
    app.rows.splice(index, 1);
    reindexRows(app.rows);
    await saveProject(projectId, app, storedProject.json);
    return { ok: true };
  },
});
