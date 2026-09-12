/** Global public reference data only; never user-authored or private project tags. */
export const tagMigrations = [
  {
    version: 8,
    name: "e621-tag-catalog",
    sql: `CREATE TABLE IF NOT EXISTS e621_tags (id INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL UNIQUE, category INTEGER NOT NULL, post_count INTEGER NOT NULL, updated_at TEXT NOT NULL)`,
  },
  {
    version: 9,
    name: "e621-tag-query-cache",
    sql: `CREATE TABLE IF NOT EXISTS e621_tag_queries (query TEXT PRIMARY KEY NOT NULL, refreshed_at TEXT NOT NULL, retry_at TEXT NOT NULL)`,
  },
];
