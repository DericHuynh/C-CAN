import { normalizeTagList } from "./tags.js";
import { z } from "zod";
import type { App } from "./types.js";

export const RATING_CATEGORIES = ["overall", "writing", "gameplay", "presentation"] as const;
export type RatingCategory = (typeof RATING_CATEGORIES)[number];
const score = z.number().int().min(0).max(5);
export const ballotSchema = z.object({
  overall: score,
  writing: score.nullable().default(null),
  gameplay: score.nullable().default(null),
  presentation: score.nullable().default(null),
});
export type RatingBallot = z.infer<typeof ballotSchema>;
export const publicationFields = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).default(""),
  author: z.string().trim().min(1).max(100),
  tags: z.array(z.string().trim().min(1).max(128)).max(12).default([]),
  contentRating: z.enum(["sfw", "nsfw"]),
  coverImageId: z.string().max(160).default(""),
});
export const explorerFilters = z.object({
  query: z.string().trim().max(160).default(""),
  excludeTags: z.array(z.string().trim().min(1).max(128)).max(12).default([]),
  tags: z.array(z.string().trim().min(1).max(128)).max(12).default([]),
  content: z.enum(["sfw", "nsfw", "all"]).default("sfw"),
  sort: z.enum(["relevance", "newest", "updated", "rating"]).default("relevance"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export type ExplorerFilters = z.infer<typeof explorerFilters>;

/** One malformed URL field must not discard the user's other filters. */
export function explorerFiltersFromParams(params: URLSearchParams): ExplorerFilters {
  const input = {
    query: params.get("q") ?? undefined,
    tags: params.getAll("tag"),
    excludeTags: params.getAll("excludeTag"),
    content: params.get("content") ?? undefined,
    sort: params.get("sort") ?? undefined,
    page: params.get("page") ?? undefined,
  };
  const defaults = explorerFilters.parse({});
  return Object.fromEntries(
    Object.entries(explorerFilters.shape).map(([key, schema]) => {
      const field = key as keyof ExplorerFilters;
      const parsed = schema.safeParse(input[field]);
      return [key, parsed.success ? parsed.data : defaults[field]];
    }),
  ) as ExplorerFilters;
}
export interface PublicationSummary {
  id: string;
  title: string;
  description: string;
  author: string;
  tags: string[];
  contentRating: "sfw" | "nsfw";
  coverUrl: string;
  version: number;
  publishedAt: string;
  updatedAt: string;
  overall: number | null;
  ratingCount: number;
}
export interface RatingSummary {
  count: number;
  average: number | null;
  distribution: number[];
}
export function summarizeRatings(ballots: RatingBallot[]): Record<RatingCategory, RatingSummary> {
  return Object.fromEntries(
    RATING_CATEGORIES.map((category) => {
      const values = ballots
        .map((ballot) => ballot[category])
        .filter((value): value is number => value !== null);
      return [
        category,
        {
          count: values.length,
          average: values.length
            ? values.reduce((sum, value) => sum + value, 0) / values.length
            : null,
          distribution: Array.from(
            { length: 6 },
            (_, value) => values.filter((v) => v === value).length,
          ),
        },
      ];
    }),
  ) as Record<RatingCategory, RatingSummary>;
}
export const normalizeTags = normalizeTagList;
/** Remove editorial drafts recursively, including row, choice and addon notes. */
export function publicDocument(app: App): App {
  return JSON.parse(JSON.stringify(app, (key, value) => (key === "planning" ? undefined : value)));
}
const words = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) ?? [];
/** Small bounded edit distance with adjacent transpositions, for misspelled search words. */
function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  rows[0] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  return rows[a.length][b.length];
}
/** Every query word must match; title/tag matches rank above descriptive prose. */
export function publicationMatch(
  query: string,
  item: Pick<PublicationSummary, "title" | "author" | "description" | "tags">,
): number | null {
  const terms = words(query);
  if (!terms.length) return 0;
  const primary = words(`${item.title} ${item.tags.join(" ")}`);
  const secondary = words(`${item.author} ${item.description}`);
  let total = 0;
  for (const term of terms) {
    let best = Infinity;
    for (const [tokens, penalty] of [
      [primary, 0],
      [secondary, 2],
    ] as const)
      for (const token of tokens) {
        if (token === term) best = Math.min(best, penalty);
        else if (token.startsWith(term)) best = Math.min(best, penalty + 1);
        else if (term.length >= 4 && token.length <= 64 && term.length <= 64) {
          const edits = distance(term, token);
          if (edits <= (term.length >= 7 ? 2 : 1)) best = Math.min(best, penalty + edits + 2);
        }
      }
    if (!Number.isFinite(best)) return null;
    total += best;
  }
  return total;
}
