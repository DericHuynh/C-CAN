import { afterEach, beforeEach, it, expect, vi } from "vite-plus/test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "@agent-native/core/db/schema";
import { getDb } from "../db/index.js";
import { e621Tags, e621TagQueries } from "../db/schema.js";
import { tagMigrations } from "./migrations.js";
import { searchTagCatalog, syncTagCatalog } from "./repository.js";
vi.mock("../db/index.js", () => ({ getDb: vi.fn() }));
let close: () => Promise<void>;
const fetchMock = vi.fn();
const row = (id: number, name: string, count = 20) => ({
  id,
  name,
  category: 0,
  post_count: count,
});
beforeEach(async () => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  const client = new PGlite();
  const db = drizzle(client);
  close = () => client.close();
  for (const migration of tagMigrations) await client.exec(migration.sql);
  vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
});
afterEach(async () => {
  await close();
  vi.unstubAllGlobals();
});
it("persists provider tags, coalesces lookups and reuses the catalog", async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify([row(1, "blue_sky", 30), row(2, "blue_eyes", 50)])),
  );
  const [a, b] = await Promise.all([searchTagCatalog("Blue "), searchTagCatalog("blue")]);
  expect(a.items.map((t) => t.name)).toEqual(["blue_eyes", "blue_sky"]);
  expect(b.items).toEqual(a.items);
  expect(fetchMock).toHaveBeenCalledOnce();
  const cached = await searchTagCatalog("BLUE");
  expect(cached.items).toHaveLength(2);
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(await getDb().select().from(e621Tags)).toHaveLength(2);
  expect((await getDb().select().from(e621TagQueries))[0].query).not.toContain("blue");
  const url = fetchMock.mock.calls[0][0] as URL;
  expect(url.origin).toBe("https://e621.net");
  expect(url.searchParams.get("search[name_matches]")).toBe("blue*");
});
it("uses literal normalized prefixes and returns bounded results", async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify([row(1, "blue_sky"), row(2, "blueXsky")])),
  );
  expect((await searchTagCatalog("blue sky", 1)).items.map((t) => t.name)).toEqual(["blue_sky"]);
});
it("falls back to persisted results when e621 fails and backs off", async () => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([row(1, "forest")])));
  await searchTagCatalog("forest");
  await getDb()
    .update(e621TagQueries)
    .set({ refreshedAt: "", retryAt: "2000-01-01T00:00:00Z" })
    .where(sql`1=1`);
  fetchMock.mockRejectedValueOnce(new Error("offline"));
  const result = await searchTagCatalog("forest");
  expect(result.items[0].name).toBe("forest");
  expect(result.warning).toContain("unavailable");
  await searchTagCatalog("forest");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it("imports cursor pages from e621 without accepting arbitrary caller records", async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(Array.from({ length: 320 }, (_, i) => row(i + 1, `tag_${i}`)))),
  );
  const result = await syncTagCatalog(0);
  expect(result).toMatchObject({ imported: 320, nextCursor: 320 });
  expect((fetchMock.mock.calls[0][0] as URL).searchParams.get("page")).toBe("a0");
  expect(await getDb().select().from(e621Tags)).toHaveLength(320);
});
