import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  registerFileUploadProvider,
  unregisterFileUploadProvider,
} from "@agent-native/core/file-upload";

import { externalizeAppImages, isDataUrlImage, uploadDataUrlImage } from "./_blob-images.js";

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** Deterministic provider that records uploaded payloads. */
function registerFakeProvider() {
  const uploaded: Array<{ data: Uint8Array; mimeType?: string; url: string }> = [];
  registerFileUploadProvider({
    id: "fake-test",
    name: "Fake test provider",
    isConfigured: () => true,
    upload: async ({ data, mimeType }) => {
      const url = `https://blob.test/${uploaded.length}.png`;
      uploaded.push({ data, mimeType, url });
      return { url, provider: "fake-test", id: String(uploaded.length) };
    },
  });
  return uploaded;
}

beforeEach(() => {
  unregisterFileUploadProvider("fake-test");
});

describe("isDataUrlImage", () => {
  it("detects data URLs", () => {
    expect(isDataUrlImage(PNG_DATA_URL)).toBe(true);
    expect(isDataUrlImage("https://example.com/a.png")).toBe(false);
    expect(isDataUrlImage("image-id-123")).toBe(false);
    expect(isDataUrlImage(undefined)).toBe(false);
    expect(isDataUrlImage("")).toBe(false);
  });
});

describe("uploadDataUrlImage", () => {
  it("uploads a base64 data URL and returns the provider URL", async () => {
    const uploaded = registerFakeProvider();
    const url = await uploadDataUrlImage(PNG_DATA_URL);
    expect(url).toBe("https://blob.test/0.png");
    expect(uploaded).toHaveLength(1);
    expect(uploaded[0].mimeType).toBe("image/png");
    // The uploaded bytes decode back to a valid PNG signature.
    const bytes = Buffer.from(uploaded[0].data as Uint8Array);
    expect(bytes.subarray(0, 4).toString("hex")).toBe("89504e47");
  });

  it("handles non-base64 (percent-encoded) data URLs", async () => {
    const uploaded = registerFakeProvider();
    const url = await uploadDataUrlImage("data:text/plain,hello%20world");
    expect(url).toBe("https://blob.test/0.png");
    expect(uploaded[0].mimeType).toBe("text/plain");
    expect(Buffer.from(uploaded[0].data as Uint8Array).toString("utf8")).toBe("hello world");
  });

  it("accepts data URLs with MIME parameters", async () => {
    const uploaded = registerFakeProvider();
    expect(await uploadDataUrlImage("data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E")).toBe(
      "https://blob.test/0.png",
    );
    expect(uploaded[0].mimeType).toBe("image/svg+xml");
    expect(Buffer.from(uploaded[0].data).toString("utf8")).toBe("<svg/>");
  });

  it("rejects embedded images when no provider is configured", async () => {
    unregisterFileUploadProvider("fake-test");
    await expect(uploadDataUrlImage(PNG_DATA_URL)).rejects.toThrow(/storage|provider/i);
  });

  it("passes through non-data-URL values untouched", async () => {
    registerFakeProvider();
    expect(await uploadDataUrlImage("https://example.com/a.png")).toBe("https://example.com/a.png");
  });
});

describe("externalizeAppImages", () => {
  it("moves data-URL payloads to blob storage and flags them as URLs", async () => {
    registerFakeProvider();
    const app = {
      images: [
        { id: "i1", name: "inline", image: PNG_DATA_URL, imageIsURL: false },
        { id: "i2", name: "remote", image: "https://example.com/b.png", imageIsURL: true },
        { id: "i3", name: "missing payload", image: "", imageIsURL: false },
      ],
    } as never;

    const moved = await externalizeAppImages(app);
    expect(moved).toBe(1);
    const images = (app as { images: Array<Record<string, unknown>> }).images;
    expect(images[0].image).toBe("https://blob.test/0.png");
    expect(images[0].imageIsURL).toBe(true);
    // Remote + empty payloads untouched.
    expect(images[1].image).toBe("https://example.com/b.png");
    expect(images[2].image).toBe("");
    expect(images[2].imageIsURL).toBe(false);
  });

  it("is idempotent — already-externalized images are never re-uploaded", async () => {
    registerFakeProvider();
    const app = {
      images: [{ id: "i1", name: "done", image: "https://blob.test/0.png", imageIsURL: true }],
    } as never;

    const moved = await externalizeAppImages(app);
    expect(moved).toBe(0);
  });

  it("rejects documents with embedded images when storage is unavailable", async () => {
    unregisterFileUploadProvider("fake-test");
    const app = {
      images: [{ id: "i1", name: "inline", image: PNG_DATA_URL, imageIsURL: false }],
    } as never;

    await expect(externalizeAppImages(app)).rejects.toThrow(/storage|provider/i);
    const images = (app as { images: Array<Record<string, unknown>> }).images;
    expect(images[0].image).toBe(PNG_DATA_URL);
    expect(images[0].imageIsURL).toBe(false);
  });

  it("tolerates a missing images collection", async () => {
    registerFakeProvider();
    expect(await externalizeAppImages({} as never)).toBe(0);
    expect(await externalizeAppImages({ images: undefined } as never)).toBe(0);
  });

  it("externalizes data URLs even when their imageIsURL flag is stale", async () => {
    const uploaded = registerFakeProvider();
    const app = { images: [{ id: "i1", name: "inline", image: PNG_DATA_URL, imageIsURL: true }] };
    expect(await externalizeAppImages(app)).toBe(1);
    expect(uploaded).toHaveLength(1);
    expect(app.images[0].image).toBe("https://blob.test/0.png");
  });

  it("rejects malformed data URLs rather than returning them for SQL storage", async () => {
    await expect(uploadDataUrlImage("data:image/png;base64")).rejects.toThrow(/data URL/i);
  });
});
