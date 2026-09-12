/**
 * Dev helper: verify the G1/G2 schema bootstrapping (migrations + framework
 * tables). Run: pnpm exec tsx scripts/tmp-verify-schema.ts
 */
import { getDb } from "../server/db/index.js";

const db = getDb();

const cols = (await db.all("PRAGMA table_info(projects)")) as Array<{ name: string }>;
console.log("projects columns:", cols.map((c) => c.name).join(", "));

for (const table of ["project_shares", "agent_resource_versions", "agent_review_comments"]) {
  const rows = (await db.all(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`,
  )) as Array<{ name: string }>;
  console.log(`${table}:`, rows.length ? "present" : "MISSING");
}
