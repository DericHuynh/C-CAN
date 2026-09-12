import type { DatabaseSync } from "node:sqlite";
import type { DbExec } from "@agent-native/core/db";

const isArchiveOnly = (name: string) =>
  /migrations?(?:_named)?$|^_.*migration|^__drizzle/i.test(name) || name === "agent_tool_ledger";
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
type SourceColumn = { name: string; type: string };
type TargetColumn = { column_name: string; data_type: string };

function pgValue(value: unknown, type: string): unknown {
  if (value == null) return null;
  if (type === "boolean") {
    if (value === true || value === 1 || value === 1n || value === "1") return true;
    if (value === false || value === 0 || value === 0n || value === "0") return false;
    throw new Error("Invalid legacy boolean value");
  }
  if (type.startsWith("timestamp") && (typeof value === "number" || typeof value === "bigint")) {
    return new Date(Number(value)).toISOString();
  }
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return Buffer.from(value);
  return value;
}

/** Copy a consistent read-only snapshot. Call only against a newly initialized destination. */
export async function importSqliteSnapshot(source: DatabaseSync, destination: DbExec) {
  if (!destination.transaction) throw new Error("Destination must support transactions");
  source.exec("BEGIN");
  try {
    const tables = source
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as { name: string }[];
    return await destination.transaction(async (tx) => {
      // Complete legacy snapshot, including retired tables/columns and migration journals.
      // Keep this outside public so the framework's scoped DB tools cannot query it.
      await tx.execute("CREATE SCHEMA legacy_sqlite");
      const manifest: {
        table: string;
        archived: number;
        imported: number;
        archivedColumns: string[];
      }[] = [];
      const targets = (
        await tx.execute(
          "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public'",
        )
      ).rows as (TargetColumn & { table_name: string })[];
      // Schema initialization seeds framework defaults. The destination is new;
      // replace those defaults with the source snapshot, including dependent rows.
      const liveTables = tables.filter(
        (t) => !isArchiveOnly(t.name) && targets.some((c) => c.table_name === t.name),
      );
      if (liveTables.length)
        await tx.execute(
          `TRUNCATE ${liveTables.map((t) => `public.${quote(t.name)}`).join(", ")} CASCADE`,
        );
      const relations = (
        await tx.execute(`SELECT child.relname AS child, parent.relname AS parent
        FROM pg_constraint c JOIN pg_class child ON child.oid = c.conrelid
        JOIN pg_class parent ON parent.oid = c.confrelid WHERE c.contype = 'f'`)
      ).rows;
      // Parents precede their dependents; reject cycles instead of disabling integrity checks.
      const ordered: { name: string }[] = [];
      const pending = [...tables];
      while (pending.length) {
        const next = pending.findIndex(
          (t) =>
            !relations.some(
              (r) =>
                r.child === t.name &&
                r.parent !== t.name &&
                pending.some((p) => p.name === r.parent),
            ),
        );
        if (next < 0)
          throw new Error("Legacy tables have cyclic foreign keys; migration rolled back");
        ordered.push(...pending.splice(next, 1));
      }
      for (const { name } of ordered) {
        const columns = source.prepare(`PRAGMA table_info(${quote(name)})`).all() as SourceColumn[];
        const columnNames = columns.map((c) => c.name);
        const live = targets.filter(
          (c) => c.table_name === name && columnNames.includes(c.column_name),
        );
        // Old tool deduplication keys embed full request bodies, exceeding Postgres
        // index limits. Archive them without reviving pre-upgrade in-flight tools.
        const journal = isArchiveOnly(name);
        await tx.execute(
          `CREATE TABLE legacy_sqlite.${quote(name)} (${columns
            .map(
              (c) =>
                `${quote(c.name)} ${/INT/i.test(c.type) ? "BIGINT" : /REAL|FLOAT|DOUBLE/i.test(c.type) ? "DOUBLE PRECISION" : /BLOB/i.test(c.type) ? "BYTEA" : "TEXT"}`,
            )
            .join(", ")})`,
        );
        const statement = source.prepare(`SELECT * FROM ${quote(name)}`);
        statement.setReadBigInts(true);
        const record = {
          table: name,
          archived: 0,
          imported: 0,
          archivedColumns: columnNames.filter((c) => !live.some((l) => l.column_name === c)),
        };
        const keys = (
          await tx.execute({
            sql: `SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                WHERE i.indrelid = to_regclass(?) AND i.indisprimary`,
            args: [`public.${quote(name)}`],
          })
        ).rows.map((r) => String(r.attname));
        const updates = live.filter((c) => !keys.includes(c.column_name));
        const conflict = keys.length
          ? ` ON CONFLICT (${keys.map(quote).join(", ")}) ${updates.length ? "DO UPDATE SET " + updates.map((c) => `${quote(c.column_name)} = EXCLUDED.${quote(c.column_name)}`).join(", ") : "DO NOTHING"}`
          : "";
        for (const row of statement.iterate()) {
          await tx.execute({
            sql: `INSERT INTO legacy_sqlite.${quote(name)} (${columnNames.map(quote).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
            args: columnNames.map((c) => pgValue(row[c], "")),
          });
          record.archived++;
          if (live.length && !journal) {
            // Fresh destination contains framework defaults only. Replace conflicting
            // defaults with source values while letting new columns keep their defaults.
            await tx.execute({
              sql: `INSERT INTO public.${quote(name)} (${live.map((c) => quote(c.column_name)).join(", ")}) VALUES (${live.map(() => "?").join(", ")})${conflict}`,
              args: live.map((c) => pgValue(row[c.column_name], c.data_type)),
            });
            record.imported++;
          }
        }
        const count = (
          await tx.execute(`SELECT count(*) AS count FROM legacy_sqlite.${quote(name)}`)
        ).rows[0];
        if (Number(count.count) !== record.archived)
          throw new Error(`Archive count mismatch: ${name}`);
        manifest.push(record);
      }
      return manifest;
    });
  } finally {
    source.exec("ROLLBACK");
  }
}
