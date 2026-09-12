import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FileUploadProvider } from "@agent-native/core/file-upload";

/** Overridable in production (e.g. a mounted volume); default: data/uploads.
 *  Resolved lazily so runtime env overrides (and tests) take effect. */
export function uploadsDir(): string {
  // guard:allow-env-credential — Deployment-owned storage directory, not a user credential; preserves the documented persistent-volume override.
  return process.env.FILE_UPLOADS_DIR ?? path.join(process.cwd(), "data", "uploads");
}

/** Public URL prefix that server/routes/_agent-native/uploads/[file].get.ts serves. */
export const FILE_UPLOADS_URL_PREFIX = "/_agent-native/uploads/";

const EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
  "image/avif": ".avif",
  "image/bmp": ".bmp",
};

export const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".bin": "application/octet-stream",
};

/**
 * Resolve and read an uploaded blob by its public key.
 * Rejects keys that escape the uploads directory (traversal). Throws an
 * Error with `statusCode` for missing files — the route maps these to HTTP.
 */
export async function readUploadedFile(key: string): Promise<{
  data: Buffer;
  mimeType: string;
}> {
  if (!key || key.includes("/") || key.includes("\\") || key.includes("..")) {
    const err = new Error("Invalid file key") as Error & { statusCode: number };
    err.statusCode = 400;
    throw err;
  }
  const root = path.resolve(uploadsDir());
  const full = path.resolve(path.join(root, key));
  if (!full.startsWith(root + path.sep)) {
    const err = new Error("Invalid file key") as Error & { statusCode: number };
    err.statusCode = 400;
    throw err;
  }
  try {
    const data = await readFile(full);
    const ext = path.extname(key).toLowerCase();
    return { data, mimeType: MIME_BY_EXT[ext] ?? "application/octet-stream" };
  } catch {
    const err = new Error("Not found") as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }
}

export const localUploadProvider: FileUploadProvider = {
  id: "local",
  name: "Local disk",
  isConfigured: () => true,
  upload: async ({ data, filename, mimeType }) => {
    const ext =
      path.extname(filename ?? "") || (mimeType ? EXT_BY_MIME[mimeType] : undefined) || ".bin";
    const key = `${Date.now()}-${randomUUID()}${ext}`;
    const dir = uploadsDir();
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, key), data);
    return { url: `${FILE_UPLOADS_URL_PREFIX}${key}`, provider: "local", id: key };
  },
};
