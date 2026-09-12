/**
 * Move full image payloads to blob storage and embed only bounded LOD previews.
 * Ordinary saves do not download remote images; use generate-image-previews to
 * prepare existing URL resources. The ACL id-based export targets this viewer.
 */
import { uploadFile } from "@agent-native/core/file-upload";

import { getImagePreview } from "../shared/image-preview.js";
import { createImagePreview } from "./_image-previews.js";

import type { ImageResource, SoundEffect } from "../shared/types.js";

const DATA_URL_RE = /^data:([^,]*),(.*)$/is;

/** True when the image string is an inline data URL payload. */
export function isDataUrlImage(value: string | undefined): boolean {
  return typeof value === "string" && /^data:/i.test(value);
}

/**
 * Upload one data-URL payload through the active provider.
 * Returns the public URL. Missing storage is an error: payload bytes must
 * never fall back to SQL. Non-data-URL references pass through unchanged.
 */
export async function uploadDataUrlImage(value: string): Promise<string> {
  if (!isDataUrlImage(value)) return value;
  const { data, mimeType } = decodeImageDataUrl(value);
  const result = await uploadFile({ data, mimeType });
  if (!result?.url || isDataUrlImage(result.url)) {
    throw new Error(
      "Image storage is unavailable. Configure a file-upload provider before saving embedded images.",
    );
  }
  return result.url;
}

function decodeImageDataUrl(value: string) {
  const match = DATA_URL_RE.exec(value);
  if (!match) throw new Error("Invalid image data URL.");
  const [mediaType, ...parameters] = match[1].split(";");
  const mimeType = mediaType || "application/octet-stream";
  const isBase64 = parameters.some((parameter) => parameter.toLowerCase() === "base64");
  const data = isBase64
    ? Buffer.from(match[2], "base64")
    : Buffer.from(decodeURIComponent(match[2]), "utf8");
  return { data, mimeType };
}

/**
 * Externalize every data-URL payload in a document's image collection.
 * Returns the count of payloads moved to blob storage.
 */
export async function externalizeAppImages(app: {
  images?: ImageResource[];
  soundEffects?: SoundEffect[];
}): Promise<number> {
  const images = app.images ?? [];
  let moved = 0;
  for (const image of images) {
    if (!image) continue;
    const value = image.image;
    image.preview = getImagePreview(image);
    if (!value || !isDataUrlImage(value)) continue;
    const url = await uploadDataUrlImage(value);
    if (url !== value) {
      image.image = url;
      image.imageIsURL = true;
      image.preview = await createImagePreview(decodeImageDataUrl(value).data, url);
      moved += 1;
    }
  }
  const audioUrls = new Map<string, string>();
  for (const sound of app.soundEffects ?? []) {
    if (!isDataUrlImage(sound.audio)) continue;
    const original = sound.audio;
    let url = audioUrls.get(original);
    if (!url) {
      url = await uploadDataUrlImage(original);
      audioUrls.set(original, url);
      moved++;
    }
    sound.audio = url;
  }
  return moved;
}
