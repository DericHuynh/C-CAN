// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vite-plus/test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { InlineTextEditor } from "@/components/editor/InlineTextEditor";
import { focusViewerTarget, viewerViewport } from "./viewer-feedback";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it.each([
  ["row", "h2"],
  ["row", "p"],
  ["choice", "h3"],
  ["choice", "p"],
] as const)("keeps %s %s editing open when URL selection focuses its target", (kind, as) => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => frames.push(callback));
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  const root = document.createElement("div");
  const item = document.createElement("div");
  item.setAttribute(`data-cyoa-${kind}`, "target");
  root.append(item);
  document.body.append(root);
  item.scrollIntoView = vi.fn();
  vi.spyOn(item, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  const reactRoot = createRoot(item);
  const commit = vi.fn();
  const target = kind === "row" ? { rowId: "target" } : { choiceId: "target" };
  try {
    act(() =>
      reactRoot.render(createElement(InlineTextEditor, { as, html: "Original", onCommit: commit })),
    );
    const editor = item.querySelector<HTMLElement>('[role="textbox"]')!;
    // Both frame orders occur: the selection can resolve before or after focus.
    expect(focusViewerTarget(root, target)).toBe(true);
    act(() => frames.forEach((callback) => callback(0)));
    expect(document.activeElement).toBe(editor);
    act(() => {
      focusViewerTarget(root, target);
    });
    expect(document.activeElement).toBe(editor);
    expect(commit).not.toHaveBeenCalled();
    expect(item.scrollIntoView).not.toHaveBeenCalled();
    editor.textContent = "Revised text";
    act(() => editor.blur());
    expect(commit).toHaveBeenCalledExactlyOnceWith("Revised text");
    act(() => reactRoot.render(null));
    expect(focusViewerTarget(root, target)).toBe(true);
    expect(document.activeElement).toBe(item);
  } finally {
    act(() => reactRoot.unmount());
  }
});
it("navigates repeatedly to IDs with CSS metacharacters without activating choices", () => {
  const root = document.createElement("div");
  const choice = document.createElement("button");
  choice.dataset.cyoaChoice = 'a"]#b';
  root.append(choice);
  document.body.append(root);
  const click = vi.fn();
  choice.onclick = click;
  choice.scrollIntoView = vi.fn();
  vi.spyOn(choice, "getClientRects").mockReturnValue([
    { width: 20, height: 20 },
  ] as unknown as DOMRectList);
  expect(focusViewerTarget(root, { choiceId: 'a"]#b' })).toBe(true);
  expect(focusViewerTarget(root, { choiceId: 'a"]#b' })).toBe(true);
  expect(choice.scrollIntoView).toHaveBeenCalledTimes(2);
  expect(click).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(choice);
  expect(focusViewerTarget(root, { choiceId: "hidden" })).toBe(false);
});
it("clips screenshots to the inner scrollport as well as the browser viewport", () => {
  const outer = document.createElement("div"),
    root = document.createElement("div");
  outer.style.overflowX = "hidden";
  outer.style.overflowY = "auto";
  outer.append(root);
  document.body.append(outer);
  vi.spyOn(outer, "getBoundingClientRect").mockReturnValue({
    left: 100,
    top: 80,
    right: 600,
    bottom: 400,
  } as DOMRect);
  vi.spyOn(root, "getBoundingClientRect").mockReturnValue({
    left: 80,
    top: -1000,
    right: 900,
    bottom: 2000,
  } as DOMRect);
  expect(viewerViewport(root)).toEqual({
    left: 100,
    top: 80,
    right: 600,
    bottom: 400,
    width: 500,
    height: 320,
  });
});
