import { insertProject } from "../server/projects/repository.js";
import { projectCreated } from "../server/projects/events.js";
import { projectAudit } from "../server/projects/audit.js";
import { randomUUID } from "node:crypto";

import { defineAction } from "@agent-native/core/action";
import { notify } from "@agent-native/core/notifications";
import { z } from "zod";

import { assertFound } from "../shared/assert.js";
import { getProjectOrThrow, newProjectRow } from "../server/projects/repository.js";
import { toProjectDetail } from "../server/projects/presentation.js";

export default defineAction({
  audit: projectAudit,
  description:
    'Duplicate an existing project: same document under a fresh id, title suffixed with " (Copy)", never a seed.',
  schema: z.object({
    id: z.string().describe("Project id to duplicate"),
  }),
  run: async ({ id }, ctx) => {
    const ownerEmail = ctx?.userEmail;
    assertFound(ownerEmail, "Sign in before duplicating a project.");
    const { row, app } = await getProjectOrThrow(id, ctx, "viewer");
    const copy = newProjectRow({
      id: randomUUID(),
      title: `${row.title} (Copy)`,
      description: row.description ?? "",
      // A copy is a new, private resource belonging to its creator. Source
      // access allows reading, not claiming ownership for another user/org.
      ownerEmail,
      orgId: ctx?.orgId ?? null,
      json: JSON.stringify(app),
      isSeed: 0,
    });
    await insertProject(copy);
    projectCreated(copy.id, "duplicate", ctx);
    // Best-effort bell notification for the new copy.
    if (ctx?.userEmail) {
      try {
        await notify(
          {
            severity: "info",
            title: "Project duplicated",
            body: `"${row.title}" was duplicated as "${copy.title}".`,
          },
          { owner: ctx.userEmail },
        );
      } catch {
        // Notifications are best-effort.
      }
    }
    return toProjectDetail(copy, app);
  },
});
