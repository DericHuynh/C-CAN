import { afterEach, beforeEach, expect, it } from "vite-plus/test";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDbExec, closeDbExec, type DbExec } from "@agent-native/core/db";
import { importSqliteSnapshot } from "./import-sqlite.js";

let source: DatabaseSync;
let destination: DbExec;
let directory: string;
beforeEach(async () => {
  source = new DatabaseSync(":memory:");
  directory = await mkdtemp(join(tmpdir(), "c-can-sqlite-import-"));
  destination = await createDbExec({ url: `pglite:${directory}/database` });
});
afterEach(async () => {
  source.close();
  await closeDbExec();
  await rm(directory, { recursive: true, force: true });
});

it("copies identities before references, converts booleans and preserves retired data", async () => {
  source.exec(`CREATE TABLE people (id TEXT PRIMARY KEY, enabled INTEGER, created_at INTEGER, retired TEXT);
    CREATE TABLE children (id TEXT PRIMARY KEY, parent TEXT);
    CREATE TABLE old_migrations (version INTEGER);
    CREATE TABLE retired_media (payload BLOB);
    INSERT INTO people VALUES ('owner', 1, 1700000000000, 'old field');
    INSERT INTO children VALUES ('choice', 'owner');
    INSERT INTO old_migrations VALUES (99);
    INSERT INTO retired_media VALUES (X'0102');`);
  await destination.execute(
    `CREATE TABLE people (id TEXT PRIMARY KEY, enabled BOOLEAN, created_at TIMESTAMPTZ, new_field TEXT DEFAULT 'new')`,
  );
  await destination.execute(
    `CREATE TABLE children (id TEXT PRIMARY KEY, parent TEXT REFERENCES people(id))`,
  );
  await destination.execute(`CREATE TABLE old_migrations (version INTEGER)`);
  const result = await importSqliteSnapshot(source, destination);
  expect(result.find((r) => r.table === "people")).toMatchObject({
    archived: 1,
    imported: 1,
    archivedColumns: ["retired"],
  });
  const person = (await destination.execute("SELECT * FROM people")).rows[0];
  expect(person).toMatchObject({ id: "owner", enabled: true, new_field: "new" });
  expect(new Date(person.created_at).getTime()).toBe(1700000000000);
  expect((await destination.execute("SELECT * FROM old_migrations")).rows).toHaveLength(0);
  expect(
    (await destination.execute("SELECT retired FROM legacy_sqlite.people")).rows[0].retired,
  ).toBe("old field");
  expect(
    (
      await destination.execute(
        "SELECT encode(payload, 'hex') AS bytes FROM legacy_sqlite.retired_media",
      )
    ).rows[0].bytes,
  ).toBe("0102");
  expect(source.prepare("SELECT retired FROM people").get()?.retired).toBe("old field");
});

it("rolls back the entire copy if a row cannot satisfy the current schema", async () => {
  source.exec(`CREATE TABLE items (id TEXT PRIMARY KEY, enabled INTEGER);
    INSERT INTO items VALUES ('first', 1), ('invalid', 2)`);
  await destination.execute("CREATE TABLE items (id TEXT PRIMARY KEY, enabled BOOLEAN)");
  await expect(importSqliteSnapshot(source, destination)).rejects.toThrow("Invalid legacy boolean");
  expect((await destination.execute("SELECT * FROM items")).rows).toHaveLength(0);
  expect(
    (
      await destination.execute(
        "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'legacy_sqlite'",
      )
    ).rows,
  ).toHaveLength(0);
  expect(source.prepare("SELECT count(*) AS count FROM items").get()?.count).toBe(2);
});
