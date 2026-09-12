import { defineAction } from "@agent-native/core/action";
import { assertAccess } from "@agent-native/core/sharing";
import { z } from "zod";
import { queryAuditEvents } from "@agent-native/core/audit";

/**
 * Read Core's exact resource audit index, scoped to the caller and active org.
 * The execution ledger is private agent runtime state, not a resource history:
 * substring searches can match another project's content and miss UI edits.
 */
export default defineAction({
  description:
    "List recent audited UI and agent mutations for this exact project, scoped to your identity and active organization. Older edits without project audit labels are not included. Inspect current content to verify results.",
  readOnly: true,
  // Authenticated read exposure for external MCP/A2A hosts.
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  schema: z.object({
    projectId: z.string().describe("Project id"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Max entries to return (default 50)"),
  }),
  run: async ({ projectId, limit }, ctx) => {
    // Resource access and audit visibility are both required.
    await assertAccess(
      "project",
      projectId,
      "viewer",
      ctx ? { ...ctx, orgId: ctx.orgId ?? undefined } : undefined,
    );
    const rows = await queryAuditEvents(
      { userEmail: ctx?.userEmail, orgId: ctx?.orgId ?? undefined },
      { targetType: "project", targetId: projectId, limit: limit ?? 50 },
    );
    const changes = rows.map((entry) => ({
      action: entry.action,
      threadId: entry.threadId,
      completedAt: entry.createdAt,
      summary: entry.summary?.slice(0, 500) ?? "",
      actorKind: entry.actorKind,
      status: entry.status,
    }));
    return { projectId, changeCount: changes.length, changes };
  },
});
