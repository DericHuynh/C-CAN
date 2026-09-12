/**
 * Dev helper: exercise G1 (history/versions) + G2 (sharing) server-side.
 * Run: AGENT_USER_EMAIL=dev@local.test pnpm exec tsx tools/manual/tmp-verify-share-history.ts
 */
import "../../server/plugins/project-resources.js"; // registers the `project` resource

import { default as createProject } from "../../actions/create-project.js";
import { default as deleteProject } from "../../actions/delete-project.js";
import { default as createVersion } from "@agent-native/core/history/actions/create-resource-version";
import { default as listVersions } from "@agent-native/core/history/actions/list-resource-versions";
import { default as listShares } from "@agent-native/core/sharing/actions/list-resource-shares";
import { default as setVisibility } from "@agent-native/core/sharing/actions/set-resource-visibility";
import { default as share } from "@agent-native/core/sharing/actions/share-resource";

const ctx = { userEmail: process.env.AGENT_USER_EMAIL ?? "dev@local.test", caller: "cli" as const };

const created = (await createProject.run({ title: "G1/G2 smoke" }, ctx)) as { id: string };
console.log("created project:", created.id);

try {
  const version = await createVersion.run(
    { resourceType: "project", resourceId: created.id, title: "Smoke snapshot" },
    ctx,
  );
  console.log("create-resource-version OK:", JSON.stringify(version).slice(0, 140));

  const versions = (await listVersions.run(
    { resourceType: "project", resourceId: created.id },
    ctx,
  )) as { versions?: Array<{ versionNumber: number; title: string | null }> };
  console.log("versions:", (versions.versions ?? []).map((v) => `${v.versionNumber}:${v.title}`).join(", "));

  await setVisibility.run(
    { resourceType: "project", resourceId: created.id, visibility: "public" },
    ctx,
  );
  console.log("set-resource-visibility OK (public)");

  await share.run(
    {
      resourceType: "project",
      resourceId: created.id,
      principalType: "user",
      principalId: "viewer-check@local.test",
      role: "viewer",
    },
    ctx,
  );
  const shares = (await listShares.run(
    { resourceType: "project", resourceId: created.id },
    ctx,
  )) as { shares?: Array<{ principalId: string; role: string }> };
  console.log("shares:", JSON.stringify((shares.shares ?? shares) as unknown).slice(0, 200));
} finally {
  await deleteProject.run({ id: created.id }, ctx);
  console.log("cleaned up");
}
