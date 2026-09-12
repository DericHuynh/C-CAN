import { beforeEach, expect, it, vi } from "vite-plus/test";
import { getDb } from "../db/index.js";
import { createDefaultApp } from "../../shared/cyoa.js";
import { saveProject } from "./repository.js";

vi.mock("../db/index.js", () => ({ getDb: vi.fn() }));
vi.mock("../db/schema.js", () => ({ projects: { id: "id", json: "json" } }));
vi.mock("@agent-native/core/sharing", () => ({ assertAccess: vi.fn() }));
vi.mock("../media/blob-images.js", () => ({ externalizeAppImages: vi.fn() }));
vi.mock("@agent-native/core/server", () => ({
  recordChange: vi.fn(),
  getRequestRunContext: vi.fn(),
}));
const returning = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getDb).mockReturnValue({
    update: () => ({ set: () => ({ where: () => ({ returning }) }) }),
  } as never);
});
it("rejects a planning save when its conditional database update loses a race", async () => {
  returning.mockResolvedValue([]);
  await expect(
    saveProject("project-test", createDefaultApp(), "old-json", undefined, { merge: false }),
  ).rejects.toThrow(/Project changed while saving/);
});
it("accepts a planning save when the stored document still matches", async () => {
  returning.mockResolvedValue([{ id: "project-test" }]);
  await expect(
    saveProject("project-test", createDefaultApp(), "old-json"),
  ).resolves.toBeUndefined();
});
