import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "@agent-native/core/db/schema";
import { getDb } from "../db/index.js";
import { projects, publicationRatings } from "../db/schema.js";
import { newProjectRow } from "../projects/repository.js";
import { createDefaultApp, createDefaultRow } from "../../shared/cyoa.js";
import { publishingMigrations } from "./migrations.js";
import { explorerFilters, publicationFields } from "../../shared/publications.js";
import {
  publishProject,
  unpublishProject,
  listPublications,
  getPublication,
  ratePublication,
} from "./repository.js";
vi.mock("../db/index.js", () => ({ getDb: vi.fn() }));
vi.mock("../media/blob-images.js", () => ({ externalizeAppImages: vi.fn() }));
vi.mock("@agent-native/core/sharing", async (original) => ({
  ...(await original<typeof import("@agent-native/core/sharing")>()),
  assertAccess: vi.fn(),
}));
let close: () => Promise<void>;
const owner = { userEmail: "owner@example.test" },
  reader = { userEmail: "reader@example.test" };
const fields = publicationFields.parse({
  title: "Crystal Kingdom",
  author: "Example Author",
  tags: ["Fantasy"],
  contentRating: "sfw",
});
beforeEach(async () => {
  vi.clearAllMocks();
  const client = new PGlite();
  const database = drizzle(client);
  close = () => client.close();
  await client.exec(
    `CREATE TABLE projects (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, json TEXT NOT NULL, owner_email TEXT, org_id TEXT, visibility TEXT NOT NULL DEFAULT 'private', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, is_seed INTEGER NOT NULL DEFAULT 0)`,
  );
  for (const migration of publishingMigrations) await client.exec(migration.sql);
  vi.mocked(getDb).mockReturnValue(database as unknown as ReturnType<typeof getDb>);
  const app = createDefaultApp();
  app.rows = [createDefaultRow(app, 0)];
  Object.assign(app.rows[0], {
    planning: { notes: "Private draft note" },
    title: "Published opening",
  });
  await getDb()
    .insert(projects)
    .values(newProjectRow({ id: "story", json: JSON.stringify(app), ownerEmail: owner.userEmail }));
});
afterEach(() => close?.());
it("requires a real owner even when a caller has editor access", async () => {
  await expect(publishProject("story", fields)).rejects.toThrow(/Sign in/);
  await expect(publishProject("story", fields, reader)).rejects.toThrow(/Only the project owner/);
  await expect(unpublishProject("story", reader)).rejects.toThrow(/Only the project owner/);
});
it("publishes an anonymous playable snapshot without exposing or following draft changes", async () => {
  await expect(getPublication("story", true)).rejects.toThrow(/not published/);
  await publishProject("story", fields, owner);
  const release = await getPublication("story", true);
  expect(JSON.stringify(release)).not.toContain("Private draft note");
  expect(JSON.stringify(release)).not.toContain(owner.userEmail);
  expect(release.app?.rows[0].title).toBe("Published opening");
  const next = createDefaultApp();
  await getDb()
    .update(projects)
    .set({ json: JSON.stringify(next) })
    .where(eq(projects.id, "story"));
  expect((await getPublication("story", true)).app?.rows).toHaveLength(1);
  const listed = await listPublications(
    explorerFilters.parse({ query: "crsytal", tags: ["fantasy"] }),
  );
  expect(listed.total).toBe(1);
  expect(JSON.stringify(listed)).not.toContain('"json"');
  expect(JSON.stringify(listed)).not.toContain('"planning"');
  await unpublishProject("story", owner);
  expect((await listPublications(explorerFilters.parse({}))).total).toBe(0);
  await expect(getPublication("story", true)).rejects.toThrow(/not published/);
});
it("defaults to SFW and requires matching all selected tags", async () => {
  await publishProject("story", { ...fields, contentRating: "nsfw" }, owner);
  expect((await listPublications(explorerFilters.parse({}))).total).toBe(0);
  expect((await listPublications(explorerFilters.parse({ content: "nsfw" }))).total).toBe(1);
  expect(
    (await listPublications(explorerFilters.parse({ content: "all", tags: ["fantasy", "space"] })))
      .total,
  ).toBe(0);
});
it("upserts each account's ballot, preserves independent overall, and supports removal", async () => {
  await publishProject("story", fields, owner);
  const ballot = { overall: 0, writing: 5, gameplay: 5, presentation: null };
  await expect(ratePublication("story", ballot)).rejects.toThrow(/Sign in/);
  await expect(ratePublication("story", ballot, owner)).rejects.toThrow(/Authors cannot/);
  await ratePublication("story", ballot, reader);
  await ratePublication("story", { ...ballot, overall: 2 }, reader);
  await ratePublication("story", { ...ballot, overall: 4 }, { userEmail: "other@example.test" });
  const release = await getPublication("story", false, reader);
  expect(release.overall).toBe(3);
  expect(release.ratingCount).toBe(2);
  expect(release.ratings.writing.average).toBe(5);
  expect(release.ratings.overall.distribution).toEqual([0, 0, 1, 0, 1, 0]);
  expect(release.myRating?.overall).toBe(2);
  expect((await getPublication("story", false)).myRating).toBeNull();
  expect(await getDb().select().from(publicationRatings)).toHaveLength(2);
  await publishProject("story", fields, owner);
  expect((await getPublication("story", false)).version).toBe(2);
  expect((await getPublication("story", false)).ratingCount).toBe(2);
  await ratePublication("story", null, reader);
  expect((await getPublication("story", false)).ratingCount).toBe(1);
});
it("revokes public reads if the source project is deleted", async () => {
  await publishProject("story", fields, owner);
  await getDb().delete(projects).where(eq(projects.id, "story"));
  await expect(getPublication("story", true)).rejects.toThrow(/not published/);
  expect((await listPublications(explorerFilters.parse({ content: "all" }))).total).toBe(0);
});

it("normalizes include/exclude tags and excludes matches before pagination", async () => {
  await publishProject("story", { ...fields, tags: ["Fantasy", "Blue Sky"] }, owner);
  expect((await listPublications(explorerFilters.parse({ tags: ["blue sky"] }))).total).toBe(1);
  expect(
    (
      await listPublications(
        explorerFilters.parse({ tags: ["fantasy"], excludeTags: ["BLUE SKY"] }),
      )
    ).total,
  ).toBe(0);
  expect((await listPublications(explorerFilters.parse({ excludeTags: ["night"] }))).total).toBe(1);
});
