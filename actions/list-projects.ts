import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { desc } from "./_drizzle.js";

import { getDb } from "../server/db/index.js";
import { projects } from "../server/db/schema.js";
import { toProjectSummary } from "./_project-store.js";

export default defineAction({
  description:
    "List all CYOA projects as lightweight summaries (id, title, counts), ordered by most recently updated first.",
  schema: z.object({}),
  http: { method: "GET" },
  run: async () => {
    const db = getDb();
    const rows = await db.select().from(projects).orderBy(desc(projects.updatedAt));
    return { projects: rows.map((row) => toProjectSummary(row)) };
  },
});
