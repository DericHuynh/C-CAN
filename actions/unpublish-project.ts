import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { unpublishProject } from "../server/publishing/repository.js";
import { projectAudit } from "../server/projects/audit.js";
export default defineAction({
  description:
    "Withdraw a CYOA from the public Explorer and disable its playable link. Owner only; preserves the draft and ratings for a later release.",
  schema: z.object({ projectId: z.string().min(1) }),
  toolCallable: false,
  audit: projectAudit,
  run: async ({ projectId }, ctx) => unpublishProject(projectId, ctx),
});
