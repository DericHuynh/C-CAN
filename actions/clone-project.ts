import { randomUUID } from "node:crypto";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { copyProjectReference } from "../shared/project-reference.js";
import { getProjectOrThrow, insertProject, newProjectRow } from "../server/projects/repository.js";
import { projectCreated } from "../server/projects/events.js";
import { projectAudit } from "../server/projects/audit.js";
import { projectRevision } from "../server/projects/revision.js";
import { externalizeAppImages } from "../server/media/blob-images.js";
import { aclImportImages } from "../shared/cyoa.js";
export default defineAction({
  description:
    "Create a private reference copy without changing the source. scope=full clones everything; sections copies selected rows plus known dependencies; style copies global styling; mechanics copies core selection/scoring/requirements without prose/art or advanced effects. dryRun reviews the compact row manifest and validation before copying.",
  schema: z.object({
    sourceProjectId: z.string(),
    scope: z.enum(["full", "sections", "style", "mechanics"]).default("full"),
    rowIds: z.array(z.string()).max(100).optional(),
    title: z.string().max(200).optional(),
    dryRun: z.boolean().optional(),
  }),
  audit: {
    ...projectAudit,
    summary: (_args, result) =>
      String((result as { summary?: string }).summary ?? "Copied project reference"),
  },
  run: async ({ sourceProjectId, scope = "full", rowIds, title, dryRun }, ctx) => {
    if (!ctx?.userEmail) throw new Error("Sign in before cloning a project.");
    const { app: source, row } = await getProjectOrThrow(sourceProjectId, ctx, "viewer");
    const copied = copyProjectReference(source, scope, rowIds);
    const copyTitle = title ?? `${row.title} (Copy)`;
    copied.app.viewerConfig.title = copyTitle;
    const projectId = dryRun ? undefined : randomUUID();
    if (projectId) {
      await externalizeAppImages(aclImportImages(copied.app));
      await insertProject(
        newProjectRow({
          id: projectId,
          title: copyTitle,
          json: JSON.stringify(copied.app),
          ownerEmail: ctx.userEmail,
          orgId: ctx.orgId ?? null,
        }),
      );
      projectCreated(projectId, "duplicate", ctx);
    }
    return {
      projectId,
      sourceProjectId,
      committed: !dryRun,
      summary: `${dryRun ? "Would copy" : "Copied"} ${copied.app.rows.length} rows (${scope}) into a private project. Source unchanged.`,
      revision: projectRevision(JSON.stringify(copied.app)),
      notes: copied.notes,
      rows: copied.app.rows
        .slice(0, 100)
        .map((r) => ({ id: r.id, title: r.title, choices: r.objects.length })),
      omittedRows: Math.max(0, copied.app.rows.length - 100),
      validation: {
        errors: copied.validation.errors,
        warnings: copied.validation.warnings,
        issues: copied.validation.issues.slice(0, 50),
        limitations: copied.validation.limitations,
      },
    };
  },
});
