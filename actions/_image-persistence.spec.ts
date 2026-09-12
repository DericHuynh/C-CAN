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
import { getProjectOrThrow } from "../server/projects/repository.js";
import addImage from "./add-image.js";
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
vi.mock("../server/db/schema.js", () => ({ projects: { id: "id", json: "json" } }));
vi.mock("../server/projects/repository.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../server/projects/repository.js")>()),
  getProjectOrThrow: vi.fn(),
}));

const dataUrl = "data:image/png;base64,aW1hZ2U=";
const storedUrl = "https://blob.test/image.png";
const set = vi.fn();
const insert = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  set.mockReturnValue({
    where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: "test" }]) }),
  });
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
  vi.mocked(getProjectOrThrow).mockResolvedValue({ app, row: { json: "original-json" } } as never);
  return { app, image };
}

describe("image persistence through actions", () => {
  it("creates an anonymous image and attaches it to a row in one persisted document", async () => {
    const { app } = fixture();
    const row = createDefaultRow(app, 0);
    row.image = "";
    app.rows = [row];
    const result = await addImage.run({
      projectId: "project-test",
      image: dataUrl,
      target: { kind: "row", id: row.id, expectedImage: "" },
    });
    const saved = JSON.parse(set.mock.calls[0][0].json);
    expect(set).toHaveBeenCalledOnce();
    expect(saved.rows[0].image).toBe(result.image.id);
    expect(result.image.anonymous).toBe(true);
    expect(result.image.createdAt).toMatch(/^\d{4}-/);
    expect(saved.images.find((entry: any) => entry.id === result.image.id).image).toBe(storedUrl);
  });
  it("rejects unknown or changed targets before uploading an image", async () => {
    const { app } = fixture();
    const row = createDefaultRow(app, 0);
    row.image = "existing";
    app.rows = [row];
    await expect(
      addImage.run({
        projectId: "project-test",
        image: dataUrl,
        target: { kind: "row", id: "missing" },
      }),
    ).rejects.toThrow();
    await expect(
      addImage.run({
        projectId: "project-test",
        image: dataUrl,
        target: { kind: "row", id: row.id, expectedImage: "old" },
      }),
    ).rejects.toThrow(/changed/);
    expect(uploadFile).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });
  it("does not attach an image if the target changes during upload", async () => {
    const { app } = fixture();
    const row = createDefaultRow(app, 0);
    row.image = "";
    app.rows = [row];
    vi.mocked(uploadFile).mockImplementation(async () => {
      row.image = "someone-elses-image";
      return { url: storedUrl, provider: "test", id: "image" };
    });
    await expect(
      addImage.run({
        projectId: "project-test",
        image: dataUrl,
        target: { kind: "row", id: row.id, expectedImage: "" },
      }),
    ).rejects.toThrow(/changed/);
    expect(set).not.toHaveBeenCalled();
    expect(row.image).toBe("someone-elses-image");
  });

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
