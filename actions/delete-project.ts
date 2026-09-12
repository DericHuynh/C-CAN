import { deleteProjectRecord } from "../server/projects/repository.js";
import { projectAudit } from "../server/projects/audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getProjectOrThrow } from "../server/projects/repository.js";

export default defineAction({
  audit: projectAudit,
  description: "Delete a CYOA project and its document row (owner/editor only).",
  schema: z.object({
    id: z.string().describe("Project id"),
  }),
  run: async ({ id }, ctx) => {
    // getProjectOrThrow enforces editor access before the delete.
    await getProjectOrThrow(id, ctx, "editor");
    await deleteProjectRecord(id);
    return { ok: true };
  },
});
