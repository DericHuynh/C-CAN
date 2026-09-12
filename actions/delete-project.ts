import { projectAudit } from "./_project-audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { eq } from "./_drizzle.js";

import { getDb } from "../server/db/index.js";
import { projects } from "../server/db/schema.js";
import { getProjectOrThrow } from "./_project-store.js";

export default defineAction({
  audit: projectAudit,
  description: "Delete a CYOA project and its document row (owner/editor only).",
  schema: z.object({
    id: z.string().describe("Project id"),
  }),
  run: async ({ id }, ctx) => {
    // getProjectOrThrow enforces editor access before the delete.
    await getProjectOrThrow(id, ctx, "editor");
    const db = getDb();
    await db.delete(projects).where(eq(projects.id, id));
    return { ok: true };
  },
});
