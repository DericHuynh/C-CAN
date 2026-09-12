import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { projectAudit } from "../server/projects/audit.js";
import { executeProjectBuild } from "../server/projects/workflow.js";
export default defineAction({
  description:
    "Patch one addon by stable ID or unambiguous title. Preserves all siblings and unrelated fields. Pass expected values or expectedRevision from inspection to reject stale edits.",
  schema: z.object({
    projectId: z.string(),
    addonId: z.string(),
    patch: z.record(z.string(), z.unknown()),
    expected: z.record(z.string(), z.unknown()).optional(),
    expectedRevision: z.string().optional(),
  }),
  audit: projectAudit,
  run: ({ projectId, addonId, patch, expected, expectedRevision }, ctx) =>
    executeProjectBuild(
      {
        projectId,
        expectedRevision,
        operations: [{ op: "update", kind: "addon", id: addonId, fields: patch, expected }],
      },
      ctx,
    ),
});
