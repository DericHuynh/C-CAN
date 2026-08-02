import { randomUUID } from "node:crypto";

import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import { projects } from "../server/db/schema.js";
import { createDefaultApp } from "../shared/cyoa.js";
import { newProjectRow, toProjectDetail } from "./_project-store.js";

export default defineAction({
  description:
    "Create a new CYOA project from the default document template and return the full project shape.",
  schema: z.object({
    title: z.string().optional().describe('List title; defaults to "Untitled CYOA"'),
    description: z.string().optional().describe("Optional description"),
  }),
  run: async ({ title, description }) => {
    const app = createDefaultApp();
    const row = newProjectRow({
      id: randomUUID(),
      title,
      description,
      json: JSON.stringify(app),
    });
    const db = getDb();
    await db.insert(projects).values(row);
    return toProjectDetail(row, app);
  },
});
