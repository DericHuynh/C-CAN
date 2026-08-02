import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { createDefaultRow } from "../shared/cyoa.js";
import { getProjectOrThrow, reindexRows, saveProject } from "./_project-store.js";

export default defineAction({
  description: "Add a new row to a CYOA project at the given index (default: end) and return it.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    index: z.number().int().min(0).optional().describe("Insert position; defaults to the end"),
  }),
  run: async ({ projectId, index }) => {
    const { app } = await getProjectOrThrow(projectId);
    const insertAt = index ?? app.rows.length;
    const row = createDefaultRow(app, insertAt);
    app.rows.splice(insertAt, 0, row);
    reindexRows(app.rows);
    await saveProject(projectId, app);
    return { row };
  },
});
