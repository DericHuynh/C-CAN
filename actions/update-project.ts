import { projectAudit } from "./_project-audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { eq } from "./_drizzle.js";

import { getDb } from "../server/db/index.js";
import { projects, type NewProject } from "../server/db/schema.js";
import { getProjectOrThrow, toProjectSummary } from "./_project-store.js";

export default defineAction({
  audit: projectAudit,
  description:
    "Update a project's metadata only (title/description). The CYOA document itself is left untouched.",
  schema: z.object({
    id: z.string().describe("Project id"),
    title: z.string().optional().describe("New list title"),
    description: z.string().optional().describe("New description"),
  }),
  run: async ({ id, title, description }) => {
    const { app } = await getProjectOrThrow(id);
    const patch: Partial<NewProject> = { updatedAt: new Date().toISOString() };
    if (title !== undefined) patch.title = title;
    if (description !== undefined) patch.description = description;

    const db = getDb();
    await db.update(projects).set(patch).where(eq(projects.id, id));
    const [updated] = await db.select().from(projects).where(eq(projects.id, id));
    return { ok: true, summary: toProjectSummary(updated, app) };
  },
});
