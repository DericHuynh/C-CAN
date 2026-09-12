import { beforeEach, expect, it, vi } from "vite-plus/test";
import { getVersionedResource } from "@agent-native/core/history";
import { getReviewableResource } from "@agent-native/core/review";
import { getProjectOrThrow, saveProject } from "../../actions/_project-store.js";
import "./project-resources.js";

vi.mock("../../actions/_project-store.js", () => ({
  getProjectOrThrow: vi.fn(),
  saveProject: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

it("uses the shared framework ACL for versions and reviews instead of overriding invited roles", () => {
  expect(getVersionedResource("project")?.resolveAccess).toBeUndefined();
  expect(getReviewableResource("project")?.resolveAccess).toBeUndefined();
});

it.each([
  null,
  {},
  { json: "bad", title: "Bad" },
  { json: "[]", title: "Bad" },
  { json: '{"rows":42}', title: "Bad" },
])("rejects invalid snapshots before changing a project: %j", async (snapshot) => {
  const restore = getVersionedResource("project")!.restoreSnapshot!;
  await expect(
    restore({ resourceType: "project", resourceId: "p", snapshot, version: {} as never }),
  ).rejects.toThrow();
  expect(saveProject).not.toHaveBeenCalled();
});

it("restores through the conditional save and blob boundary, preserving metadata in the same write", async () => {
  vi.mocked(getProjectOrThrow).mockResolvedValue({ row: { json: "current" }, app: {} } as never);
  const restore = getVersionedResource("project")!.restoreSnapshot!;
  await restore({
    resourceType: "project",
    resourceId: "p",
    snapshot: {
      json: '{"rows":[],"customField":"retained"}',
      title: "Checkpoint",
      description: null,
    },
    version: {} as never,
  });
  expect(saveProject).toHaveBeenCalledWith(
    "p",
    expect.objectContaining({ customField: "retained", rows: [] }),
    "current",
    { title: "Checkpoint", description: "" },
  );
});
