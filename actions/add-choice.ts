import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { createDefaultChoice } from "../shared/cyoa.js";
import { assertFound, getProjectOrThrow, reindexChoices, saveProject } from "./_project-store.js";

export default defineAction({
  description:
    "Add a new choice to a row at the given index (default: end) and return it. Accepts optional `fields` so the choice is created fully-formed in one call: title, text, image, template, objectWidth, scores, groups, requireds, imageVariants, styling, addons, and any ChoiceFunc keys — no follow-up update-choice needed. `scores` entries are { id: <pointTypeId>, value: <number> }.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    rowId: z.string().describe("Row id"),
    index: z.number().int().min(0).optional().describe("Insert position; defaults to the end"),
    fields: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        "Choice fields to set at creation (title, text, image, template, objectWidth, scores, groups, requireds, imageVariants, styling, addons, …). `id` is always generated.",
      ),
  }),
  run: async ({ projectId, rowId, index, fields }) => {
    const { app } = await getProjectOrThrow(projectId);
    const row = app.rows.find((r) => r.id === rowId);
    assertFound(row, `Row "${rowId}" not found in project "${projectId}"`);
    const insertAt = index ?? row.objects.length;
    const choice = createDefaultChoice(app, insertAt);
    if (fields) {
      const { id: _id, ...overrides } = fields;
      Object.assign(choice, overrides);
    }
    row.objects.splice(insertAt, 0, choice);
    reindexChoices(row.objects);
    await saveProject(projectId, app);
    return { choice };
  },
});
