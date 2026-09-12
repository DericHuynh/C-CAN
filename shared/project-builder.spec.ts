import { describe, expect, it } from "vite-plus/test";
import { createDefaultApp, normalizeApp } from "./cyoa";
import { buildProjectDocument } from "./project-builder";
import { validateProject } from "./project-validation";
import { resolveProjectTarget } from "./project-target";
import { copyProjectReference } from "./project-reference";

const fixture = () =>
  normalizeApp({
    rows: [
      {
        id: "intro",
        title: "Introduction",
        objects: [
          {
            id: "sleep",
            title: "Sleep",
            addons: [
              { id: "", title: "", text: "First" },
              { id: "existing", title: "Existing", text: "Keep me" },
            ],
          },
        ],
      },
    ],
    pointTypes: [],
    groups: [],
    globalRequirements: [],
  });
const req = (id: string, required = true) => ({ type: "id", reqId: id, required, requireds: [] });
describe("atomic document authoring", () => {
  it("wires forward aliases, semantic parents, groups, currencies and addons without changing the input", () => {
    const original = createDefaultApp(),
      before = JSON.stringify(original);
    const result = buildProjectDocument(original, [
      {
        op: "create",
        kind: "addon",
        parent: "$choice",
        alias: "detail",
        fields: { title: "Dream detail", requireds: [req("$choice")] },
      },
      {
        op: "create",
        kind: "choice",
        id: "sleep",
        parent: "intro",
        alias: "choice",
        fields: { title: "Sleep", scores: [{ id: "$dream", value: -5 }], groups: ["$paths"] },
      },
      {
        op: "create",
        kind: "group",
        alias: "paths",
        fields: { name: "Paths", elements: ["$choice"] },
      },
      { op: "create", kind: "row", id: "intro", fields: { title: "Intro" } },
      { op: "create", kind: "point", alias: "dream", fields: { name: "Dream", startingSum: 0 } },
    ]);
    expect(result.introducedErrors).toEqual([]);
    const choice = result.app.rows.find((r) => r.id === "intro")!.objects[0];
    expect(choice.id).toBe("sleep");
    expect(choice.scores[0].id).toBe("point-dream");
    expect(choice.addons[0]).toMatchObject({ id: "sleep-addon-dream-detail", parentId: "sleep" });
    expect(result.aliases.detail).toBe(choice.addons[0].id);
    expect(JSON.stringify(original)).toBe(before);
  });
  it("rejects parent cycles and ambiguous titles without mutating input", () => {
    const app = fixture(),
      before = JSON.stringify(app);
    expect(() =>
      buildProjectDocument(app, [{ op: "create", kind: "addon", parent: "$missing" }]),
    ).toThrow(/Unresolved/);
    app.rows.push({ ...app.rows[0], id: "intro2", objects: [] });
    expect(() =>
      buildProjectDocument(app, [
        { op: "create", kind: "choice", parent: "Introduction", fields: { title: "New" } },
      ]),
    ).toThrow(/Ambiguous/);
    expect(JSON.stringify(fixture())).toBe(before);
  });
  it("rejects stale narrow patches and preserves unrelated addons", () => {
    const app = fixture();
    expect(() =>
      buildProjectDocument(app, [
        {
          op: "update",
          kind: "addon",
          id: "existing",
          expected: { text: "stale" },
          fields: { text: "new" },
        },
      ]),
    ).toThrow(/Conflict/);
    const result = buildProjectDocument(app, [
      {
        op: "update",
        kind: "addon",
        id: "existing",
        expected: { text: "Keep me" },
        fields: { text: "new" },
      },
    ]);
    expect(result.app.rows[0].objects[0].addons[0]).toEqual(app.rows[0].objects[0].addons[0]);
    expect(result.app.rows[0].objects[0].addons[1].text).toBe("new");
    expect(() =>
      buildProjectDocument(app, [
        { op: "update", kind: "choice", id: "sleep", fields: { addons: [] } },
      ]),
    ).toThrow(/cannot be replaced/);
  });
  it("detects dependency-breaking deletion and contradictory point requirements", () => {
    const app = fixture();
    app.rows[0].requireds = [req("sleep")] as never;
    expect(
      buildProjectDocument(app, [{ op: "delete", kind: "choice", id: "sleep" }]).introducedErrors,
    ).toEqual(expect.arrayContaining([expect.objectContaining({ code: "broken-reference" })]));
    app.pointTypes = [{ id: "dream", name: "Dream", startingSum: 0 }] as never;
    app.rows[0].requireds = [
      { type: "points", reqId: "dream", reqPoints: 5, operator: "1", required: true },
      { type: "points", reqId: "dream", reqPoints: 5, operator: "4", required: true },
    ] as never;
    expect(validateProject(app).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "impossible-point-range" })]),
    );
    app.rows[0].requireds[1].required = false;
    expect(validateProject(app).issues.some((i) => i.code === "impossible-point-range")).toBe(
      false,
    );
  });
});
it("normalizes blank legacy addon IDs deterministically and resolves complete targets", () => {
  const raw = {
    rows: [{ id: "r", objects: [{ id: "c", addons: [{ id: "" }, { id: "c-addon-1" }] }] }],
  };
  const first = normalizeApp(raw),
    second = normalizeApp(raw);
  expect(first.rows[0].objects[0].addons.map((a) => a.id)).toEqual(["c-addon-1-2", "c-addon-1"]);
  expect(second.rows[0].objects[0].addons).toEqual(first.rows[0].objects[0].addons);
  expect(raw.rows[0].objects[0].addons[0].id).toBe("");
  expect(resolveProjectTarget(first, { addonId: "c-addon-1-2" })).toEqual({
    rowId: "r",
    choiceId: "c",
    addonId: "c-addon-1-2",
  });
  expect(() => resolveProjectTarget(first, { rowId: "missing", addonId: "c-addon-1" })).toThrow();
});
it("copies reference sections with dependency rows while preserving the source", () => {
  const source = fixture();
  source.rows.push({
    ...source.rows[0],
    id: "ending",
    title: "Ending",
    objects: [],
    requireds: [req("sleep")] as never,
  });
  const result = copyProjectReference(source, "sections", ["ending"]);
  expect(result.app.rows.map((r) => r.id)).toEqual(["intro", "ending"]);
  result.app.rows[0].title = "Changed";
  expect(source.rows[0].title).toBe("Introduction");
  expect(copyProjectReference(source, "style").app.rows).toEqual([]);
  expect(copyProjectReference(source, "mechanics").app.rows[0].objects[0].addons[1].text).not.toBe(
    "Keep me",
  );
});
