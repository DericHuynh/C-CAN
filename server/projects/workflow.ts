import { randomUUID } from "node:crypto";
import type { ActionRunContext } from "@agent-native/core/action";
import { createDefaultApp } from "../../shared/cyoa.js";
import { buildProjectDocument } from "../../shared/project-builder.js";
import type { BuildOperation } from "../../shared/project-workflow.js";
import { getProjectOrThrow, insertProject, newProjectRow, saveProject } from "./repository.js";
import { projectCreated } from "./events.js";
import { externalizeAppImages } from "../media/blob-images.js";
import { aclImportImages } from "../../shared/cyoa.js";
import { projectRevision } from "./revision.js";
export { projectRevision } from "./revision.js";

export async function executeProjectBuild(
  input: {
    projectId?: string;
    title?: string;
    expectedRevision?: string;
    operations: BuildOperation[];
    dryRun?: boolean;
  },
  ctx?: ActionRunContext,
) {
  if (!ctx?.userEmail) throw new Error("Sign in to build a project.");
  const stored = input.projectId
    ? await getProjectOrThrow(input.projectId, ctx, "editor")
    : undefined;
  if (
    stored &&
    input.expectedRevision &&
    input.expectedRevision !== projectRevision(stored.row.json)
  )
    return {
      status: "conflict" as const,
      committed: false,
      projectId: stored.row.id,
      summary: "Project changed since inspection; reload and reconcile before retrying.",
      retry: "read-latest-and-reconcile",
    };
  const original = stored?.app ?? createDefaultApp();
  if (!stored) original.viewerConfig.title = input.title ?? "Untitled CYOA";
  let built: ReturnType<typeof buildProjectDocument>;
  try {
    built = buildProjectDocument(original, input.operations);
  } catch (error) {
    return {
      status: "rejected" as const,
      committed: false,
      projectId: input.projectId,
      summary: error instanceof Error ? error.message : String(error),
      succeeded: [],
      rollback: "not-needed-no-document-writes",
      failedOperation:
        error instanceof Error && /^Operation (\d+):/.test(error.message)
          ? Number(error.message.match(/^Operation (\d+):/)![1])
          : undefined,
      failedOperations: "No operations committed. The entire batch was rejected.",
      retry: "correct-input-and-retry",
    };
  }
  const report = {
    ...built.validation,
    issues: built.validation.issues.slice(0, 100),
    references: undefined,
    omittedIssues: Math.max(0, built.validation.issues.length - 100),
  };
  if (built.introducedErrors.length)
    return {
      status: "rejected" as const,
      committed: false,
      projectId: input.projectId,
      summary: `Batch introduces ${built.introducedErrors.length} validation errors; no operations committed.`,
      validation: report,
      rollback: "not-needed-no-document-writes",
      retry: "correct-input-and-retry",
    };
  const projectId = stored?.row.id ?? randomUUID();
  const summary = `${input.dryRun ? "Would apply" : "Applied"} ${built.changes.length} operations: ${built.changes.filter((c) => c.op === "create").length} created, ${built.changes.filter((c) => c.op === "update").length} updated, ${built.changes.filter((c) => c.op === "delete").length} deleted; ${built.validation.references.length} references checked; ${built.validation.warnings} warnings; ${built.validation.errors} existing errors remain.`;
  if (!input.dryRun) {
    if (stored)
      await saveProject(projectId, built.app, stored.row.json, undefined, { merge: false });
    else {
      await externalizeAppImages(aclImportImages(built.app));
      await insertProject(
        newProjectRow({
          id: projectId,
          title: input.title,
          ownerEmail: ctx.userEmail,
          orgId: ctx.orgId ?? null,
          json: JSON.stringify(built.app),
        }),
      );
      projectCreated(projectId, "create", ctx);
    }
  }
  return {
    status: input.dryRun ? ("validated" as const) : ("committed" as const),
    committed: !input.dryRun,
    projectId: input.dryRun && !stored ? undefined : projectId,
    summary,
    manifest: built.changes.map((change) => ({
      ...change,
      target:
        change.op === "delete" || (input.dryRun && !stored)
          ? undefined
          : { projectId, ...change.target },
    })),
    aliases: built.aliases,
    revision: projectRevision(JSON.stringify(built.app)),
    validation: report,
    retry: input.dryRun ? "submit-to-commit" : "do-not-replay-committed-operations",
  };
}
