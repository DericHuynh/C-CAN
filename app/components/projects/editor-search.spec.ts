import { describe, expect, it } from "vite-plus/test";

import {
  createDefaultAddon,
  createDefaultApp,
  createDefaultChoice,
  createDefaultRow,
} from "@shared/cyoa";
import { filterEditorRows } from "./editor-search";

describe("editor content search", () => {
  const app = createDefaultApp();
  const row = createDefaultRow(app, 0);
  Object.assign(row, { id: "origin-row", title: "Origins", titleText: "Pick a home" });
  const choice = createDefaultChoice(app, 0);
  Object.assign(choice, { id: "forest-choice", title: "Forest", text: "Among the trees" });
  choice.addons = [
    { ...createDefaultAddon(app), id: "pet-addon", title: "Companion", text: "A loyal fox" },
  ];
  row.objects = [choice];
  const other = createDefaultRow(app, 1);
  other.objects = [];
  const rows = [row, other];

  it.each([
    "ORIGIN-ROW",
    "origins",
    "pick a home",
    "forest-choice",
    "forest",
    "trees",
    "pet-addon",
    "companion",
    " fox ",
  ])("finds %s without changing the editable structure", (query) => {
    expect(filterEditorRows(rows, query)).toEqual([row]);
    expect(filterEditorRows(rows, query)[0]).toBe(row);
  });

  it("preserves the full list for an empty search", () => {
    expect(filterEditorRows(rows, "  ")).toBe(rows);
    expect(filterEditorRows(rows, "missing content")).toEqual([]);
  });
});
