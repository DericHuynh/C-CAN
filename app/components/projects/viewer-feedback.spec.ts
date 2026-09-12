// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vite-plus/test";
import { focusViewerTarget, viewerViewport } from "./viewer-feedback";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
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
