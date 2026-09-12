import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { publicationFields } from "../shared/publications.js";
import { publishProject } from "../server/publishing/repository.js";
import { projectAudit } from "../server/projects/audit.js";
export default defineAction({
  description:
    "Publish or update a public, playable snapshot in the ICYOA Explorer. Owner only. Removes planning drafts/notes; leaves draft sharing unchanged. Overall reader ratings are independent of category ratings.",
  schema: publicationFields.extend({ projectId: z.string().min(1) }),
  needsApproval: true,
  toolCallable: false,
  audit: projectAudit,
  link: ({ result }) => ({ url: result.url, label: "Play published CYOA", view: "play" }),
  run: async ({ projectId, ...fields }, ctx) => publishProject(projectId, fields, ctx),
});
