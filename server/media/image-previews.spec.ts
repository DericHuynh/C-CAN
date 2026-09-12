import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ssrfSafeFetch } from "@agent-native/core/extensions/url-safety";
import { createImagePreview, generateImagePreview } from "./image-previews.js";
import { getImagePreview, MAX_IMAGE_PREVIEW_LENGTH } from "../../shared/image-preview.js";
import type { ImageResource } from "../../shared/types.js";

vi.mock("@agent-native/core/extensions/url-safety", () => ({ ssrfSafeFetch: vi.fn() }));
const source = "https://example.com/image.png";
const raster = () =>
  sharp({ create: { width: 900, height: 600, channels: 3, background: "red" } })
    .png()
    .toBuffer();
beforeEach(() => vi.resetAllMocks());
describe("tiny image previews", () => {
  it("keeps original pixels when compression fits the 8 KiB budget", async () => {
    const preview = await createImagePreview(await raster(), source);
    expect(preview).toMatchObject({ source, width: 900, height: 600 });
    expect(preview!.data.length).toBeLessThanOrEqual(MAX_IMAGE_PREVIEW_LENGTH);
    const decoded = await sharp(Buffer.from(preview!.data.split(",")[1], "base64")).metadata();
    expect(decoded).toMatchObject({ format: "webp", width: 900, height: 600 });
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
        preview: {
          ...preview,
          data: "data:image/webp;base64," + "A".repeat(MAX_IMAGE_PREVIEW_LENGTH),
        },
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

it("upgrades a legacy preview while preserving it when the source is unavailable", async () => {
  const image: ImageResource = {
    id: "old",
    image: source,
    preview: { source, data: "data:image/webp;base64,AAAA", width: 900, height: 600 },
  };
  vi.mocked(ssrfSafeFetch).mockRejectedValueOnce(new Error("offline"));
  expect(await generateImagePreview(image)).toBe(false);
  expect(image.preview?.data).toContain("AAAA");
  vi.mocked(ssrfSafeFetch).mockResolvedValueOnce(new Response(new Uint8Array(await raster())));
  expect(await generateImagePreview(image)).toBe(true);
  expect(image.preview?.version).toBe(2);
});
it("fits detailed images under 8 KiB while keeping their original layout dimensions", async () => {
  const { randomBytes } = await import("node:crypto");
  const input = await sharp(randomBytes(960 * 640 * 3), {
    raw: { width: 960, height: 640, channels: 3 },
  })
    .png()
    .toBuffer();
  const preview = (await createImagePreview(input, source))!;
  expect(preview.data.length).toBeLessThanOrEqual(8192);
  expect(preview.width).toBe(960);
  expect(preview.height).toBe(640);
  const decoded = await sharp(Buffer.from(preview.data.split(",")[1], "base64")).metadata();
  expect(decoded.width! / decoded.height!).toBeCloseTo(1.5, 1);
  expect(decoded.width).toBeGreaterThan(24);
});
