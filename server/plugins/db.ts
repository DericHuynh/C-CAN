import { runMigrations } from "@agent-native/core/db";

import { seedIfEmpty } from "../db/seed.js";

const migrations = runMigrations(
  [
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
  ],
  { table: "iccplus_migrations" },
);

/**
 * Compose migrations + demo seeding in one plugin: Nitro runs plugins
 * concurrently, so a standalone seed plugin could race the migration that
 * creates the `projects` table. Running the seed after awaiting the
 * migrations guarantees the table exists.
 */
export default async (nitroApp: Parameters<typeof migrations>[0]) => {
  await migrations(nitroApp);
  await seedIfEmpty();
};
