// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vite-plus/test";
import type { SharedRichEditorProps } from "@agent-native/toolkit/editor";
import { PlanningProseEditor } from "./PlanningProseEditor";

let current = "<p></p>";
let props: SharedRichEditorProps;
const editor = {
  getHTML: () => current,
  isDestroyed: false,
  commands: {
    setContent: (html: string) => {
      current = html;
    },
  },
};
vi.mock("@agent-native/toolkit/editor", () => ({
  SharedRichEditor: (next: SharedRichEditorProps) => {
    props = next;
    useEffect(() => {
      // Reproduce the shared editor's queued empty initialization update.
      next.onEditorReady?.(editor as never);
      queueMicrotask(() => next.onChange("<p></p>"));
    }, []);
    return <div />;
  },
}));
const containers: HTMLElement[] = [];
const roots: ReturnType<typeof createRoot>[] = [];
afterEach(() => {
  roots.splice(0).forEach((root) => act(() => root.unmount()));
  containers.splice(0).forEach((el) => el.remove());
  vi.unstubAllGlobals();
});
it("does not replace a saved draft with the rich editor's initial empty paragraph", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  containers.push(container);
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  const change = vi.fn();
  await act(async () =>
    root.render(
      <PlanningProseEditor
        value="<p>Saved draft</p>"
        onChange={change}
        label="Draft"
        placeholder="Write"
        disabled={false}
      />,
    ),
  );
  expect(current).toBe("<p>Saved draft</p>");
  expect(change).not.toHaveBeenCalled();
  act(() => props.onChange(current));
  expect(change).not.toHaveBeenCalled();
  current = "<p>Edited prose</p>";
  act(() => props.onChange(current));
  expect(change).toHaveBeenCalledWith(current);
  await act(async () =>
    root.render(
      <PlanningProseEditor
        value="<p>Reloaded saved version</p>"
        onChange={change}
        label="Draft"
        placeholder="Write"
        disabled={false}
      />,
    ),
  );
  expect(current).toBe("<p>Reloaded saved version</p>");
});
