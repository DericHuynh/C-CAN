import { createHash } from "node:crypto";
import { and, desc, eq, sql } from "@agent-native/core/db/schema";
import { getDb } from "../db/index.js";
import { e621Tags, e621TagQueries } from "../db/schema.js";
import { normalizeTag, type CatalogTag } from "../../shared/tags.js";

const TTL = 24 * 60 * 60 * 1000;
const flights = new Map<string, Promise<void>>();
let queue = Promise.resolve();
let queued = 0;
let nextRequest = 0;
/** One upstream request per second, bounded queue and coalesced identical lookups. */
async function fetchTags(
  params: Record<string, string>,
): Promise<{ items: CatalogTag[]; nextCursor: number | null }> {
  if (queued >= 8) throw new Error("Tag catalog is busy; cached suggestions are available.");
  queued++;
  const previous = queue;
  let release!: () => void;
  queue = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    await previous;
    if (nextRequest > Date.now())
      await new Promise((resolve) => setTimeout(resolve, nextRequest - Date.now()));
    nextRequest = Date.now() + 1000;
    const url = new URL("https://e621.net/tags.json");
    for (const [key, value] of Object.entries({ ...params, only: "id,name,category,post_count" }))
      url.searchParams.set(key, value);
    const response = await fetch(url, {
      headers: {
        "User-Agent": "ICCPlus-CYOA-Studio/1.0 (public tag catalog)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`e621 tag lookup failed (${response.status})`);
    const body = await response.text();
    if (body.length > 2_000_000) throw new Error("Tag response exceeds the catalog limit");
    const data: unknown = JSON.parse(body);
    if (!Array.isArray(data)) throw new Error("Unexpected e621 tag response");
    const updatedAt = new Date().toISOString();
    const items: CatalogTag[] = data.slice(0, 320).flatMap((item) =>
      item &&
      Number.isSafeInteger(item.id) &&
      item.id > 0 &&
      typeof item.name === "string" &&
      item.name.length <= 128 &&
      Number.isSafeInteger(item.category) &&
      Number.isSafeInteger(item.post_count) &&
      item.post_count >= 0
        ? [
            {
              id: item.id,
              name: normalizeTag(item.name),
              category: item.category,
              postCount: item.post_count,
              updatedAt,
            },
          ]
        : [],
    );
    const sourceIds = data.flatMap((item) =>
      Number.isSafeInteger(item?.id) && item.id > 0 ? [item.id] : [],
    );
    return {
      items,
      nextCursor:
        data.length === Number(params.limit) && sourceIds.length ? Math.max(...sourceIds) : null,
    };
  } finally {
    queued--;
    release();
  }
}
async function persist(rows: CatalogTag[]) {
  // Only provider responses enter this public catalog. No caller-supplied tag rows.
  for (let offset = 0; offset < rows.length; offset += 100) {
    await getDb()
      .insert(e621Tags)
      .values(rows.slice(offset, offset + 100))
      .onConflictDoUpdate({
        target: e621Tags.id,
        set: {
          name: sql`excluded.name`,
          category: sql`excluded.category`,
          postCount: sql`excluded.post_count`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }
}
const queryKey = (query: string) => createHash("sha256").update(query).digest("hex");
async function refresh(query: string) {
  try {
    const { items: rows } = await fetchTags({
      "search[name_matches]": query.replace(/[\\*%]/g, "") + "*",
      "search[order]": "count",
      "search[hide_empty]": "true",
      limit: "80",
    });
    await persist(rows);
    const now = new Date().toISOString();
    await getDb()
      .insert(e621TagQueries)
      .values({ query: queryKey(query), refreshedAt: now, retryAt: now })
      .onConflictDoUpdate({
        target: e621TagQueries.query,
        set: { refreshedAt: now, retryAt: now },
      });
  } catch (error) {
    const retryAt = new Date(Date.now() + 60_000).toISOString();
    await getDb()
      .insert(e621TagQueries)
      .values({ query: queryKey(query), refreshedAt: "", retryAt })
      .onConflictDoUpdate({ target: e621TagQueries.query, set: { retryAt } });
    throw error;
  }
}
export async function searchTagCatalog(raw: string, limit = 20) {
  const query = normalizeTag(raw).slice(0, 128);
  const [cache] = await getDb()
    .select()
    .from(e621TagQueries)
    .where(eq(e621TagQueries.query, queryKey(query)));
  let warning: string | undefined;
  if (
    !cache ||
    (Date.parse(cache.retryAt) <= Date.now() &&
      (!cache.refreshedAt || Date.parse(cache.refreshedAt) + TTL < Date.now()))
  ) {
    let flight = flights.get(query);
    if (!flight) {
      flight = refresh(query).finally(() => flights.delete(query));
      flights.set(query, flight);
    }
    try {
      await flight;
    } catch {
      warning = "e621 is unavailable. Showing cached suggestions; you can still enter a tag.";
    }
  } else if (Date.parse(cache.retryAt) > Date.now())
    warning = "e621 is temporarily unavailable. Showing cached suggestions.";
  const items = await getDb()
    .select()
    .from(e621Tags)
    .where(
      and(
        query
          ? sql`${e621Tags.name} >= ${query} and ${e621Tags.name} < ${query + "\uffff"}`
          : undefined,
        sql`${e621Tags.postCount} > 0`,
      ),
    )
    .orderBy(desc(e621Tags.postCount), e621Tags.name)
    .limit(Math.min(40, Math.max(1, limit)));
  return { items, source: "e621" as const, warning };
}
/** Bounded cursor import for agents/operators who want to prewarm the full catalog. */
export async function syncTagCatalog(afterId = 0) {
  const { items, nextCursor } = await fetchTags({
    page: `a${afterId}`,
    limit: "320",
    "search[hide_empty]": "false",
  });
  await persist(items);
  return {
    imported: items.length,
    nextCursor,
    source: "e621" as const,
  };
}
