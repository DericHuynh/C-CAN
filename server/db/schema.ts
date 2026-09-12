/**
 * Drizzle schema for CYOA projects.
 *
 * A project row stores the full ICCPlus CYOA document (the `App` JSON) in a
 * single text column — the same document format produced by the original
 * Svelte creator — plus lightweight metadata used for list rendering.
 */
import { table, text, integer, now } from "@agent-native/core/db/schema";
import { createSharesTable } from "@agent-native/core/sharing";

export const projects = table("projects", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  /** Serialized ICCPlus `App` document (shared/types.ts). */
  json: text("json").notNull(),
  ownerEmail: text("owner_email"),
  orgId: text("org_id"),
  /** Coarse sharing default ('private' | 'org' | 'public') — written by the
   *  framework's set-resource-visibility action for the `project` resource. */
  visibility: text("visibility", { enum: ["private", "org", "public"] })
    .notNull()
    .default("private"),
  createdAt: text("created_at").notNull().default(now()),
  updatedAt: text("updated_at").notNull().default(now()),
  /** 1 = demo/example seed project, 0 = user project. */
  isSeed: integer("is_seed").notNull().default(0),
});

/** Companion shares table for the framework's share actions (share-resource,
 *  set-resource-visibility, …) on the `project` resource type. */
export const projectShares = createSharesTable("project_shares");

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

/** A release is public only after explicit owner publication; draft projects remain private. */
export const publications = table("cyoa_publications", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
  status: text("status", { enum: ["published", "unpublished"] }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  author: text("author").notNull(),
  tags: text("tags").notNull(),
  contentRating: text("content_rating", { enum: ["sfw", "nsfw"] }).notNull(),
  coverUrl: text("cover_url").notNull(),
  coverImageId: text("cover_image_id").notNull(),
  json: text("json").notNull(),
  version: integer("version").notNull(),
  publishedAt: text("published_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** One ballot per account and publication. Identity never appears in public responses. */
export const publicationRatings = table("cyoa_publication_ratings", {
  id: text("id").primaryKey(),
  publicationId: text("publication_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
  overall: integer("overall").notNull(),
  writing: integer("writing"),
  gameplay: integer("gameplay"),
  presentation: integer("presentation"),
  updatedAt: text("updated_at").notNull(),
});

/** Public e621 reference catalog, shared across all workspaces. No private data. */
export const e621Tags = table("e621_tags", {
  id: integer("id").primaryKey(),
  name: text("name").notNull().unique(),
  category: integer("category").notNull(),
  postCount: integer("post_count").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const e621TagQueries = table("e621_tag_queries", {
  query: text("query").primaryKey(),
  refreshedAt: text("refreshed_at").notNull(),
  retryAt: text("retry_at").notNull(),
});
