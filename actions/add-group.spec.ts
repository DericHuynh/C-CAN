import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { createDefaultApp } from "../shared/cyoa.js";
import { getProjectOrThrow, saveProject } from "../server/projects/repository.js";
import addGroup from "./add-group.js";

vi.mock("../server/projects/repository.js", () => ({
  getProjectOrThrow: vi.fn(),
  saveProject: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

describe("add-group", () => {
  it("persists the initial membership submitted by the editor", async () => {
    const app = createDefaultApp();
    vi.mocked(getProjectOrThrow).mockResolvedValue({
      app,
      row: { json: "original-json" },
    } as Awaited<ReturnType<typeof getProjectOrThrow>>);
    const { group } = await addGroup.run({
      projectId: "test",
      name: "Classes",
      rowElements: ["row"],
      elements: ["mage", "mage", "fighter"],
    });
    expect(group).toMatchObject({
      name: "Classes",
      rowElements: ["row"],
      elements: ["mage", "fighter"],
    });
    expect(app.groups).toContain(group);
    expect(saveProject).toHaveBeenCalledExactlyOnceWith("test", app, "original-json");
  });

  it("still allows creating an empty group with the original action input", async () => {
    const app = createDefaultApp();
    vi.mocked(getProjectOrThrow).mockResolvedValue({
      app,
      row: { json: "original-json" },
    } as Awaited<ReturnType<typeof getProjectOrThrow>>);
    const { group } = await addGroup.run({ projectId: "test" });
    expect(group).toMatchObject({ name: "Group", rowElements: [], elements: [] });
  });
});
