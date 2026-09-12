import { tagMigrations } from "../tags/migrations.js";
import { publishingMigrations } from "../publishing/migrations.js";

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
  ...publishingMigrations,
  ...tagMigrations,
  {
    version: 10,
    name: "project-share-notification-state",
    sql: `ALTER TABLE project_shares ADD COLUMN IF NOT EXISTS notified_at TEXT`,
  },
];
