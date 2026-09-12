import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { uploadFile } from "@agent-native/core/file-upload";
import { completeRun, startRun } from "@agent-native/core/progress";

import { getDb } from "../server/db/index.js";
import {
  createDefaultApp,
  createDefaultChoice,
  createDefaultImageResource,
  createDefaultRow,
} from "../shared/cyoa.js";
import { getProjectOrThrow } from "./_project-store.js";
import updateImage from "./update-image.js";
import patchAppDocument from "./patch-app-document.js";
import importProject from "./import-project-json.js";

vi.mock("@agent-native/core/file-upload", () => ({ uploadFile: vi.fn() }));
vi.mock("@agent-native/core/sharing", () => ({ assertAccess: vi.fn() }));
vi.mock("@agent-native/core/notifications", () => ({ notify: vi.fn() }));
vi.mock("@agent-native/core/progress", () => ({
  startRun: vi.fn(),
  updateRunProgress: vi.fn(),
  completeRun: vi.fn(),
}));
vi.mock("../server/db/index.js", () => ({ getDb: vi.fn() }));
vi.mock("../server/db/schema.js", () => ({ projects: { id: "id" } }));
vi.mock("./_project-store.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./_project-store.js")>()),
  getProjectOrThrow: vi.fn(),
}));

const dataUrl = "data:image/png;base64,aW1hZ2U=";
const storedUrl = "https://blob.test/image.png";
const set = vi.fn();
const insert = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  set.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
  vi.mocked(getDb).mockReturnValue({ update: () => ({ set }), insert } as never);
  vi.mocked(uploadFile).mockResolvedValue({ url: storedUrl, provider: "test", id: "image" });
  vi.mocked(startRun).mockResolvedValue({ id: "run-test" } as never);
});

function fixture() {
  const app = createDefaultApp();
  const image = createDefaultImageResource("Portrait");
  image.image = "https://example.com/old.png";
  app.images = [image];
  vi.mocked(getProjectOrThrow).mockResolvedValue({ app } as never);
  return { app, image };
}

describe("image persistence through actions", () => {
  it("externalizes private border images and sound effects before storing imported JSON", async () => {
    const result = await importProject.run({
      json: {
        version: "2.9.29",
        rows: [{ id: "row", styling: { rowBorderImage: dataUrl }, objects: [] }],
        soundEffects: [{ id: "sfx", audio: "data:audio/wav;base64,AA==" }],
      },
    });
    expect(result.app.images[0].image).toBe(storedUrl);
    expect(result.app.soundEffects[0].audio).toBe(storedUrl);
    expect(insert.mock.results[0].value.values.mock.calls[0][0].json).not.toContain("data:");
  });

  it.each(["null", "[]", "123", '{"rows":{}}'])(
    "rejects non-documents without storing an empty project: %s",
    async (json) => {
      await expect(importProject.run({ json })).rejects.toThrow();
      expect(insert).not.toHaveBeenCalled();
    },
  );
  it("imports embedded images as stored URLs even with a stale URL flag", async () => {
    const { app, image } = fixture();
    image.image = dataUrl;
    image.imageIsURL = true;
    const result = await importProject.run({ json: app });
    expect(result.app.images[0].image).toBe(storedUrl);
    expect(insert).toHaveBeenCalledOnce();
    expect(insert.mock.results[0].value.values.mock.calls[0][0].json).not.toContain("data:");
    expect(completeRun).toHaveBeenCalledWith("run-test", "unknown", "succeeded");
  });

  it("marks malformed JSON imports as failed", async () => {
    await expect(importProject.run({ json: "{" })).rejects.toThrow("Invalid JSON");
    expect(insert).not.toHaveBeenCalled();
    expect(completeRun).toHaveBeenCalledWith("run-test", "unknown", "failed");
  });

  it("externalizes image replacements and returns the stored URL", async () => {
    const { image } = fixture();
    const result = await updateImage.run({
      projectId: "project-test",
      imageId: image.id,
      patch: { image: dataUrl },
    });
    expect(uploadFile).toHaveBeenCalledOnce();
    expect(result.image.image).toBe(storedUrl);
    expect(result.image.imageIsURL).toBe(true);
    expect(set.mock.calls[0][0].json).not.toContain("data:");
  });

  it("externalizes legacy inline images in whole-document patches", async () => {
    const { app } = fixture();
    const row = createDefaultRow(app, 0);
    const choice = createDefaultChoice(app, 0);
    choice.image = dataUrl;
    row.objects = [choice];
    await patchAppDocument.run({ projectId: "project-test", patch: { rows: [row] } });
    expect(uploadFile).toHaveBeenCalledOnce();
    const saved = JSON.parse(set.mock.calls[0][0].json);
    expect(
      saved.images.find((image: { id: string }) => image.id === saved.rows[0].objects[0].image)
        .image,
    ).toBe(storedUrl);
    expect(set.mock.calls[0][0].json).not.toContain("data:");
  });

  it("does not save an image update when blob storage is unavailable", async () => {
    const { image } = fixture();
    vi.mocked(uploadFile).mockResolvedValue(null);
    await expect(
      updateImage.run({
        projectId: "project-test",
        imageId: image.id,
        patch: { image: dataUrl },
      }),
    ).rejects.toThrow(/storage|provider/i);
    expect(set).not.toHaveBeenCalled();
  });

  it("does not insert an imported project when image upload fails", async () => {
    const { app, image } = fixture();
    image.image = dataUrl;
    image.imageIsURL = false;
    vi.mocked(uploadFile).mockRejectedValue(new Error("Upload failed"));
    await expect(importProject.run({ json: app })).rejects.toThrow("Upload failed");
    expect(insert).not.toHaveBeenCalled();
    expect(completeRun).toHaveBeenCalledWith("run-test", "unknown", "failed");
  });
});
