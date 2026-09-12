import { runMigrations } from "@agent-native/core/db";

import { seedIfEmpty } from "../db/seed.js";

/** App migrations — exported so tests can replay them on a scratch database. */
export const migrations = [
  {
    version: 1,
    name: "iccplus-projects-table",
    sql: `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  json TEXT NOT NULL,
  owner_email TEXT,
  org_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_seed INTEGER NOT NULL DEFAULT 0
)`,
  },
  {
    version: 2,
    name: "iccplus-projects-visibility",
    sql: `ALTER TABLE projects ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'`,
  },
  {
    version: 3,
    name: "iccplus-project-shares-table",
    sql: `
CREATE TABLE IF NOT EXISTS project_shares (
  id TEXT PRIMARY KEY NOT NULL,
  resource_id TEXT NOT NULL,
  principal_type TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
)`,
  },
];

const migrationsPlugin = runMigrations(migrations, { table: "iccplus_migrations" });

/**
 * Compose migrations + demo seeding in one plugin: Nitro runs plugins
 * concurrently, so a standalone seed plugin could race the migration that
 * creates the `projects` table. Running the seed after awaiting the
 * migrations guarantees the table exists.
 */
export default async (nitroApp: Parameters<typeof migrationsPlugin>[0]) => {
  await migrationsPlugin(nitroApp);
  await seedIfEmpty();
};
