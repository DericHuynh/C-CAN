/**
 * e621 / Derpibooru API helper used by the image-sourcing actions
 * (`search-image-source`, `add-image-from-source`).
 *
 * Both sites expose public JSON APIs with tag-based search:
 *
 * - e621       — GET https://e621.net/posts.json?tags=<query>&limit=N
 * - Derpibooru — GET https://derpibooru.org/api/v1/json/search/images?q=<query>&limit=N
 *
 * NSFW content: e621 serves explicit content anonymously; Derpibooru restricts
 * higher ratings to logged-in accounts. Optional per-user credentials are
 * stored through the framework's secrets flow (`E621_USERNAME` +
 * `E621_API_KEY`, `DERPIBOORU_API_KEY`) and attached here when present — see
 * server/plugins/booru-secrets.ts.
 *
 * Attribution is normalized into a `BooruImage` so callers can copy tags,
 * description, title and source onto an ImageResource automatically.
 */
import { readAppSecret } from "@agent-native/core/secrets";

export type BooruSite = "e621" | "derpibooru";

export interface BooruImage {
  site: BooruSite;
  /** Site post/image id (pass to add-image-from-source). */
  id: string;
  /** Direct image URL (hotlinkable). */
  url: string;
  /** Site post page URL (attribution link). */
  pageUrl: string;
  title: string;
  description: string;
  tags: string[];
  /** Original source URL (artist page etc.), when the site reports one. */
  source: string;
  rating?: string;
  width?: number;
  height?: number;
  score?: number;
  ext?: string;
}

const USER_AGENT = "ICCPlus-CYOA-Studio/1.0 (agent-native app)";

/** Image extensions the CYOA viewer renders; videos/webm are filtered out. */
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "svg"]);

const E621_USERNAME_KEY = "E621_USERNAME";
const E621_API_KEY_KEY = "E621_API_KEY";
const DERPIBOORU_API_KEY_KEY = "DERPIBOORU_API_KEY";

/** Resolved optional credentials: headers (e621 Basic) + derpibooru key param. */
interface BooruAuth {
  headers: Record<string, string>;
  /** Derpibooru authenticates via the `key` query parameter (API docs). */
  key?: string;
  /** e621 username, when set — included in the User-Agent per the API policy. */
  username?: string;
}

function isImageExt(ext: string | undefined): boolean {
  return typeof ext === "string" && IMAGE_EXTS.has(ext.toLowerCase());
}

function isImageMime(mime: string | undefined): boolean {
  return typeof mime === "string" && mime.startsWith("image/");
}

/** Read one per-user secret, or null when unset/unavailable. */
async function readUserSecret(key: string, userEmail: string | undefined): Promise<string | null> {
  if (!userEmail) return null;
  try {
    const result = await readAppSecret({ key, scope: "user", scopeId: userEmail });
    return result?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve optional credentials for the acting user. Returns null when no
 * credentials are configured — callers then request anonymously.
 */
export async function resolveBooruAuth(
  site: BooruSite,
  userEmail: string | undefined,
): Promise<BooruAuth | null> {
  if (site === "e621") {
    const [username, apiKey] = await Promise.all([
      readUserSecret(E621_USERNAME_KEY, userEmail),
      readUserSecret(E621_API_KEY_KEY, userEmail),
    ]);
    if (username && apiKey) {
      return {
        headers: {
          Authorization: `Basic ${Buffer.from(`${username}:${apiKey}`).toString("base64")}`,
        },
        username,
      };
    }
    return null;
  }
  const apiKey = await readUserSecret(DERPIBOORU_API_KEY_KEY, userEmail);
  return apiKey ? { headers: {}, key: apiKey } : null;
}

async function fetchJson(url: string, auth: BooruAuth | null): Promise<unknown> {
  const finalUrl = auth?.key ? `${url}&key=${encodeURIComponent(auth.key)}` : url;
  // e621 requires a descriptive User-Agent and asks that the account username
  // be included so maintainers can contact the author of a problematic client.
  const userAgent = auth?.username
    ? `ICCPlus-CYOA-Studio/1.0 (by ${auth.username} on e621)`
    : USER_AGENT;
  const response = await fetch(finalUrl, {
    headers: { "User-Agent": userAgent, ...(auth?.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status === 401) {
    throw new Error("The stored API key was rejected by the site. Check Settings → Secrets.");
  }
  if (response.status === 403) {
    throw new Error("The site refused this request (403). Your account may not have access to this content.");
  }
  if (response.status === 429) {
    throw new Error("The site rate-limited this request (429). Wait a moment and try again.");
  }
  if (response.status === 501) {
    throw new Error(
      "The site returned an anti-bot challenge (501). Wait a few seconds and try again.",
    );
  }
  if (response.status === 503) {
    throw new Error("The site is rate-limiting or overloaded (503). Wait a moment and try again.");
  }
  if (!response.ok) {
    throw new Error(`The site returned HTTP ${response.status}.`);
  }
  return response.json();
}

/** Normalize one e621 post into a BooruImage, or null when not usable. */
function normalizeE621Post(post: Record<string, any>): BooruImage | null {
  const ext: string | undefined = post?.file?.ext;
  if (!isImageExt(ext) || !post?.file?.url) return null;
  const tagsObj = (post.tags ?? {}) as Record<string, string[]>;
  const tags = Object.values(tagsObj).flat().filter((t): t is string => typeof t === "string");
  const artist = Array.isArray(tagsObj.artist) ? tagsObj.artist[0] : undefined;
  const uploaderName = typeof post.uploader_name === "string" ? post.uploader_name : undefined;
  const sources = Array.isArray(post.sources) ? post.sources : [];
  const id = String(post.id ?? "");
  return {
    site: "e621",
    id,
    url: post.file.url,
    pageUrl: `https://e621.net/posts/${id}`,
    title: artist || uploaderName || `e621 post #${id}`,
    description: typeof post.description === "string" ? post.description : "",
    tags,
    source: sources[0] ?? "",
    rating: typeof post.rating === "string" ? post.rating : undefined,
    width: post.file?.width,
    height: post.file?.height,
    score:
      typeof post.score === "number"
        ? post.score
        : typeof post.score?.total === "number"
          ? post.score.total
          : undefined,
    ext,
  };
}

/** Normalize one Derpibooru image into a BooruImage, or null when not usable. */
function normalizeDerpiImage(image: Record<string, any>): BooruImage | null {
  const mime: string | undefined = image?.mime_type;
  if (!isImageMime(mime) || !image?.representations?.full) return null;
  const tags = Array.isArray(image.tags) ? image.tags.filter((t): t is string => typeof t === "string") : [];
  const sources = Array.isArray(image.source_urls) ? image.source_urls : [];
  const id = String(image.id ?? "");
  return {
    site: "derpibooru",
    id,
    url: image.representations.full,
    // API docs recommend the derpibooru.org domain as the canonical link.
    pageUrl: `https://derpibooru.org/images/${id}`,
    title: `Derpibooru post #${id}`,
    description: typeof image.description === "string" ? image.description : "",
    tags,
    source: sources[0] ?? "",
    width: typeof image.width === "number" ? image.width : undefined,
    height: typeof image.height === "number" ? image.height : undefined,
    score: typeof image.score === "number" ? image.score : undefined,
    ext: mime ? mime.split("/")[1] : undefined,
  };
}

/**
 * Normalize a tag query for a site's search syntax:
 * - e621: space-separated terms, metatags like `rating:explicit` work as-is.
 * - Derpibooru v1 API: comma-separated AND terms; ratings are bare words
 *   (`safe`/`suggestive`/`questionable`/`explicit`), so translate the
 *   `rating:X` form and join terms with commas (spaces break multi-term
 *   queries anonymously).
 */
function normalizeQuery(site: BooruSite, tags: string): string {
  const trimmed = tags.trim();
  if (site === "e621") return trimmed;
  return trimmed
    .replace(/rating:(safe|suggestive|questionable|explicit)/gi, "$1")
    .split(/\s+/)
    .filter(Boolean)
    .join(",");
}

/**
 * Tag-based image search. `tags` is a space-separated query supporting each
 * site's metatag syntax (e.g. `rating:safe species:canine`). Returns up to
 * `limit` usable (image-only) candidates with full attribution metadata.
 */

export async function searchBooru(
  site: BooruSite,
  tags: string,
  limit: number,
  userEmail?: string,
): Promise<BooruImage[]> {
  const auth = await resolveBooruAuth(site, userEmail);
  const query = encodeURIComponent(normalizeQuery(site, tags));
  const cap = Math.min(limit, 25);
  const url =
    site === "e621"
      ? `https://e621.net/posts.json?tags=${query}&limit=${cap}`
      : `https://derpibooru.org/api/v1/json/search/images?q=${query}&per_page=${cap}`;
  const data = (await fetchJson(url, auth)) as Record<string, any>;
  if (site === "e621") {
    return (Array.isArray(data.posts) ? data.posts : [])
      .map(normalizeE621Post)
      .filter((p): p is BooruImage => p !== null);
  }
  return (Array.isArray(data.images) ? data.images : [])
    .map(normalizeDerpiImage)
    .filter((p): p is BooruImage => p !== null);
}

/** Fetch one post/image by id (used for automatic attribution on import). */
export async function fetchBooruPost(
  site: BooruSite,
  postId: string,
  userEmail?: string,
): Promise<BooruImage> {
  const auth = await resolveBooruAuth(site, userEmail);
  const url =
    site === "e621"
      ? `https://e621.net/posts.json?tags=id:${encodeURIComponent(postId)}&limit=1`
      : `https://derpibooru.org/api/v1/json/images/${encodeURIComponent(postId)}`;
  const data = (await fetchJson(url, auth)) as Record<string, any>;
  if (site === "e621") {
    const post = Array.isArray(data.posts) ? data.posts[0] : undefined;
    const image = post ? normalizeE621Post(post) : null;
    if (!image) throw new Error(`e621 post "${postId}" was not found or is not an image.`);
    return image;
  }
  const image = data?.image ? normalizeDerpiImage(data.image) : null;
  if (!image) throw new Error(`Derpibooru image "${postId}" was not found or is not an image.`);
  return image;
}
