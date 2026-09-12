import { beforeEach, expect, it, vi } from "vite-plus/test";
import { getDb } from "../server/db/index.js";
import { projectCreated } from "../server/projects/events.js";
import { createDefaultApp } from "../shared/cyoa.js";
import { getProjectOrThrow, newProjectRow } from "../server/projects/repository.js";
import create from "./create-project.js";
import importProject from "./import-project-json.js";
import duplicate from "./duplicate-project.js";

vi.mock("../server/db/index.js", () => ({ getDb: vi.fn() }));
vi.mock("../server/projects/events.js", () => ({ projectCreated: vi.fn() }));
vi.mock("@agent-native/core/notifications", () => ({ notify: vi.fn() }));
vi.mock("@agent-native/core/progress", () => ({
  startRun: vi.fn(),
  updateRunProgress: vi.fn(),
  completeRun: vi.fn(),
}));
vi.mock("../server/media/blob-images.js", () => ({
  externalizeAppImages: vi.fn().mockResolvedValue(0),
}));
vi.mock("../server/projects/repository.js", async (original) => ({
  ...(await original<typeof import("../server/projects/repository.js")>()),
  getProjectOrThrow: vi.fn(),
}));
const values = vi.fn();
const ctx = {
  caller: "frontend" as const,
  userEmail: "creator@example.test",
  orgId: "creator-org",
};
beforeEach(() => {
  vi.clearAllMocks();
  values.mockReset();
  vi.mocked(getDb).mockReturnValue({ insert: () => ({ values }) } as never);
  vi.mocked(getProjectOrThrow).mockResolvedValue({
    app: createDefaultApp(),
    row: newProjectRow({ id: "source", json: "{}", ownerEmail: "other@example.test" }),
  });
});
const scenarios = [
  { source: "create", run: () => create.run({}, ctx) },
  { source: "import", run: () => importProject.run({ json: {} }, ctx) },
  { source: "duplicate", run: () => duplicate.run({ id: "source" }, ctx) },
];
it.each(scenarios)(
  "publishes $source with the new ID after persistence",
  async ({ source, run }) => {
    values.mockImplementation(async () => {
      expect(projectCreated).not.toHaveBeenCalled();
    });
    const result = await run();
    expect(projectCreated).toHaveBeenCalledExactlyOnceWith(result.id, source, ctx);
    expect(result.id).not.toBe("source");
  },
);
it.each(scenarios)("does not publish $source when persistence fails", async ({ run }) => {
  values.mockRejectedValue(new Error("Database unavailable"));
  await expect(run()).rejects.toThrow("Database unavailable");
  expect(projectCreated).not.toHaveBeenCalled();
});
