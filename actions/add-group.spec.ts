import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { createDefaultApp } from "../shared/cyoa.js";
import { getProjectOrThrow, saveProject } from "./_project-store.js";
import addGroup from "./add-group.js";

vi.mock("./_project-store.js", () => ({ getProjectOrThrow: vi.fn(), saveProject: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

describe("add-group", () => {
  it("persists the initial membership submitted by the editor", async () => {
    const app = createDefaultApp();
    vi.mocked(getProjectOrThrow).mockResolvedValue({ app } as Awaited<
      ReturnType<typeof getProjectOrThrow>
    >);
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
    expect(saveProject).toHaveBeenCalledExactlyOnceWith("test", app);
  });

  it("still allows creating an empty group with the original action input", async () => {
    const app = createDefaultApp();
    vi.mocked(getProjectOrThrow).mockResolvedValue({ app } as Awaited<
      ReturnType<typeof getProjectOrThrow>
    >);
    const { group } = await addGroup.run({ projectId: "test" });
    expect(group).toMatchObject({ name: "Group", rowElements: [], elements: [] });
  });
});
