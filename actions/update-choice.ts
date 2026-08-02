import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound, getProjectOrThrow, saveProject } from "./_project-store.js";

export default defineAction({
  description:
    "Shallow-merge a patch into a choice's fields (id and index are preserved). Returns the updated choice.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    rowId: z.string().describe("Row id"),
    choiceId: z.string().describe("Choice id"),
    patch: z.record(z.string(), z.unknown()).describe("Fields to merge into the choice"),
  }),
  run: async ({ projectId, rowId, choiceId, patch }) => {
    const { app } = await getProjectOrThrow(projectId);
    const row = app.rows.find((r) => r.id === rowId);
    assertFound(row, `Row "${rowId}" not found in project "${projectId}"`);
    const choice = row.objects.find((c) => c.id === choiceId);
    assertFound(choice, `Choice "${choiceId}" not found in row "${rowId}"`);
    const merged = { ...choice, ...patch, id: choice.id, index: choice.index };
    row.objects[row.objects.indexOf(choice)] = merged;
    await saveProject(projectId, app);
    return { choice: merged };
  },
});
