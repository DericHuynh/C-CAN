/** Authorized project persistence. All document saves compare the version read. */
import { eq, and, isNull } from "@agent-native/core/db/schema";
import { assertAccess, resolveAccess } from "@agent-native/core/sharing";
import { getDb } from "../db/index.js";
import { projects, type NewProject, type Project } from "../db/schema.js";
import { aclImportImages } from "../../shared/cyoa.js";
import { assertFound } from "../../shared/assert.js";
import { parseAppDocument } from "../../shared/project-document.js";
import type { App } from "../../shared/types.js";
import { externalizeAppImages } from "../media/blob-images.js";
import { mergeProjectEdit, noteProjectEdit } from "./collaboration.js";
import { fail } from "@agent-native/core/action";

/** Role a caller needs on a project for a given action. */
export type ProjectAccessRole = "viewer" | "editor";

/** Minimal access-context shape the action `ctx` satisfies. */
export interface ProjectAccessContext {
  userEmail?: string;
  orgId?: string | null;
  authCapability?: string;
}

/** Load a project row and its parsed + normalized document. */
export async function getProjectOrThrow(
  projectId: string,
  ctx?: ProjectAccessContext,
  minRole: ProjectAccessRole | "none" = "editor",
): Promise<{ row: Project; app: App }> {
  // Enforce the sharing model on every action that touches a project: reads
  // pass "viewer", mutations default to "editor". "none" is for internal
  // callers that do their own fine-grained resolution (project-resources.ts).
  // The ctx keeps direct `action.run(params, ctx)` callers (scripts, tests)
  // working — HTTP and agent tool calls resolve it from the request context.
  if (minRole !== "none") {
    await assertAccess(
      "project",
      projectId,
      minRole,
      ctx ? { ...ctx, orgId: ctx.orgId ?? undefined } : undefined,
    );
  }
  const db = getDb();
  const [row] = await db.select().from(projects).where(eq(projects.id, projectId));
  assertFound(row, `Project "${projectId}" not found`);
  return { row, app: parseAppDocument(row.json) };
}

/** Persist a document back to the project row and bump `updatedAt`. */
export async function saveProject(
  projectId: string,
  app: App,
  expectedJson: string,
  metadata?: Partial<Pick<Project, "title" | "description">>,
  options: { merge?: boolean } = {},
): Promise<void> {
  assertFound(
    typeof expectedJson === "string",
    "A document read version is required before saving.",
  );
  // All mutation actions share this boundary, including image updates and
  // whole-document patches containing legacy inline image references.
  await externalizeAppImages(aclImportImages(app));
  const db = getDb();
  let baseline = expectedJson;
  let merged = app;
  for (let attempt = 0; attempt < 4; attempt++) {
    const changed = await db
      .update(projects)
      .set({ ...metadata, json: JSON.stringify(merged), updatedAt: new Date().toISOString() })
      .where(and(eq(projects.id, projectId), eq(projects.json, baseline)))
      .returning({ id: projects.id, ownerEmail: projects.ownerEmail, orgId: projects.orgId });
    if (changed.length) {
      noteProjectEdit(changed[0]);
      return;
    }
    // Checkpoint restores replace metadata and content together and stay strict.
    if (metadata || options.merge === false) break;
    const [latest] = await db.select().from(projects).where(eq(projects.id, projectId));
    assertFound(latest, `Project "${projectId}" no longer exists`);
    merged = mergeProjectEdit(parseAppDocument(expectedJson), app, parseAppDocument(latest.json));
    baseline = latest.json;
  }
  fail("Project changed while saving. Review the latest project and retry.", {
    statusCode: 409,
    errorCode: "project_edit_conflict",
  });
}

/** Values shared by every row insert (create/duplicate/import). */
export function newProjectRow(
  overrides: Partial<NewProject> & { id: string; json: string },
): Project {
  const now = new Date().toISOString();
  return {
    id: overrides.id,
    title: overrides.title ?? "Untitled CYOA",
    description: overrides.description ?? "",
    json: overrides.json,
    ownerEmail: overrides.ownerEmail ?? null,
    orgId: overrides.orgId ?? null,
    visibility: overrides.visibility ?? "private",
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    isSeed: overrides.isSeed ?? 0,
  };
}

/** Insert a new private document after the action has assigned its caller's identity. */
export async function insertProject(row: Project): Promise<void> {
  await getDb().insert(projects).values(row);
}

/** Metadata edits are scoped separately from document replacement. */
export async function updateProjectMetadata(
  projectId: string,
  patch: { title?: string; description?: string },
  baseline?: Pick<Project, "title" | "description">,
) {
  const [updated] = await getDb()
    .update(projects)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(projects.id, projectId),
        ...(baseline
          ? [
              ...(patch.title !== undefined ? [eq(projects.title, baseline.title)] : []),
              ...(patch.description !== undefined
                ? [
                    baseline.description === null
                      ? isNull(projects.description)
                      : eq(projects.description, baseline.description),
                  ]
                : []),
            ]
          : []),
      ),
    )
    .returning();
  if (!updated)
    fail("Project metadata changed while saving. Review the latest values and retry.", {
      statusCode: 409,
      errorCode: "project_edit_conflict",
    });
  noteProjectEdit(updated);
  return updated;
}

/** Only called after the action's editor access check. */
export async function deleteProjectRecord(projectId: string): Promise<void> {
  await getDb().delete(projects).where(eq(projects.id, projectId));
}

/** Lightweight capability hint for client reconciliation; writes still assert access. */
export async function canEditProject(projectId: string, ctx?: ProjectAccessContext) {
  const access = await resolveAccess(
    "project",
    projectId,
    ctx ? { ...ctx, orgId: ctx.orgId ?? undefined } : undefined,
    { skipResourceBody: true },
  );
  return !!access && ["owner", "admin", "editor"].includes(access.role);
}
