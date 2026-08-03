import { randomUUID } from "node:crypto";

import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import { projects } from "../server/db/schema.js";
import { getProjectOrThrow, newProjectRow, toProjectDetail } from "./_project-store.js";

export default defineAction({
  description:
    'Duplicate an existing project: same document under a fresh id, title suffixed with " (Copy)", never a seed.',
  schema: z.object({
    id: z.string().describe("Project id to duplicate"),
  }),
  run: async ({ id }) => {
    const { row, app } = await getProjectOrThrow(id);
    const copy = newProjectRow({
      id: randomUUID(),
      title: `${row.title} (Copy)`,
      description: row.description ?? "",
      ownerEmail: row.ownerEmail,
      orgId: row.orgId,
      json: JSON.stringify(app),
      isSeed: false,
    });
    const db = getDb();
    await db.insert(projects).values(copy);
    return toProjectDetail(copy, app);
  },
});
