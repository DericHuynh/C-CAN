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
  isSeed: integer("is_seed", { mode: "boolean" }).notNull().default(false),
});

/** Companion shares table for the framework's share actions (share-resource,
 *  set-resource-visibility, …) on the `project` resource type. */
export const projectShares = createSharesTable("project_shares");

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
