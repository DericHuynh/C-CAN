import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound, getProjectOrThrow, reindexChoices, saveProject } from "./_project-store.js";

export default defineAction({
  description: "Move a choice to a new 0-based index within its row and re-index the row's choices.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    rowId: z.string().describe("Row id"),
    choiceId: z.string().describe("Choice id"),
    index: z.number().int().min(0).describe("Target 0-based position"),
  }),
  run: async ({ projectId, rowId, choiceId, index }) => {
    const { app } = await getProjectOrThrow(projectId);
    const row = app.rows.find((r) => r.id === rowId);
    assertFound(row, `Row "${rowId}" not found in project "${projectId}"`);
    const from = row.objects.findIndex((c) => c.id === choiceId);
    assertFound(from !== -1, `Choice "${choiceId}" not found in row "${rowId}"`);
    const [choice] = row.objects.splice(from, 1);
    const to = Math.min(Math.max(index, 0), row.objects.length);
    row.objects.splice(to, 0, choice);
    reindexChoices(row.objects);
    await saveProject(projectId, app);
    return { ok: true };
  },
});
