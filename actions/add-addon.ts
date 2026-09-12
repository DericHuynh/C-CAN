import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { projectAudit } from "../server/projects/audit.js";
import { executeProjectBuild } from "../server/projects/workflow.js";
export default defineAction({
  description:
    "Add one addon with a stable ID and parent target without replacing the choice's addon array. For a set of addons use add-addons or build-project.",
  schema: z.object({
    projectId: z.string(),
    choiceId: z.string(),
    id: z.string().optional(),
    fields: z.record(z.string(), z.unknown()).optional(),
    expectedRevision: z.string().optional(),
  }),
  audit: projectAudit,
  run: ({ projectId, choiceId, id, fields, expectedRevision }, ctx) =>
    executeProjectBuild(
      {
        projectId,
        expectedRevision,
        operations: [{ op: "create", kind: "addon", parent: choiceId, id, fields }],
      },
      ctx,
    ),
});
