/**
 * Dev helper: verify the G1/G2 schema bootstrapping (migrations + framework
 * tables). Run: pnpm script tmp-verify-schema
 */
import { closeDbExec, getDbExec } from "@agent-native/core/db";

const db = getDbExec();

try {
  const { rows: cols } = await db.execute(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' ORDER BY ordinal_position",
  );
  console.log("projects columns:", cols.map((c) => c.column_name).join(", "));
  for (const table of ["project_shares", "agent_resource_versions", "agent_review_comments"]) {
    const { rows } = await db.execute({
      sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?",
      args: [table],
    });
    console.log(`${table}:`, rows.length ? "present" : "MISSING");
  }
} finally {
  await closeDbExec();
}
