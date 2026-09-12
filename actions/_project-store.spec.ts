import { beforeEach, expect, it, vi } from "vite-plus/test";
import { getDb } from "../server/db/index.js";
import { createDefaultApp } from "../shared/cyoa.js";
import { saveProject } from "./_project-store.js";

vi.mock("../server/db/index.js", () => ({ getDb: vi.fn() }));
vi.mock("../server/db/schema.js", () => ({ projects: { id: "id", json: "json" } }));
vi.mock("@agent-native/core/sharing", () => ({ assertAccess: vi.fn() }));
vi.mock("./_blob-images.js", () => ({ externalizeAppImages: vi.fn() }));
const returning = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getDb).mockReturnValue({
    update: () => ({ set: () => ({ where: () => ({ returning }) }) }),
  } as never);
});
it("rejects a planning save when its conditional database update loses a race", async () => {
  returning.mockResolvedValue([]);
  await expect(saveProject("project-test", createDefaultApp(), "old-json")).rejects.toThrow(
    /Project changed while saving/,
  );
});
it("accepts a planning save when the stored document still matches", async () => {
  returning.mockResolvedValue([{ id: "project-test" }]);
  await expect(
    saveProject("project-test", createDefaultApp(), "old-json"),
  ).resolves.toBeUndefined();
});
