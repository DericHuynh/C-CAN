import type { ImageResource } from "./types";

/** The sole inline image exception: a tiny WebP, at most 8 KiB including its prefix. */
export const MAX_IMAGE_PREVIEW_LENGTH = 8192;

export function getImagePreview(image: ImageResource): ImageResource["preview"] {
  const preview = image.preview;
  if (
    !image.image ||
    !preview ||
    preview.source !== image.image ||
    typeof preview.data !== "string" ||
    preview.data.length > MAX_IMAGE_PREVIEW_LENGTH ||
    !/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(preview.data) ||
    !Number.isSafeInteger(preview.width) ||
    !Number.isSafeInteger(preview.height) ||
    preview.width < 1 ||
    preview.height < 1 ||
    preview.width * preview.height > 100_000_000
  )
    return undefined;
  return {
    ...(preview.version ? { version: preview.version } : {}),
    source: preview.source,
    data: preview.data,
    width: preview.width,
    height: preview.height,
  };
}

/** Legacy previews still render while authors regenerate them at the larger budget. */
export function hasCurrentImagePreview(image: ImageResource): boolean {
  return getImagePreview(image)?.version === 2;
}
