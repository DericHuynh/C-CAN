import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { DatabaseSync } from "node:sqlite";
import { importSqliteSnapshot } from "../../scripts/lib/import-sqlite.js";

const { values } = parseArgs({
  options: { source: { type: "string" }, target: { type: "string" } },
});
if (!values.source || !values.target) {
  throw new Error(
    "Usage: pnpm db:import-sqlite --source data/app.db --target data/pglite-upgraded (target must not exist)",
  );
}
const source = new DatabaseSync(resolve(values.source), { readOnly: true });
const target = resolve(values.target);
// Exclusive creation prevents accidentally importing into an existing database.
await mkdir(target, { recursive: false, mode: 0o700 });
process.env.DATABASE_URL = `pglite:${target}`;
process.env.NODE_ENV = "development";
// guard:allow-env-credential — offline import clears the app-name selector so a scoped URL cannot redirect the copy to an existing database; no credential is read.
delete process.env.APP_NAME;
delete process.env.DATABASE_URL_UNPOOLED;
delete process.env.NETLIFY_DATABASE_URL;
delete process.env.NETLIFY_DATABASE_URL_UNPOOLED;
const { getDbExec, closeDbExec, withMigrationRuntime, runMigrations } =
  await import("@agent-native/core/db");
let copied = false;
try {
  const { runFrameworkReleaseMigrations } = await import("@agent-native/core/server");
  const { migrations } = await import("../../server/db/migrations.js");
  await withMigrationRuntime(async () => {
    await runFrameworkReleaseMigrations(null);
    await runMigrations(migrations, { table: "iccplus_migrations" })(null);
  });
  const manifest = await importSqliteSnapshot(source, getDbExec());
  copied = true;
  await writeFile(`${target}/sqlite-import.json`, JSON.stringify(manifest, null, 2) + "\n", {
    mode: 0o600,
  });
  console.log(JSON.stringify({ sourceUnchanged: true, target, tables: manifest }, null, 2));
  console.log(
    "Copy completed. Keep the original database and encryption/signing secrets. Set DATABASE_URL to the target's pglite: URL to use it locally.",
  );
} catch (error) {
  // Database driver errors may include SQL parameters (password hashes or
  // encrypted credentials). Report only the error code, never record values.
  const code =
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[A-Z0-9_]+$/.test(error.code)
      ? error.code
      : "IMPORT_FAILED";
  console.error(
    `SQLite import failed (${code}). The source is unchanged. ${
      copied
        ? "The data copy committed, but writing the final report failed. Inspect the destination before retrying."
        : "No data copy committed. Keep this target out of service; resolve the incompatibility and retry with a new target directory."
    }`,
  );
  process.exitCode = 1;
} finally {
  source.close();
  await closeDbExec();
}
