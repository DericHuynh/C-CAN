import { beforeEach, expect, it, vi } from "vite-plus/test";
import { createDefaultApp } from "../shared/cyoa.js";
import { getProjectOrThrow, saveProject } from "./_project-store.js";
import { generateImagePreview } from "./_image-previews.js";
import action from "./generate-image-previews.js";

vi.mock("./_project-store.js", () => ({ getProjectOrThrow: vi.fn(), saveProject: vi.fn() }));
vi.mock("./_image-previews.js", () => ({ generateImagePreview: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

it("merges generated previews into the latest project without overwriting concurrent edits", async () => {
  const app = createDefaultApp();
  app.images = ["kept", "replaced", "deleted"].map((id) => ({
    id,
    image: `https://example.com/${id}.png`,
  }));
  const latest = structuredClone(app);
  latest.images[0].name = "Edited while downloading";
  latest.images[1].image = "https://example.com/replacement.png";
  latest.images.pop();
  vi.mocked(getProjectOrThrow)
    .mockResolvedValueOnce({ app } as never)
    .mockResolvedValueOnce({ app: latest } as never);
  vi.mocked(generateImagePreview).mockImplementation(async (image) => {
    image.preview = {
      source: image.image!,
      data: "data:image/webp;base64,AAAA",
      width: 10,
      height: 10,
    };
    return true;
  });
  const result = await action.run({
    projectId: "test",
    imageIds: ["kept", "replaced", "deleted", "unknown"],
  });
  expect(result.generated).toEqual(["kept"]);
  expect(result.failed).toEqual(["replaced", "deleted", "unknown"]);
  expect(latest.images[0].name).toBe("Edited while downloading");
  expect(latest.images[0].preview).toBeDefined();
  expect(latest.images[1].preview).toBeUndefined();
  expect(saveProject).toHaveBeenCalledWith("test", latest);
});

it("does not rewrite the project if no preview could be generated", async () => {
  const app = createDefaultApp();
  app.images = [{ id: "bad", image: "https://example.com/unavailable.png" }];
  vi.mocked(getProjectOrThrow).mockResolvedValue({ app } as never);
  vi.mocked(generateImagePreview).mockResolvedValue(false);
  expect(await action.run({ projectId: "test", imageIds: ["bad"] })).toEqual({
    generated: [],
    skipped: [],
    failed: ["bad"],
  });
  expect(saveProject).not.toHaveBeenCalled();
});
