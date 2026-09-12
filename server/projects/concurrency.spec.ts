import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { assertAccess } from "@agent-native/core/sharing";
import { getDb } from "../db/index.js";
import { projects } from "../db/schema.js";
import { createDefaultApp, createDefaultRow } from "../../shared/cyoa.js";
import { getProjectOrThrow, newProjectRow, saveProject } from "./repository.js";
import { externalizeAppImages } from "../media/blob-images.js";
import updateSettings from "../../actions/update-project-settings.js";
import { seedIfEmpty } from "../db/seed.js";
import { recordChange } from "@agent-native/core/server";

vi.mock("../db/index.js", () => ({ getDb: vi.fn() }));
vi.mock("../media/blob-images.js", () => ({ externalizeAppImages: vi.fn() }));
vi.mock("@agent-native/core/server", () => ({
  recordChange: vi.fn(),
  getRequestRunContext: vi.fn(),
}));
vi.mock("@agent-native/core/sharing", async (original) => ({
  ...(await original<typeof import("@agent-native/core/sharing")>()),
  assertAccess: vi.fn(),
}));

let database: ReturnType<typeof drizzle>;
let close: () => Promise<void>;
const ctx = { userEmail: "editor@example.test", orgId: "org-a", caller: "cli" as const };
beforeEach(async () => {
  vi.resetAllMocks();
  const client = new PGlite();
  database = drizzle(client);
  close = () => client.close();
  await client.exec(`CREATE TABLE projects (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, json TEXT NOT NULL,
    owner_email TEXT, org_id TEXT, visibility TEXT NOT NULL DEFAULT 'private',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, is_seed INTEGER NOT NULL DEFAULT 0
  )`);
  vi.mocked(getDb).mockReturnValue(database as unknown as ReturnType<typeof getDb>);
  const app = createDefaultApp();
  app.rows = [createDefaultRow(app, 0)];
  await getDb()
    .insert(projects)
    .values(newProjectRow({ id: "p", json: JSON.stringify(app), ownerEmail: ctx.userEmail }));
});
afterEach(() => close?.());

it("clears only assignments of deleted categories in the same settings save", async () => {
  const { app, row } = await getProjectOrThrow("p", ctx);
  app.categories = [
    { idx: 0, type: "word", name: "Words" },
    { idx: 0, type: "variable", name: "Flags" },
  ];
  app.words = [{ id: "hero", replaceText: "Traveler", category: 0 }];
  app.variables = [{ id: "flag", isTrue: true, category: 0 }];
  await saveProject("p", app, row.json);
  await updateSettings.run({ projectId: "p", patch: { categories: [app.categories[1]] } }, ctx);
  const saved = await getProjectOrThrow("p", ctx);
  expect(saved.app.words[0]).toEqual({ id: "hero", replaceText: "Traveler" });
  expect(saved.app.variables[0].category).toBe(0);
  await updateSettings.run({ projectId: "p", patch: { categories: app.categories } }, ctx);
  expect((await getProjectOrThrow("p", ctx)).app.words[0].category).toBeUndefined();
});

it("seeds a fresh SQL database with valid timestamps exactly once", async () => {
  await database.delete(projects);
  await seedIfEmpty();
  await seedIfEmpty();
  const rows = await database.select().from(projects);
  expect(rows).toHaveLength(1);
  expect(rows[0].isSeed).toBe(1);
  expect(Number.isFinite(Date.parse(rows[0].createdAt))).toBe(true);
  expect(Number.isFinite(Date.parse(rows[0].updatedAt))).toBe(true);
});

it("merges disjoint edits from the same saved document", async () => {
  const first = await getProjectOrThrow("p", ctx);
  const second = await getProjectOrThrow("p", ctx);
  first.app.rows[0].title = "Saved by first editor";
  second.app.rows[0].titleText = "Saved by second editor";
  await saveProject("p", first.app, first.row.json);
  await saveProject("p", second.app, second.row.json);
  const saved = await getProjectOrThrow("p", ctx);
  expect(saved.app.rows[0].title).toBe("Saved by first editor");
  expect(saved.app.rows[0].titleText).toBe("Saved by second editor");
  expect(recordChange).toHaveBeenLastCalledWith(
    expect.objectContaining({
      source: "collab",
      type: "project-saved",
      resourceType: "project",
      resourceId: "p",
      owner: ctx.userEmail,
    }),
  );
  expect(assertAccess).toHaveBeenCalledWith("project", "p", "editor", ctx);
});

it("rejects overlapping field edits without losing either saved content or metadata", async () => {
  const first = await getProjectOrThrow("p", ctx);
  const second = await getProjectOrThrow("p", ctx);
  first.app.rows[0].title = "First editor";
  second.app.rows[0].title = "Second editor";
  await saveProject("p", first.app, first.row.json);
  await expect(saveProject("p", second.app, second.row.json)).rejects.toThrow(
    /Another editor changed/,
  );
  expect((await getProjectOrThrow("p", ctx)).app.rows[0].title).toBe("First editor");
});

it("uses browser baselines to merge different settings and reject stale same-field edits", async () => {
  const { app } = await getProjectOrThrow("p", ctx);
  const base = { viewerConfig: app.viewerConfig };
  await updateSettings.run({ projectId: "p", patch: { viewerConfig: { title: "Remote" } } }, ctx);
  await updateSettings.run(
    {
      projectId: "p",
      base,
      patch: { viewerConfig: { ...app.viewerConfig, loadingText: "Local" } },
    },
    ctx,
  );
  const saved = await getProjectOrThrow("p", ctx);
  expect(saved.app.viewerConfig.title).toBe("Remote");
  expect(saved.app.viewerConfig.loadingText).toBe("Local");
  await updateSettings.run(
    { projectId: "p", base, patch: { viewerConfig: { loadingBgColor: "#11223344" } } },
    ctx,
  );
  expect((await getProjectOrThrow("p", ctx)).app.viewerConfig.title).toBe("Remote");
  await expect(
    updateSettings.run(
      { projectId: "p", base, patch: { viewerConfig: { ...app.viewerConfig, title: "Stale" } } },
      ctx,
    ),
  ).rejects.toThrow(/Another editor changed/);
});

it("requires a baseline before performing uploads or database work", async () => {
  // Runtime callers must not bypass the TypeScript requirement.
  await expect(saveProject("p", createDefaultApp(), undefined as never)).rejects.toThrow(
    /read version is required/,
  );
  expect(externalizeAppImages).not.toHaveBeenCalled();
});

it("leaves both metadata and content intact when a restore loses the write race", async () => {
  const stale = await getProjectOrThrow("p", ctx);
  const winner = await getProjectOrThrow("p", ctx);
  winner.app.rows[0].title = "Winner";
  await saveProject("p", winner.app, winner.row.json);
  await expect(
    saveProject("p", stale.app, stale.row.json, {
      title: "Stale checkpoint",
      description: "Stale",
    }),
  ).rejects.toThrow(/Project changed/);
  const saved = await getProjectOrThrow("p", ctx);
  expect(saved.row.title).not.toBe("Stale checkpoint");
  expect(saved.app.rows[0].title).toBe("Winner");
});

it("does not partially save settings metadata when media persistence fails", async () => {
  const before = await getProjectOrThrow("p", ctx);
  vi.mocked(externalizeAppImages).mockRejectedValueOnce(new Error("Upload unavailable"));
  await expect(
    updateSettings.run(
      { projectId: "p", patch: { description: "Must not persist", title: "New viewer title" } },
      { ...ctx, caller: "tool" },
    ),
  ).rejects.toThrow("Upload unavailable");
  const after = await getProjectOrThrow("p", ctx);
  expect(after.row.description).toBe(before.row.description);
  expect(after.row.json).toBe(before.row.json);
});
