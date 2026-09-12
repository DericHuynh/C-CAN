// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  createDefaultAddon,
  createDefaultApp,
  createDefaultChoice,
  createDefaultRow,
} from "@shared/cyoa";
import { RowTree, type RowTreeProps } from "./RowTree";

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function fixture(): RowTreeProps {
  const app = createDefaultApp();
  app.rows = Array.from({ length: 5 }, (_, index) => ({
    ...createDefaultRow(app, index),
    title: `Row ${index + 1}`,
    titleText: "",
    objects: [],
  }));
  return {
    app,
    rows: app.rows,
    pointTypes: [],
    groups: [],
    onEditRow: vi.fn(),
    onAddChoice: vi.fn(),
    onDeleteRow: vi.fn(),
    onMoveRow: vi.fn(),
    onEditChoice: vi.fn(),
    onDeleteChoice: vi.fn(),
    onMoveChoice: vi.fn(),
    onEditAddon: vi.fn(),
    onDeleteAddon: vi.fn(),
    onMoveAddon: vi.fn(),
    onAddRowAt: vi.fn(),
    onAddChoiceAt: vi.fn(),
    onAddAddonAt: vi.fn(),
  };
}

describe("editor content tree", () => {
  it("uses document positions when moving rows in a filtered list", () => {
    const props = fixture();
    const target = props.app.rows[2];
    const source = props.app.rows[4];
    props.rows = [target, source];
    act(() => root.render(createElement(RowTree, props)));
    const targetNode = container.querySelector(`[data-row-id="${target.id}"]`)!.firstElementChild!;
    vi.spyOn(targetNode, "getBoundingClientRect").mockReturnValue({
      top: 0,
      height: 100,
    } as DOMRect);
    const drop = new MouseEvent("drop", { bubbles: true, cancelable: true, clientY: 1 });
    Object.defineProperty(drop, "dataTransfer", {
      value: { getData: () => JSON.stringify({ kind: "row", id: source.id }) },
    });
    act(() => targetNode.dispatchEvent(drop));
    expect(props.onMoveRow).toHaveBeenCalledExactlyOnceWith(source.id, 2);
  });

  it("provides native edit buttons and keeps the selected addon identity", () => {
    const props = fixture();
    const row = props.app.rows[0];
    const choice = createDefaultChoice(props.app, 0);
    choice.addons = [
      createDefaultAddon(props.app),
      { ...createDefaultAddon(props.app), title: "Companion" },
    ];
    row.objects.push(choice);
    props.selectedKey = `addon:${choice.id}:1`;
    act(() => root.render(createElement(RowTree, props)));
    const editRow = container.querySelector<HTMLButtonElement>('[aria-label="Edit row: Row 1"]')!;
    act(() => editRow.click());
    expect(props.onEditRow).toHaveBeenCalledExactlyOnceWith(row);
    const editAddon = container.querySelector<HTMLButtonElement>(
      '[aria-label="Edit addon: Companion"]',
    )!;
    expect(editAddon.getAttribute("aria-pressed")).toBe("true");
    act(() => editAddon.click());
    expect(props.onEditAddon).toHaveBeenCalledExactlyOnceWith(choice, row, 1);
  });
});
