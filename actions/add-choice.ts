import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { createDefaultChoice } from "../shared/cyoa.js";
import { assertFound, getProjectOrThrow, reindexChoices, saveProject } from "./_project-store.js";

export default defineAction({
  description:
    "Add a new choice to a row at the given index (default: end) and return it.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    rowId: z.string().describe("Row id"),
    index: z.number().int().min(0).optional().describe("Insert position; defaults to the end"),
  }),
  run: async ({ projectId, rowId, index }) => {
    const { app } = await getProjectOrThrow(projectId);
    const row = app.rows.find((r) => r.id === rowId);
    assertFound(row, `Row "${rowId}" not found in project "${projectId}"`);
    const insertAt = index ?? row.objects.length;
    const choice = createDefaultChoice(app, insertAt);
    row.objects.splice(insertAt, 0, choice);
    reindexChoices(row.objects);
    await saveProject(projectId, app);
    return { choice };
  },
});
