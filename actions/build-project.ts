import { previewOptionsSchema, previewProject } from "../server/viewer/preview.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { operationSchema } from "../shared/project-workflow.js";
import { executeProjectBuild } from "../server/projects/workflow.js";
import { projectAudit } from "../server/projects/audit.js";

export default defineAction({
  description:
    "Atomic CYOA build/edit workflow: scaffold a new project or add a complete section, choice set, scores, requirements and addons in one batch. Use semantic IDs, unique titles or $aliases (including forward references). Validate before one compare-and-save; no partial document writes. Returns compact manifest and validation. Use dryRun to review, or preview:{} to build, verify, open and capture in one call. inspect-project supplies expectedRevision. Never replay committed operations if preview later fails.",
  schema: z.object({
    preview: previewOptionsSchema.optional(),
    projectId: z.string().optional(),
    title: z.string().max(200).optional(),
    expectedRevision: z.string().optional(),
    dryRun: z.boolean().optional(),
    operations: z.array(operationSchema).min(1).max(250),
  }),
  audit: {
    ...projectAudit,
    summary: (_args, result) =>
      String((result as { summary?: string })?.summary ?? "CYOA build batch"),
  },
  run: async (args, ctx) => {
    const result = await executeProjectBuild(args, ctx);
    if (!result.committed || !result.projectId || !args.preview) return result;
    try {
      const preview = await previewProject({ ...args.preview, projectId: result.projectId }, ctx);
      const { _agentImages, ...status } = preview as typeof preview & { _agentImages?: unknown[] };
      return { ...result, preview: status, ...(_agentImages ? { _agentImages } : {}) };
    } catch (error) {
      return {
        ...result,
        preview: {
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        },
        retry: "Content committed. Retry preview-project only; do not replay the mutation batch.",
      };
    }
  },
});
