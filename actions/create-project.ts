import { insertProject } from "../server/projects/repository.js";
import { projectCreated } from "../server/projects/events.js";
import { projectAudit } from "../server/projects/audit.js";
import { randomUUID } from "node:crypto";

import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { createDefaultApp } from "../shared/cyoa.js";
import { newProjectRow } from "../server/projects/repository.js";
import { toProjectDetail } from "../server/projects/presentation.js";

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
    await insertProject(row);
    projectCreated(row.id, "create", ctx);
    return toProjectDetail(row, app);
  },
});
