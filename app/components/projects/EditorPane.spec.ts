// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { EditorPane } from "./EditorPane";

let root: Root;
let container: HTMLDivElement;
const originalScrollIntoView = Element.prototype.scrollIntoView;
let reveal: ReturnType<typeof vi.fn<Element["scrollIntoView"]>>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
  reveal = vi.fn<Element["scrollIntoView"]>();
  Element.prototype.scrollIntoView = reveal;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  Element.prototype.scrollIntoView = originalScrollIntoView;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mount(props: { busy?: boolean; canSave?: boolean } = {}) {
  const save = vi.fn();
  act(() =>
    root.render(
      createElement(EditorPane, {
        title: "Edit row",
        onSave: save,
        onCancel: vi.fn(),
        ...props,
        children: createElement("textarea", { "aria-label": "Description" }),
      }),
    ),
  );
  return save;
}

describe("editor form navigation", () => {
  it("returns focus to the opener when a mobile form closes", () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    try {
      opener.focus();
      mount();
      act(() => root.render(null));
      expect(document.activeElement).toBe(opener);
      expect(reveal).toHaveBeenLastCalledWith({ block: "nearest" });
    } finally {
      opener.remove();
    }
  });

  it("reveals and focuses newly opened forms on narrow screens", () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    mount();
    expect(reveal).toHaveBeenCalledWith({ block: "start" });
    expect(document.activeElement?.textContent).toBe("Edit row");
  });

  it("keeps desktop focus in the content list", () => {
    mount();
    expect(reveal).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.body);
  });

  it("saves with Shift + S when focus is outside the form", () => {
    const save = mount();
    const event = new KeyboardEvent("keydown", {
      key: "S",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => document.body.dispatchEvent(event));
    expect(save).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it.each([{ busy: true }, { canSave: false }])("blocks shortcut saves when %j", (props) => {
    const save = mount(props);
    const event = new KeyboardEvent("keydown", {
      key: "s",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => document.body.dispatchEvent(event));
    expect(save).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves ordinary text entry and multiline Enter alone", () => {
    const save = mount();
    for (const key of ["s", "S", "Enter"]) {
      const event = new KeyboardEvent("keydown", {
        key,
        shiftKey: key === "S",
        bubbles: true,
        cancelable: true,
      });
      act(() => container.querySelector("textarea")!.dispatchEvent(event));
      expect(event.defaultPrevented).toBe(false);
    }
    expect(save).not.toHaveBeenCalled();
  });

  it.each(["ctrlKey", "metaKey", "altKey"])("does not save with %s + S", (modifier) => {
    const save = mount();
    const event = new KeyboardEvent("keydown", {
      key: "s",
      [modifier]: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => document.body.dispatchEvent(event));
    expect(save).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("does not consume uppercase S in rich text or repeat a held shortcut", () => {
    const save = mount();
    const richText = document.createElement("div");
    richText.setAttribute("contenteditable", "true");
    container.append(richText);
    const input = new KeyboardEvent("keydown", {
      key: "S",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => richText.dispatchEvent(input));
    expect(input.defaultPrevented).toBe(false);
    act(() =>
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "S",
          shiftKey: true,
          repeat: true,
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(save).not.toHaveBeenCalled();
  });
});
