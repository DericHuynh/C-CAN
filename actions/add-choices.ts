import { projectAudit } from "./_project-audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { createDefaultChoice } from "../shared/cyoa.js";
import { assertFound, getProjectOrThrow, reindexChoices, saveProject } from "./_project-store.js";

const choiceSpec = z.object({
  index: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Insert position in the row's current choices; defaults to the end"),
  fields: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Choice fields to set at creation (title, text, image, template, objectWidth, scores, groups, requireds, imageVariants, styling, addons, …). `id` is always generated.",
    ),
});

export default defineAction({
  audit: projectAudit,
  description:
    "Bulk-create many choices inside one row in a single call (much cheaper than repeated add-choice calls). Each spec inserts one choice at `index` (or the end) with the given `fields` — ideal for filling a row with a full set of options at once. Returns all created choices.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    rowId: z.string().describe("Row id to add the choices to"),
    choices: z
      .array(choiceSpec)
      .min(1)
      .describe(
        "Choice specs to create, in order. Consecutive specs without `index` append at the end.",
      ),
  }),
  run: async ({ projectId, rowId, choices }) => {
    const { app } = await getProjectOrThrow(projectId);
    const row = app.rows.find((r) => r.id === rowId);
    assertFound(row, `Row "${rowId}" not found in project "${projectId}"`);
    const created: ReturnType<typeof createDefaultChoice>[] = [];
    for (const spec of choices) {
      const insertAt = spec.index ?? row.objects.length;
      const choice = createDefaultChoice(app, insertAt);
      if (spec.fields) {
        const { id: _id, ...overrides } = spec.fields;
        Object.assign(choice, overrides);
      }
      row.objects.splice(insertAt, 0, choice);
      created.push(choice);
    }
    reindexChoices(row.objects);
    await saveProject(projectId, app);
    return { choices: created };
  },
});
