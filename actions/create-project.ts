import { projectCreated } from "../server/agent/project-events.js";
import { projectAudit } from "./_project-audit.js";
import { randomUUID } from "node:crypto";

import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import { projects } from "../server/db/schema.js";
import { createDefaultApp } from "../shared/cyoa.js";
import { newProjectRow, toProjectDetail } from "./_project-store.js";

export default defineAction({
  audit: projectAudit,
  description:
    "Create a new CYOA project from the default document template and return the full project shape.",
  schema: z.object({
    title: z.string().optional().describe('List title; defaults to "Untitled CYOA"'),
    description: z.string().optional().describe("Optional description"),
  }),
  run: async ({ title, description }, ctx) => {
    const app = createDefaultApp();
    const row = newProjectRow({
      id: randomUUID(),
      title,
      description,
      json: JSON.stringify(app),
      // Claim the request identity so sharing/history/review access checks
      // recognize the creator as owner.
      ownerEmail: ctx?.userEmail ?? null,
      orgId: ctx?.orgId ?? null,
    });
    const db = getDb();
    await db.insert(projects).values(row);
    projectCreated(row.id, "create", ctx);
    return toProjectDetail(row, app);
  },
});
