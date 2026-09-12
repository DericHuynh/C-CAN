import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "@agent-native/core/db/schema";
import { getDb } from "../db/index.js";
import { publications, publicationRatings, projects } from "../db/schema.js";
import { getProjectOrThrow, type ProjectAccessContext } from "../projects/repository.js";
import { externalizeAppImages } from "../media/blob-images.js";
import { aclImportImages, resolveImageRef } from "../../shared/cyoa.js";
import { assertFound } from "../../shared/assert.js";
import { parseAppDocument } from "../../shared/project-document.js";
import {
  normalizeTags,
  publicDocument,
  publicationMatch,
  RATING_CATEGORIES,
  type PublicationSummary,
  type ExplorerFilters,
  type RatingBallot,
  type RatingCategory,
  type RatingSummary,
  publicationFields,
} from "../../shared/publications.js";
import type { z } from "zod";

const metadata = {
  id: publications.id,
  title: publications.title,
  description: publications.description,
  author: publications.author,
  tags: publications.tags,
  contentRating: publications.contentRating,
  coverUrl: publications.coverUrl,
  version: publications.version,
  publishedAt: publications.publishedAt,
  updatedAt: publications.updatedAt,
};
// Explicit public-release boundary: never select a draft's JSON or private metadata.
// Joining its source makes deletion revoke the release even if cleanup is interrupted.
const publicScope = eq(publications.status, "published");
async function ownerProject(id: string, ctx?: ProjectAccessContext) {
  assertFound(ctx?.userEmail, "Sign in to manage publishing.");
  const project = await getProjectOrThrow(id, ctx, "editor");
  assertFound(
    project.row.ownerEmail?.toLowerCase() === ctx.userEmail.toLowerCase(),
    "Only the project owner can publish or withdraw this CYOA.",
  );
  return project;
}
export async function publicationStatus(id: string, ctx?: ProjectAccessContext) {
  const { row } = await getProjectOrThrow(id, ctx, "viewer");
  const canPublish = Boolean(
    ctx?.userEmail && row.ownerEmail?.toLowerCase() === ctx.userEmail.toLowerCase(),
  );
  if (!canPublish) return { canPublish, publication: null };
  const [publication] = await getDb()
    .select({ ...metadata, status: publications.status, coverImageId: publications.coverImageId })
    .from(publications)
    .where(eq(publications.id, id));
  return {
    canPublish,
    publication: publication
      ? { ...publication, tags: JSON.parse(publication.tags) as string[] }
      : null,
  };
}
export async function publishProject(
  id: string,
  fields: z.infer<typeof publicationFields>,
  ctx?: ProjectAccessContext,
) {
  const { app, row } = await ownerProject(id, ctx);
  const snapshot = publicDocument(app);
  await externalizeAppImages(aclImportImages(snapshot));
  const cover = fields.coverImageId
    ? snapshot.images.find((image) => image.id === fields.coverImageId)
    : undefined;
  assertFound(!fields.coverImageId || cover, "Choose an image that exists in the saved project.");
  const coverUrl = cover ? (resolveImageRef(snapshot, cover.id) ?? "") : "";
  assertFound(
    !coverUrl || /^(https?:\/\/|\/(?!\/))/.test(coverUrl),
    "The cover must use a stored image or an HTTP image URL.",
  );
  const now = new Date().toISOString();
  const values = {
    ...fields,
    tags: JSON.stringify(normalizeTags(fields.tags)),
    coverUrl,
    ownerEmail: row.ownerEmail!,
    orgId: row.orgId,
    status: "published" as const,
    json: JSON.stringify(snapshot),
    updatedAt: now,
  };
  const [saved] = await getDb()
    .insert(publications)
    .values({ ...values, id, version: 1, publishedAt: now })
    .onConflictDoUpdate({
      target: publications.id,
      set: { ...values, version: sql`${publications.version} + 1` },
    })
    .returning({ id: publications.id, version: publications.version });
  return {
    ...saved,
    url: `/play/${encodeURIComponent(id)}`,
    indexUrl: `/explorer/${encodeURIComponent(id)}`,
  };
}
export async function unpublishProject(id: string, ctx?: ProjectAccessContext) {
  await ownerProject(id, ctx);
  await getDb()
    .update(publications)
    .set({ status: "unpublished", updatedAt: new Date().toISOString() })
    .where(eq(publications.id, id));
  return { id, published: false };
}

/** SQL aggregates keep individual ballots and voter identities off public list/read paths. */
async function ratingSummaries(
  ids: string[],
  categories: readonly RatingCategory[] = RATING_CATEGORIES,
) {
  const result = new Map<string, Record<RatingCategory, RatingSummary>>();
  if (!ids.length) return result;
  for (const category of categories) {
    const column = publicationRatings[category];
    const rows = await getDb()
      .select({
        id: publicationRatings.publicationId,
        count: sql<number>`count(${column})`,
        average: sql<number | null>`avg(${column})`,
        n0: sql<number>`sum(case when ${column} = 0 then 1 else 0 end)`,
        n1: sql<number>`sum(case when ${column} = 1 then 1 else 0 end)`,
        n2: sql<number>`sum(case when ${column} = 2 then 1 else 0 end)`,
        n3: sql<number>`sum(case when ${column} = 3 then 1 else 0 end)`,
        n4: sql<number>`sum(case when ${column} = 4 then 1 else 0 end)`,
        n5: sql<number>`sum(case when ${column} = 5 then 1 else 0 end)`,
      })
      .from(publicationRatings)
      .where(inArray(publicationRatings.publicationId, ids))
      .groupBy(publicationRatings.publicationId);
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const id of ids) {
      const row = byId.get(id);
      if (!result.has(id)) result.set(id, {} as Record<RatingCategory, RatingSummary>);
      result.get(id)![category] = {
        count: Number(row?.count ?? 0),
        average: row?.average == null ? null : Number(row.average),
        distribution: row
          ? [row.n0, row.n1, row.n2, row.n3, row.n4, row.n5].map(Number)
          : [0, 0, 0, 0, 0, 0],
      };
    }
  }
  return result;
}
export async function listPublications(filters: ExplorerFilters) {
  const records = await getDb()
    .select(metadata)
    .from(publications)
    .innerJoin(projects, eq(projects.id, publications.id))
    .where(
      and(
        publicScope,
        filters.content === "all" ? undefined : eq(publications.contentRating, filters.content),
      ),
    );
  const tags = new Map<string, number>();
  const requestedTags = normalizeTags(filters.tags);
  const excludedTags = normalizeTags(filters.excludeTags ?? []);
  const matches = records.flatMap((row) => {
    const item = { ...row, tags: normalizeTags(JSON.parse(row.tags) as string[]) };
    item.tags.forEach((tag) => tags.set(tag, (tags.get(tag) ?? 0) + 1));
    if (
      !requestedTags.every((tag) => item.tags.includes(tag)) ||
      excludedTags.some((tag) => item.tags.includes(tag))
    )
      return [];
    const relevance = publicationMatch(filters.query, item);
    return relevance === null ? [] : [{ item, relevance }];
  });
  // Read scores only, never the full documents, for rating sort and list badges.
  const ratings = await ratingSummaries(
    matches.map(({ item }) => item.id),
    ["overall"],
  );
  const items = matches.map(({ item, relevance }) => ({
    ...item,
    relevance,
    overall: ratings.get(item.id)?.overall.average ?? null,
    ratingCount: ratings.get(item.id)?.overall.count ?? 0,
  }));
  items.sort((a, b) => {
    if (filters.sort === "rating")
      return (
        (b.overall ?? -1) - (a.overall ?? -1) ||
        b.ratingCount - a.ratingCount ||
        a.id.localeCompare(b.id)
      );
    if (filters.sort === "relevance" && filters.query && a.relevance !== b.relevance)
      return a.relevance - b.relevance;
    const field = filters.sort === "newest" ? "publishedAt" : "updatedAt";
    return b[field].localeCompare(a[field]) || a.id.localeCompare(b.id);
  });
  const pageSize = 24;
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(filters.page, pages);
  return {
    items: items
      .slice((page - 1) * pageSize, page * pageSize)
      .map(({ relevance: _, ...item }) => item as PublicationSummary),
    total: items.length,
    page,
    pages,
    tags: [...tags].sort(([a], [b]) => a.localeCompare(b)).map(([tag, count]) => ({ tag, count })),
  };
}
export async function getPublication(
  id: string,
  includeDocument: boolean,
  ctx?: ProjectAccessContext,
) {
  const [row] = await getDb()
    .select({
      ...metadata,
      owner: projects.ownerEmail,
      ...(includeDocument ? { json: publications.json } : {}),
    })
    .from(publications)
    .innerJoin(projects, eq(projects.id, publications.id))
    .where(and(publicScope, eq(publications.id, id)));
  assertFound(row, "This CYOA is not published or is no longer available.");
  const ratings = (await ratingSummaries([id])).get(id)!;
  const email = ctx?.userEmail?.toLowerCase();
  const [ballot] = email
    ? await getDb()
        .select({
          overall: publicationRatings.overall,
          writing: publicationRatings.writing,
          gameplay: publicationRatings.gameplay,
          presentation: publicationRatings.presentation,
        })
        .from(publicationRatings)
        .where(
          and(eq(publicationRatings.publicationId, id), eq(publicationRatings.ownerEmail, email)),
        )
    : [];
  const { owner, json, ...publicFields } = row;
  return {
    ...publicFields,
    tags: JSON.parse(row.tags) as string[],
    overall: ratings.overall.average,
    ratingCount: ratings.overall.count,
    ratings,
    myRating: ballot ?? null,
    canRate: Boolean(email && email !== owner?.toLowerCase()),
    app: includeDocument && json ? parseAppDocument(json) : null,
  };
}
export async function ratePublication(
  id: string,
  ballot: RatingBallot | null,
  ctx?: ProjectAccessContext,
) {
  const email = ctx?.userEmail?.toLowerCase();
  assertFound(email, "Sign in to rate this CYOA.");
  const publication = await getPublication(id, false, ctx);
  assertFound(publication.canRate, "Authors cannot rate their own CYOAs.");
  const where = and(
    eq(publicationRatings.publicationId, id),
    eq(publicationRatings.ownerEmail, email),
  );
  if (!ballot) await getDb().delete(publicationRatings).where(where);
  else {
    const ballotId = createHash("sha256")
      .update(JSON.stringify([id, email]))
      .digest("hex");
    const values = { ...ballot, updatedAt: new Date().toISOString() };
    await getDb()
      .insert(publicationRatings)
      .values({
        ...values,
        id: ballotId,
        publicationId: id,
        ownerEmail: email,
        orgId: ctx?.orgId ?? null,
      })
      .onConflictDoUpdate({ target: publicationRatings.id, set: values });
  }
  return { id, saved: ballot !== null };
}
