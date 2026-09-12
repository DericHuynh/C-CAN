import { projectAudit } from "../server/projects/audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { createDefaultRow } from "../shared/cyoa.js";
import { getProjectOrThrow, saveProject } from "../server/projects/repository.js";
import { reindexRows } from "../shared/collections.js";

const rowSpec = z.object({
  index: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Insert position in the current rows array; defaults to the end"),
  fields: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Row fields to set at creation (title, titleText, objectWidth, image, template, allowedChoices, rowJustify, requireds, styling, groups, isInfoRow, isResultRow, isGroupRow, isButtonRow, …). `id` is always generated.",
    ),
});

export default defineAction({
  audit: projectAudit,
  description:
    "Bulk-create many rows in one call (much cheaper than repeated add-row calls). Each spec inserts one row at `index` (or the end) with the given `fields`, so a whole CYOA section can be scaffolded in a single action. Returns all created rows. Use add-choices (or `fields.objects` with pre-built choices) to fill them.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    rows: z
      .array(rowSpec)
      .min(1)
      .describe(
        "Row specs to create, in order. Consecutive specs without `index` append at the end.",
      ),
  }),
  run: async ({ projectId, rows }, ctx) => {
    const { app, row: storedProject } = await getProjectOrThrow(projectId, ctx, "editor");
    const created: ReturnType<typeof createDefaultRow>[] = [];
    for (const spec of rows) {
      const insertAt = spec.index ?? app.rows.length;
      const row = createDefaultRow(app, insertAt);
      if (spec.fields) {
        const { id: _id, ...overrides } = spec.fields;
        Object.assign(row, overrides);
      }
      app.rows.splice(insertAt, 0, row);
      created.push(row);
    }
    reindexRows(app.rows);
    await saveProject(projectId, app, storedProject.json);
    return { rows: created };
  },
});
