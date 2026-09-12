import { beforeEach, expect, it, vi } from "vite-plus/test";
import {
  createDefaultApp,
  createDefaultRow,
  createDefaultChoice,
  createDefaultAddon,
} from "../shared/cyoa.js";
import { getProjectOrThrow, newProjectRow } from "./_project-store.js";
import search from "./search-project-content.js";

vi.mock("./_project-store.js", async (original) => ({
  ...(await original<typeof import("./_project-store.js")>()),
  getProjectOrThrow: vi.fn(),
}));
const ctx = { caller: "tool" as const, userEmail: "reader@example.test", orgId: "org-a" };
const args = { projectId: "p/?", query: "", offset: 0, limit: 20 };

beforeEach(() => vi.resetAllMocks());
function fixture() {
  const app = createDefaultApp();
  const row = {
    ...createDefaultRow(app, 0),
    id: "r&?",
    title: "Opening",
    titleText: "Starry night",
  };
  const choice = {
    ...createDefaultChoice(app, 0),
    id: "c/#",
    title: "Sleep &amp; dream",
    text: "Follow the stars",
    isSelectable: false,
  };
  const addon = {
    ...createDefaultAddon(app),
    id: "a?&",
    title: "Details",
    text: "Hidden starlight",
  };
  choice.addons = [addon];
  row.objects = [choice];
  app.rows = [row];
  vi.mocked(getProjectOrThrow).mockResolvedValue({
    app,
    row: newProjectRow({ id: args.projectId, json: "{}" }),
  });
  return { app, row, choice, addon };
}

it("returns paged saved passages including nonselectable content and addon parents", async () => {
  const { row, choice, addon } = fixture();
  const first = await search.run({ ...args, query: "STAR", limit: 2 }, ctx);
  expect(getProjectOrThrow).toHaveBeenCalledWith(args.projectId, ctx, "viewer");
  expect(first).toMatchObject({ total: 3, nextOffset: 2 });
  expect(first.results.map((result) => result.kind)).toEqual(["row", "choice"]);
  const second = await search.run({ ...args, query: "star", limit: 2, offset: 2 }, ctx);
  expect(second).toMatchObject({ total: 3, nextOffset: null });
  expect(second.results[0].target).toEqual({
    rowId: row.id,
    choiceId: choice.id,
    addonId: addon.id,
  });
  const url = new URL(second.results[0].viewerPath, "https://example.test");
  expect(url.pathname).toBe("/projects/p%2F%3F/viewer");
  expect(Object.fromEntries(url.searchParams)).toEqual(second.results[0].target);
  expect(second.results[0].editorPath).toContain("/editor?");
});

it("bounds excerpts around matches and omits HTML, media and private drafts", async () => {
  const { choice } = fixture();
  choice.text = `<script>script-secret</script><img src="data:image/png;base64,media-secret">${"before ".repeat(300)}NEEDLE ${"after ".repeat(300)}`;
  choice.image = "image-secret";
  choice.planning = { notes: "private-note", text: "draft-secret" } as never;
  const result = await search.run({ ...args, query: "needle" }, ctx);
  expect(result.results[0].title).toBe("Sleep & dream");
  expect(result.results[0].excerpt).toContain("NEEDLE");
  expect(result.results[0].excerpt.length).toBeLessThanOrEqual(322);
  const serialized = JSON.stringify(result);
  for (const secret of [
    "script-secret",
    "media-secret",
    "image-secret",
    "private-note",
    "draft-secret",
    "<img",
  ])
    expect(serialized).not.toContain(secret);
  for (const query of ["script-secret", "private-note", "draft-secret"]) {
    expect((await search.run({ ...args, query }, ctx)).total).toBe(0);
  }
});

it("supports ID, kind and parent row filters, including empty and exhausted pages", async () => {
  const { row, addon } = fixture();
  expect(
    (await search.run({ ...args, query: addon.id, kind: "addon", rowId: row.id }, ctx)).total,
  ).toBe(1);
  expect((await search.run({ ...args, kind: "choice", rowId: "missing" }, ctx)).total).toBe(0);
  expect(await search.run({ ...args, offset: 20 }, ctx)).toMatchObject({
    results: [],
    nextOffset: null,
    total: 3,
  });
});

it("fails closed for inaccessible projects", async () => {
  vi.mocked(getProjectOrThrow).mockRejectedValue(new Error("Forbidden"));
  await expect(search.run(args, ctx)).rejects.toThrow("Forbidden");
});

it("validates pagination and query bounds at every action dispatch", () => {
  for (const patch of [
    { limit: 51 },
    { limit: 0 },
    { offset: -1 },
    { offset: 0.5 },
    { query: "x".repeat(201) },
  ]) {
    expect(search.schema.safeParse({ ...args, ...patch }).success).toBe(false);
  }
  expect(search.schema.parse({ projectId: "p", offset: "2", limit: "5" })).toMatchObject({
    query: "",
    offset: 2,
    limit: 5,
  });
  expect(search).toMatchObject({
    readOnly: true,
    publicAgent: { requiresAuth: true, readOnly: true },
  });
});
