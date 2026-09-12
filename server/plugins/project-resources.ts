/**
 * Registers the `project` resource type with the framework's sharing, history
 * (versions), and review modules. This is what makes the framework-level
 * actions that are already mounted in this app's registry meaningful:
 *
 * - `share-resource` / `unshare-resource` / `list-resource-shares` /
 *   `set-resource-visibility` (G2 — share/publish CYOAs)
 * - `create-resource-version` / `list-resource-versions` /
 *   `get-resource-version` / `restore-resource-version` (G1 — undo/restore)
 * - `create-review-comment` / `send-review-thread-to-agent` / … (G7 — review)
 *
 * Registrations run at module load (registry-style, like the secrets flow);
 * table bootstrapping runs when Nitro starts.
 */
import { ensureResourceVersionsTable, registerVersionedResource } from "@agent-native/core/history";
import { ensureReviewTables, registerReviewableResource } from "@agent-native/core/review";
import { registerShareableResource } from "@agent-native/core/sharing";
import { getDbExec } from "@agent-native/core/db";
import { getProjectOrThrow, saveProject } from "../../actions/_project-store.js";

import { getDb } from "../db/index.js";
import { normalizeApp, parseProjectDocument } from "../../shared/cyoa.js";
import { z } from "zod";
import { projectShares, projects } from "../db/schema.js";

// --- G2: sharing / publishing ---------------------------------------------
registerShareableResource({
  type: "project",
  resourceTable: projects,
  sharesTable: projectShares,
  displayName: "Project",
  titleColumn: "title",
  getResourcePath: (resource) => `/projects/${encodeURIComponent(resource.id)}/viewer`,
  getDb,
});

// --- G1: version history (snapshot + restore) ------------------------------
registerVersionedResource({
  type: "project",
  displayName: "Project",
  // Reuse Core sharing access, including invitations and organization scope.
  getSnapshot: async ({ resourceId }) => {
    const { row } = await getProjectOrThrow(resourceId, undefined, "none");
    // Snapshot the whole authored payload — the document plus list metadata.
    return { json: row.json, title: row.title, description: row.description };
  },
  restoreSnapshot: async ({ resourceId, snapshot }) => {
    // Reject corrupt/old snapshots before writing anything. Restoring also
    // passes the normal blob boundary so old inline images stay out of SQL.
    const s = z
      .object({
        json: z.string(),
        title: z.string(),
        description: z
          .string()
          .nullish()
          .transform((value) => value ?? ""),
      })
      .parse(snapshot);
    const app = normalizeApp(parseProjectDocument(s.json));
    const { row } = await getProjectOrThrow(resourceId, undefined, "none");
    await saveProject(resourceId, app, row.json, { title: s.title, description: s.description });
  },
});

// --- G7: comments / review ------------------------------------------------
registerReviewableResource({
  type: "project",
  displayName: "Project",
  // Reuse Core sharing access, including invitations and organization scope.
});

/**
 * Ownership repair for projects created before owner tracking existed (or by
 * the seed): rows with `owner_email IS NULL` are invisible to the framework's
 * share actions — the share dialog's visibility/invite controls stay disabled
 * for everyone and `set-resource-visibility` / `share-resource` 403. Claim
 * such rows for the earliest-created user (the app's primary owner in this
 * standalone app) so sharing works on existing CYOAs.
 *
 * Idempotent: only touches NULL-owner rows, never rows that later gained an
 * explicit owner. Runs on every boot; becomes a no-op once the legacy rows
 * are claimed (all rows created through actions carry an owner).
 */
async function claimUnownedProjects(): Promise<void> {
  try {
    const exec = getDbExec();
    const { rows } = await exec.execute(
      "SELECT email FROM user WHERE email IS NOT NULL ORDER BY created_at ASC, id ASC LIMIT 1",
    );
    const ownerEmail = rows[0]?.email as string | undefined;
    if (!ownerEmail) return; // No user yet (fresh install) — nothing to claim.
    await exec.execute({
      sql: "UPDATE projects SET owner_email = ? WHERE owner_email IS NULL",
      args: [ownerEmail],
    });
  } catch (error) {
    // Best-effort repair — never take down the app if the auth tables are
    // missing or the DB is unavailable at boot.
    console.error("[sharing] failed to claim unowned projects:", error);
  }
}

/**
 * Bootstrap the framework tables the registrations above depend on
 * (resource versions + review comments), and repair ownership on legacy
 * unowned projects so the share dialog works for them. Runs after the app's
 * own migrations have created the `projects`/`project_shares` tables.
 */
export default async () => {
  await ensureResourceVersionsTable();
  await ensureReviewTables();
  await claimUnownedProjects();
};
