import { beforeEach, expect, it, vi } from "vite-plus/test";
import { executeProjectBuild, projectRevision } from "./workflow";
import { getProjectOrThrow, saveProject, insertProject, newProjectRow } from "./repository";
import { normalizeApp } from "../../shared/cyoa";
vi.mock("./repository", async (original) => ({
  ...(await original<typeof import("./repository")>()),
  getProjectOrThrow: vi.fn(),
  saveProject: vi.fn(),
  insertProject: vi.fn(),
}));
vi.mock("./events", () => ({ projectCreated: vi.fn() }));
vi.mock("../media/blob-images", () => ({ externalizeAppImages: vi.fn() }));
const ctx = { userEmail: "builder@local.test", orgId: "org", caller: "tool" as const };
const app = normalizeApp({ rows: [{ id: "r", objects: [{ id: "c", addons: [] }] }] });
const json = JSON.stringify(app);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getProjectOrThrow).mockResolvedValue({
    app: structuredClone(app),
    row: newProjectRow({ id: "p", json }),
  });
});
it("commits a mixed batch exactly once and uses the original document for compare-and-save", async () => {
  const result = await executeProjectBuild(
    {
      projectId: "p",
      expectedRevision: projectRevision(json),
      operations: [
        { op: "create", kind: "addon", id: "detail", parent: "c", fields: { title: "Detail" } },
        { op: "update", kind: "choice", id: "c", fields: { text: "new" } },
      ],
    },
    ctx,
  );
  expect(result.committed).toBe(true);
  expect(saveProject).toHaveBeenCalledTimes(1);
  expect(saveProject).toHaveBeenCalledWith("p", expect.anything(), json, undefined, {
    merge: false,
  });
  expect(getProjectOrThrow).toHaveBeenCalledWith("p", ctx, "editor");
});
it("writes nothing for stale revisions, invalid later operations or dry runs", async () => {
  const operations = [
    {
      op: "create" as const,
      kind: "addon" as const,
      id: "detail",
      parent: "c",
      fields: { title: "Detail" },
    },
  ];
  expect(
    (await executeProjectBuild({ projectId: "p", expectedRevision: "stale", operations }, ctx))
      .status,
  ).toBe("conflict");
  expect(
    (
      await executeProjectBuild(
        {
          projectId: "p",
          operations: [
            ...operations,
            { op: "update", kind: "choice", id: "missing", fields: { text: "new" } },
          ],
        },
        ctx,
      )
    ).committed,
  ).toBe(false);
  expect(
    (await executeProjectBuild({ projectId: "p", operations, dryRun: true }, ctx)).status,
  ).toBe("validated");
  expect(saveProject).not.toHaveBeenCalled();
  expect(insertProject).not.toHaveBeenCalled();
});
it("creates private caller-owned projects and refuses missing access", async () => {
  const operations = [
    { op: "create" as const, kind: "row" as const, id: "intro", fields: { title: "Intro" } },
  ];
  await executeProjectBuild({ title: "New story", operations }, ctx);
  expect(insertProject).toHaveBeenCalledWith(
    expect.objectContaining({
      ownerEmail: ctx.userEmail,
      orgId: "org",
      visibility: "private",
      title: "New story",
    }),
  );
  vi.mocked(getProjectOrThrow).mockRejectedValueOnce(new Error("Forbidden"));
  await expect(executeProjectBuild({ projectId: "p", operations }, ctx)).rejects.toThrow(
    "Forbidden",
  );
  await expect(executeProjectBuild({ operations })).rejects.toThrow("Sign in");
});
