/** Additive, portable SQL; publication ids reference their source project ids. */
export const publishingMigrations = [
  {
    version: 4,
    name: "cyoa-publications",
    sql: `CREATE TABLE IF NOT EXISTS cyoa_publications (
    id TEXT PRIMARY KEY NOT NULL, owner_email TEXT NOT NULL, org_id TEXT,
    status TEXT NOT NULL CHECK(status IN ('published','unpublished')),
    title TEXT NOT NULL, description TEXT NOT NULL, author TEXT NOT NULL, tags TEXT NOT NULL,
    content_rating TEXT NOT NULL CHECK(content_rating IN ('sfw','nsfw')),
    cover_url TEXT NOT NULL, cover_image_id TEXT NOT NULL, json TEXT NOT NULL,
    version INTEGER NOT NULL, published_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  },
  {
    version: 5,
    name: "cyoa-publication-ratings",
    sql: `CREATE TABLE IF NOT EXISTS cyoa_publication_ratings (
    id TEXT PRIMARY KEY NOT NULL, publication_id TEXT NOT NULL, owner_email TEXT NOT NULL, org_id TEXT,
    overall INTEGER NOT NULL CHECK(overall BETWEEN 0 AND 5),
    writing INTEGER CHECK(writing BETWEEN 0 AND 5), gameplay INTEGER CHECK(gameplay BETWEEN 0 AND 5),
    presentation INTEGER CHECK(presentation BETWEEN 0 AND 5), updated_at TEXT NOT NULL,
    UNIQUE(publication_id, owner_email)
  )`,
  },
  {
    version: 6,
    name: "cyoa-publication-discovery-index",
    sql: `CREATE INDEX IF NOT EXISTS cyoa_publications_discovery ON cyoa_publications(status, content_rating, updated_at)`,
  },
  {
    version: 7,
    name: "cyoa-publication-ratings-index",
    sql: `CREATE INDEX IF NOT EXISTS cyoa_ratings_publication ON cyoa_publication_ratings(publication_id)`,
  },
];
