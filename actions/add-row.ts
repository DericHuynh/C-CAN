import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { createDefaultRow } from "../shared/cyoa.js";
import { getProjectOrThrow, reindexRows, saveProject } from "./_project-store.js";

export default defineAction({
  description:
    "Add a new row to a CYOA project at the given index (default: end) and return it. Accepts optional `fields` so the row is created fully-formed in one call: title, titleText, objectWidth, image, template, allowedChoices, rowJustify, requireds, styling, groups, and the row-kind flags (isInfoRow / isResultRow / isGroupRow / isButtonRow) — no follow-up update-row needed. Pass an existing row's `styling` object to match the project's look.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    index: z.number().int().min(0).optional().describe("Insert position; defaults to the end"),
    fields: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Row fields to set at creation (title, titleText, objectWidth, image, template, allowedChoices, rowJustify, requireds, styling, groups, isInfoRow, isResultRow, isGroupRow, isButtonRow, …). `id` is always generated."),
  }),
  run: async ({ projectId, index, fields }) => {
    const { app } = await getProjectOrThrow(projectId);
    const insertAt = index ?? app.rows.length;
    const row = createDefaultRow(app, insertAt);
    if (fields) {
      const { id: _id, ...overrides } = fields;
      Object.assign(row, overrides);
    }
    app.rows.splice(insertAt, 0, row);
    reindexRows(app.rows);
    await saveProject(projectId, app);
    return { row };
  },
});
