import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createDefaultApp, createDefaultRow } from "../shared/cyoa.js";
import { getProjectOrThrow, saveProject } from "../server/projects/repository.js";
import save from "./save-live-project-fields.js";
vi.mock("../server/projects/repository.js", () => ({
  getProjectOrThrow: vi.fn(),
  saveProject: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());
function setup() {
  const app = createDefaultApp();
  app.rows = [{ ...createDefaultRow(app, 0), id: "r", title: "Before", titleText: "Prose" }];
  vi.mocked(getProjectOrThrow).mockResolvedValue({
    app,
    row: { json: "read-version", title: "Project", description: "" },
  } as Awaited<ReturnType<typeof getProjectOrThrow>>);
  return app;
}
describe("live field autosave", () => {
  it("atomically saves independent fields using editor access and the read version", async () => {
    const app = setup();
    const result = await save.run({
      projectId: "p",
      fields: [
        { path: ["rows", "r", "title"], base: "Before", value: "After" },
        { path: ["rows", "r", "titleText"], base: "Prose", value: "More prose" },
      ],
    });
    expect(getProjectOrThrow).toHaveBeenCalledWith("p", undefined, "editor");
    expect(saveProject).toHaveBeenCalledExactlyOnceWith(
      "p",
      expect.objectContaining({
        rows: [expect.objectContaining({ title: "After", titleText: "More prose" })],
      }),
      "read-version",
      undefined,
    );
    expect(app.rows[0].title).toBe("Before");
    expect(result.fields).toHaveLength(2);
  });
  it("rejects the whole batch when any field overlaps a newer agent save", async () => {
    setup();
    await expect(
      save.run({
        projectId: "p",
        fields: [
          { path: ["rows", "r", "title"], base: "Before", value: "After" },
          { path: ["rows", "r", "titleText"], base: "Outdated", value: "Conflict" },
        ],
      }),
    ).rejects.toThrow();
    expect(saveProject).not.toHaveBeenCalled();
  });
  it("does not recreate a removed target or change an entity identity", async () => {
    setup();
    await expect(
      save.run({
        projectId: "p",
        fields: [{ path: ["rows", "deleted", "title"], base: "Before", value: "After" }],
      }),
    ).rejects.toThrow();
    await expect(
      save.run({
        projectId: "p",
        fields: [{ path: ["rows", "r", "id"], base: "r", value: "new" }],
      }),
    ).rejects.toThrow();
    expect(saveProject).not.toHaveBeenCalled();
  });
  it("does not rewrite SQL when another peer has already committed the same text", async () => {
    setup();
    await save.run({
      projectId: "p",
      fields: [{ path: ["rows", "r", "title"], base: "Earlier", value: "Before" }],
    });
    expect(saveProject).not.toHaveBeenCalled();
  });
});
