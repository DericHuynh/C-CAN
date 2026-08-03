import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound, getProjectOrThrow, reindexChoices, saveProject } from "./_project-store.js";

export default defineAction({
  description:
    "Move a choice to a new 0-based index in the target row (its current row when reordering, or another row to reparent it) and re-index both rows' choices.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    rowId: z.string().describe("Target row id"),
    choiceId: z.string().describe("Choice id"),
    index: z
      .number()
      .int()
      .min(0)
      .describe("Target 0-based position in the target row (after removal)"),
  }),
  run: async ({ projectId, rowId, choiceId, index }) => {
    const { app } = await getProjectOrThrow(projectId);
    const targetRow = app.rows.find((r) => r.id === rowId);
    assertFound(targetRow, `Row "${rowId}" not found in project "${projectId}"`);
    // The choice may live in any row — find its source row, then splice it out
    // and into the target row (same row for plain reordering).
    const sourceRow = app.rows.find((r) => r.objects.some((c) => c.id === choiceId));
    assertFound(sourceRow, `Choice "${choiceId}" not found in project "${projectId}"`);
    const from = sourceRow.objects.findIndex((c) => c.id === choiceId);
    const [choice] = sourceRow.objects.splice(from, 1);
    const to = Math.min(Math.max(index, 0), targetRow.objects.length);
    targetRow.objects.splice(to, 0, choice);
    reindexChoices(sourceRow.objects);
    reindexChoices(targetRow.objects);
    await saveProject(projectId, app);
    return { ok: true };
  },
});
