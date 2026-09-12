import { projectAudit } from "../server/projects/audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound } from "../shared/assert.js";
import { getProjectOrThrow, saveProject } from "../server/projects/repository.js";
import { reindexChoices } from "../shared/collections.js";

export default defineAction({
  audit: projectAudit,
  description: "Delete a choice from a row and re-index the row's remaining choices.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    rowId: z.string().describe("Row id"),
    choiceId: z.string().describe("Choice id"),
  }),
  run: async ({ projectId, rowId, choiceId }, ctx) => {
    const { app, row: storedProject } = await getProjectOrThrow(projectId, ctx, "editor");
    const row = app.rows.find((r) => r.id === rowId);
    assertFound(row, `Row "${rowId}" not found in project "${projectId}"`);
    const index = row.objects.findIndex((c) => c.id === choiceId);
    assertFound(index !== -1, `Choice "${choiceId}" not found in row "${rowId}"`);
    row.objects.splice(index, 1);
    reindexChoices(row.objects);
    await saveProject(projectId, app, storedProject.json);
    return { ok: true };
  },
});
