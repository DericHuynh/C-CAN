import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { projectAudit } from "../server/projects/audit.js";
import { executeProjectBuild } from "../server/projects/workflow.js";
export default defineAction({
  description:
    "Atomically add a set of addons across choices. Validates every parent/reference before saving once. No partial array replacements; returns IDs, parents and validation.",
  schema: z.object({
    projectId: z.string(),
    expectedRevision: z.string().optional(),
    addons: z
      .array(
        z.object({
          choiceId: z.string(),
          id: z.string().optional(),
          fields: z.record(z.string(), z.unknown()).optional(),
        }),
      )
      .min(1)
      .max(250),
  }),
  audit: {
    ...projectAudit,
    summary: (_args, result) => String((result as { summary?: string }).summary ?? "Added addons"),
  },
  run: ({ projectId, expectedRevision, addons }, ctx) =>
    executeProjectBuild(
      {
        projectId,
        expectedRevision,
        operations: addons.map(({ choiceId, id, fields }) => ({
          op: "create",
          kind: "addon",
          parent: choiceId,
          id,
          fields,
        })),
      },
      ctx,
    ),
});
