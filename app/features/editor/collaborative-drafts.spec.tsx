// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vite-plus/test";
import {
  DraftCollaborationProvider,
  DraftConflictNotice,
  useDraftRegistry,
} from "./DraftCollaboration";
import { useSavedField } from "./use-saved-field";
import { useLiveSelection } from "./use-live-selection";

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

it("shows conflicting values, preserves unrelated updates and requires explicit resolution", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const save = vi.fn();
  function Form({ saved }: { saved: { title: string; text: string } }) {
    const [draft, setDraft] = useSavedField(saved);
    const registry = useDraftRegistry();
    return (
      <>
        <input
          aria-label="Title"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
        <p>{draft.text}</p>
        <button
          onClick={() => {
            try {
              registry!.assertReady();
              save(draft);
            } catch {
              /* draft stays open */
            }
          }}
        >
          Save
        </button>
      </>
    );
  }
  const render = (title: string, text: string) =>
    act(() =>
      root.render(
        <DraftCollaborationProvider>
          <DraftConflictNotice />
          <Form saved={{ title, text }} />
        </DraftCollaborationProvider>,
      ),
    );
  const click = (text: string) =>
    act(() =>
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === text)!
        .click(),
    );
  try {
    render("Original", "Original text");
    const input = container.querySelector("input")!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        input,
        "Local",
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    render("Remote", "Shared text");
    expect(input.value).toBe("Local");
    expect(container.querySelector("[role=alert]")?.textContent).toContain("Remote");
    expect(container.textContent).toContain("Shared text");
    click("Save");
    expect(save).not.toHaveBeenCalled();
    click("Keep my edits");
    click("Save");
    expect(save).toHaveBeenLastCalledWith({ title: "Local", text: "Shared text" });
    render("New remote", "Newest text");
    click("Use latest values");
    expect(input.value).toBe("New remote");
    click("Save");
    expect(save).toHaveBeenLastCalledWith({ title: "New remote", text: "Newest text" });
  } finally {
    act(() => root.unmount());
  }
});

it("resolves selected entities from fresh data and closes remotely deleted inspectors", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  function Form({ items }: { items: { id: string; title: string }[] }) {
    const [selected, select] = useLiveSelection(items);
    return (
      <>
        <button onClick={() => select(items[0])}>Edit</button>
        <span>{selected && selected !== "new" ? selected.title : "No selection"}</span>
      </>
    );
  }
  try {
    act(() => root.render(<Form items={[{ id: "a", title: "Before" }]} />));
    act(() => container.querySelector("button")!.click());
    act(() => root.render(<Form items={[{ id: "a", title: "After" }]} />));
    expect(container.querySelector("span")!.textContent).toBe("After");
    act(() => root.render(<Form items={[]} />));
    expect(container.querySelector("span")!.textContent).toBe("No selection");
  } finally {
    act(() => root.unmount());
  }
});
