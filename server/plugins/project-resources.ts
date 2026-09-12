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
import { getProjectOrThrow, saveProject } from "../projects/repository.js";

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

/** Bootstrap the framework tables; ownership recovery is an explicit operator task. */
export default async () => {
  await ensureResourceVersionsTable();
  await ensureReviewTables();
};
