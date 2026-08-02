import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { eq } from "./_drizzle.js";

import { getDb } from "../server/db/index.js";
import { projects } from "../server/db/schema.js";
import { assertFound } from "./_project-store.js";

export default defineAction({
  description: "Delete a CYOA project and its document row.",
  schema: z.object({
    id: z.string().describe("Project id"),
  }),
  run: async ({ id }) => {
    const db = getDb();
    const [row] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, id));
    assertFound(row, `Project "${id}" not found`);
    await db.delete(projects).where(eq(projects.id, id));
    return { ok: true };
  },
});
