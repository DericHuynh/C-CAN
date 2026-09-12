import sharp from "sharp";
import { ssrfSafeFetch } from "@agent-native/core/extensions/url-safety";
import {
  getImagePreview,
  hasCurrentImagePreview,
  MAX_IMAGE_PREVIEW_LENGTH,
} from "../../shared/image-preview.js";
import type { ImageResource } from "../../shared/types.js";

const MAX_BYTES = 25 * 1024 * 1024;

/** Decode just the first frame; preserve its aspect ratio and discard metadata. */
export async function createImagePreview(
  data: Buffer,
  source: string,
): Promise<ImageResource["preview"]> {
  try {
    if (data.length > MAX_BYTES) return undefined;
    const input = sharp(data, { limitInputPixels: 100_000_000 });
    const metadata = await input.metadata();
    // Raster inputs only: avoid SVG external resources and unbounded document rendering.
    if (!["jpeg", "png", "webp", "gif", "avif", "heif", "tiff"].includes(metadata.format ?? ""))
      return undefined;
    const swap = [5, 6, 7, 8].includes(metadata.orientation ?? 0);
    const width = (swap ? metadata.height : metadata.width) ?? 1;
    const height = (swap ? metadata.width : metadata.height) ?? 1;
    // Try original pixel dimensions first. Only reduce encoded resolution when
    // the byte budget cannot fit them; layout always uses original width/height.
    const edge = Math.max(width, height);
    const sizes = [edge, 1024, 512, 256, 128, 64, 32];
    for (const size of [...new Set(sizes)].filter((size) => size <= edge || size === 32)) {
      for (const quality of [65, 35, 12]) {
        const bytes = await sharp(data, { limitInputPixels: 100_000_000 })
          .rotate()
          .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
          .webp({ quality, effort: 2 })
          .toBuffer();
        const preview = {
          version: 2,
          source,
          data: `data:image/webp;base64,${bytes.toString("base64")}`,
          width,
          height,
        };
        if (preview.data.length <= MAX_IMAGE_PREVIEW_LENGTH) return preview;
      }
    }
    return undefined;
  } catch {
    // A broken or unsupported source must not prevent storing/playing a project.
    return undefined;
  }
}

async function readImage(source: string): Promise<Buffer> {
  // Only the application's own upload keys may resolve to local files.
  if (source.startsWith("/_agent-native/uploads/")) {
    const { readUploadedFile } = await import("../storage/local-uploads.js");
    const { data } = await readUploadedFile(source.slice("/_agent-native/uploads/".length));
    if (data.length > MAX_BYTES) throw new Error("Image too large");
    return data;
  }
  const url = new URL(source);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Unsupported image URL");
  const response = await ssrfSafeFetch(
    source,
    { signal: AbortSignal.timeout(10_000) },
    { maxRedirects: 3 },
  );
  if (!response.ok || Number(response.headers.get("content-length")) > MAX_BYTES) {
    await response.body?.cancel();
    throw new Error("Image unavailable or too large");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Image body unavailable");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) throw new Error("Image too large");
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** Explicit per-image work only; ordinary project saves never download remote images. */
export async function generateImagePreview(image: ImageResource): Promise<boolean> {
  if (hasCurrentImagePreview(image)) return true;
  const previous = getImagePreview(image);
  delete image.preview;
  if (!image.image || /^data:/i.test(image.image)) return false;
  try {
    image.preview =
      (await createImagePreview(await readImage(image.image), image.image)) ?? previous;
    return hasCurrentImagePreview(image);
  } catch {
    image.preview = previous;
    return false;
  }
}
