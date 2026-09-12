import { beforeEach, expect, it, vi } from "vite-plus/test";
import { getDb } from "../server/db/index.js";
import { createDefaultApp } from "../shared/cyoa.js";
import { getProjectOrThrow, newProjectRow } from "../server/projects/repository.js";
import duplicateProject from "./duplicate-project.js";

vi.mock("../server/db/index.js", () => ({ getDb: vi.fn() }));
vi.mock("@agent-native/core/notifications", () => ({ notify: vi.fn() }));
vi.mock("../server/projects/repository.js", async (original) => ({
  ...(await original<typeof import("../server/projects/repository.js")>()),
  getProjectOrThrow: vi.fn(),
}));

const values = vi.fn();
const ctx = { caller: "frontend" as const, userEmail: "copier@example.test", orgId: "copier-org" };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDb).mockReturnValue({ insert: () => ({ values }) } as never);
  vi.mocked(getProjectOrThrow).mockResolvedValue({
    row: newProjectRow({
      id: "source",
      title: "Shared story",
      json: "{}",
      ownerEmail: "author@example.test",
      orgId: "author-org",
      visibility: "public",
    }),
    app: createDefaultApp(),
  });
});

it("makes a shared project's copy private and owned by the caller's active organization", async () => {
  const result = await duplicateProject.run({ id: "source" }, ctx);
  expect(getProjectOrThrow).toHaveBeenCalledWith("source", ctx, "viewer");
  expect(values).toHaveBeenCalledWith(
    expect.objectContaining({
      id: result.id,
      ownerEmail: ctx.userEmail,
      orgId: ctx.orgId,
      visibility: "private",
      isSeed: 0,
    }),
  );
  expect(result.id).not.toBe("source");
  expect(result.title).toBe("Shared story (Copy)");
});

it("does not carry the source organization into a personal copy", async () => {
  await duplicateProject.run({ id: "source" }, { ...ctx, orgId: null });
  expect(values).toHaveBeenCalledWith(
    expect.objectContaining({ ownerEmail: ctx.userEmail, orgId: null }),
  );
});

it("refuses to create an ownerless copy", async () => {
  await expect(duplicateProject.run({ id: "source" }, { caller: "cli" })).rejects.toThrow(
    "Sign in",
  );
  expect(getProjectOrThrow).not.toHaveBeenCalled();
  expect(values).not.toHaveBeenCalled();
});

it("requires source access before creating the copy", async () => {
  vi.mocked(getProjectOrThrow).mockRejectedValueOnce(new Error("Forbidden"));
  await expect(duplicateProject.run({ id: "source" }, ctx)).rejects.toThrow("Forbidden");
  expect(values).not.toHaveBeenCalled();
});
