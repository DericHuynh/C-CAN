import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ssrfSafeFetch } from "@agent-native/core/extensions/url-safety";
import { createImagePreview, generateImagePreview } from "./_image-previews.js";
import { getImagePreview, MAX_IMAGE_PREVIEW_LENGTH } from "../shared/image-preview.js";
import type { ImageResource } from "../shared/types.js";

vi.mock("@agent-native/core/extensions/url-safety", () => ({ ssrfSafeFetch: vi.fn() }));
const source = "https://example.com/image.png";
const raster = () =>
  sharp({ create: { width: 900, height: 600, channels: 3, background: "red" } })
    .png()
    .toBuffer();
beforeEach(() => vi.resetAllMocks());
describe("tiny image previews", () => {
  it("produces a bounded WebP with original dimensions and no full-size payload", async () => {
    const preview = await createImagePreview(await raster(), source);
    expect(preview).toMatchObject({ source, width: 900, height: 600 });
    expect(preview!.data.length).toBeLessThanOrEqual(MAX_IMAGE_PREVIEW_LENGTH);
    const decoded = await sharp(Buffer.from(preview!.data.split(",")[1], "base64")).metadata();
    expect(decoded).toMatchObject({ format: "webp", width: 24, height: 16 });
    expect(getImagePreview({ id: "image", image: source, preview })).toEqual(preview);
  });
  it("does not fail an import for invalid or unsupported image bytes", async () => {
    expect(await createImagePreview(Buffer.from("broken"), source)).toBeUndefined();
    expect(
      await createImagePreview(
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="5" height="5"/>'),
        source,
      ),
    ).toBeUndefined();
  });
  it("invalidates stale, oversized, and non-WebP previews", async () => {
    const preview = (await createImagePreview(await raster(), source))!;
    expect(getImagePreview({ id: "i", image: source + "?new", preview })).toBeUndefined();
    expect(
      getImagePreview({
        id: "i",
        image: source,
        preview: { ...preview, data: "data:image/webp;base64," + "A".repeat(2048) },
      }),
    ).toBeUndefined();
    expect(
      getImagePreview({
        id: "i",
        image: source,
        preview: { ...preview, data: "data:image/svg+xml;base64,AAAA" },
      }),
    ).toBeUndefined();
  });
  it("downloads through the SSRF guard and skips an already generated preview", async () => {
    vi.mocked(ssrfSafeFetch).mockResolvedValue(new Response(new Uint8Array(await raster())));
    const image: ImageResource = { id: "i", image: source };
    expect(await generateImagePreview(image)).toBe(true);
    expect(ssrfSafeFetch).toHaveBeenCalledWith(
      source,
      { signal: expect.any(AbortSignal) },
      { maxRedirects: 3 },
    );
    expect(await generateImagePreview(image)).toBe(true);
    expect(ssrfSafeFetch).toHaveBeenCalledOnce();
  });
  it("rejects oversized remote bodies before reading them and leaves the original URL", async () => {
    const response = new Response("", { headers: { "content-length": String(26 * 1024 * 1024) } });
    vi.mocked(ssrfSafeFetch).mockResolvedValue(response);
    const image: ImageResource = { id: "i", image: source };
    expect(await generateImagePreview(image)).toBe(false);
    expect(image.image).toBe(source);
    expect(image.preview).toBeUndefined();
  });
  it("handles blocked or unreachable hosts without persisting a stale preview", async () => {
    vi.mocked(ssrfSafeFetch).mockRejectedValue(new Error("Blocked URL"));
    const image: ImageResource = { id: "i", image: source };
    expect(await generateImagePreview(image)).toBe(false);
    expect(image.preview).toBeUndefined();
  });
});
