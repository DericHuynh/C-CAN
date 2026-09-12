// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createDefaultApp, createDefaultRow, summarizeApp } from "@shared/cyoa";
import type { ProjectDetail } from "@shared/project-contracts";
import { BackpackPanel } from "./BackpackPanel";
import { JsonPanel } from "./JsonPanel";
import { VariablesPanel } from "./VariablesPanel";
import { SoundEffectsPanel } from "./SoundEffectsPanel";
import { CustomCssPanel } from "./CustomCssPanel";
import { ViewerConfigPanel } from "./ViewerConfigPanel";
import { SettingsPanel } from "./SettingsPanel";
import { useSavedRecord } from "./use-saved-field";
import { WordsPanel } from "./WordsPanel";

const { mutate, success, error } = vi.hoisted(() => ({
  mutate: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/features/projects/use-projects", () => ({
  useUpdateProjectSettings: () => ({ mutate, isPending: false }),
  useUpdateProject: () => ({ mutate, isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { success, error } }));
vi.mock("./RowEditor", () => ({ RowEditor: () => <div>Row editor</div> }));
let root: Root;
let container: HTMLDivElement;
function fixture(): ProjectDetail {
  const app = createDefaultApp();
  app.backpack = [
    { ...createDefaultRow(app, 8), id: "second", title: "Second" },
    { ...createDefaultRow(app, 2), id: "first", title: "First" },
  ];
  app.variables = [{ id: "flag", isTrue: true }];
  app.words = [{ id: "hero", replaceText: "Traveler" }];
  return {
    id: "project",
    title: "Project",
    app,
    summary: {
      ...summarizeApp(app),
      id: "project",
      title: "Project",
      description: "",
      createdAt: "",
      updatedAt: "",
      isSeed: false,
    },
    description: "",
    createdAt: "",
    updatedAt: "",
    isSeed: false,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  Element.prototype.scrollIntoView = vi.fn();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
function click(label: string) {
  const button = Array.from(document.querySelectorAll("button")).find(
    (b) => b.getAttribute("aria-label") === label || b.textContent?.trim() === label,
  );
  expect(button, label).toBeTruthy();
  act(() => button!.click());
}
function fill(id: string, value: string) {
  const input = document.getElementById(id) as HTMLInputElement;
  act(() => {
    Object.getOwnPropertyDescriptor(
      input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("saved editor content", () => {
  it("updates JSON after saved content changes without remounting the tab", () => {
    const project = fixture();
    act(() => root.render(<JsonPanel project={project} />));
    const next = { ...project, app: { ...project.app, customCSS: ".new-saved-style {}" } };
    act(() => root.render(<JsonPanel project={next} />));
    expect(JSON.parse(container.querySelector("pre")!.textContent!).customCSS).toBe(
      next.app.customCSS,
    );
  });
  it("moves backpack rows in displayed order and persists new indices", () => {
    act(() => root.render(<BackpackPanel project={fixture()} />));
    click("Move down");
    expect(mutate.mock.calls[0][0].patch.backpack.map((r: any) => [r.id, r.index])).toEqual([
      ["second", 0],
      ["first", 1],
    ]);
  });
  it("opens backpack deletion and keeps the confirmation open on failure", () => {
    act(() => root.render(<BackpackPanel project={fixture()} />));
    click("Delete First");
    expect(document.querySelector('[role="alertdialog"]')).toBeTruthy();
    click("Delete");
    expect(success).not.toHaveBeenCalled();
    act(() => mutate.mock.calls[0][1].onError(new Error("Conflict")));
    expect(error).toHaveBeenCalledWith("Conflict");
    expect(document.querySelector('[role="alertdialog"]')).toBeTruthy();
    act(() => mutate.mock.calls[0][1].onSuccess());
    expect(success).toHaveBeenCalledWith("Backpack row deleted");
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });
  for (const [label, Panel, input, id] of [
    ["variable", VariablesPanel, "variable-id", "flag"],
    ["word", WordsPanel, "word-id", "hero"],
  ] as const) {
    it(`rejects duplicate ${label} IDs before saving`, () => {
      act(() => root.render(<Panel project={fixture()} />));
      click(`New ${label}`);
      fill(input, ` ${id} `);
      click("Add");
      expect(mutate).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalledWith("Use a unique, non-empty ID");
    });
  }
});

describe("live settings forms", () => {
  it("does not apply authored CSS to the editor itself", () => {
    const project = fixture();
    project.app.customCSS = "button { display: none !important }";
    act(() => root.render(<CustomCssPanel project={project} />));
    expect(document.getElementById("cyoa-custom-css")).toBeNull();
    expect((document.getElementById("custom-css") as HTMLTextAreaElement).value).toBe(
      project.app.customCSS,
    );
  });
  it("refreshes clean CSS while preserving a dirty draft and a failed clear", () => {
    const project = fixture();
    act(() => root.render(<CustomCssPanel project={project} />));
    act(() =>
      root.render(
        <CustomCssPanel
          project={{ ...project, app: { ...project.app, customCSS: ".saved {}" } }}
        />,
      ),
    );
    const textarea = document.getElementById("custom-css") as HTMLTextAreaElement;
    expect(textarea.value).toBe(".saved {}");
    fill("custom-css", ".unsaved {}");
    act(() =>
      root.render(
        <CustomCssPanel
          project={{ ...project, app: { ...project.app, customCSS: ".external {}" } }}
        />,
      ),
    );
    expect(textarea.value).toBe(".unsaved {}");
    click("Clear");
    act(() => mutate.mock.calls[0][1].onError(new Error("Could not save")));
    expect(textarea.value).toBe(".unsaved {}");
    act(() => mutate.mock.calls[0][1].onSuccess());
    expect(textarea.value).toBe("");
    fill("custom-css", ".next-draft {}");
    click("Clear");
    fill("custom-css", ".typed-while-clearing {}");
    act(() => mutate.mock.calls[1][1].onSuccess());
    expect(textarea.value).toBe(".typed-while-clearing {}");
  });
  it("preserves full viewer color values when saving an unrelated field", () => {
    const project = fixture();
    Object.assign(project.app.viewerConfig, {
      loadingBgColor: "#11223344",
      loadingTextColor: "rgba(1, 2, 3, 0.5)",
    });
    act(() => root.render(<ViewerConfigPanel project={project} />));
    fill("viewer-title", "Updated title");
    click("Save");
    expect(mutate.mock.calls[0][0].patch.viewerConfig).toMatchObject({
      title: "Updated title",
      loadingBgColor: "#11223344",
      loadingTextColor: "rgba(1, 2, 3, 0.5)",
    });
    fill("viewer-loading-bg-color", "#abcdef");
    click("Save");
    expect(mutate.mock.calls[1][0].patch.viewerConfig.loadingBgColor).toBe("#abcdef44");
  });
  it("updates untouched metadata without discarding an edited title", () => {
    const project = fixture();
    act(() => root.render(<SettingsPanel project={project} />));
    fill("settings-title", "My draft");
    act(() =>
      root.render(
        <SettingsPanel
          project={{ ...project, title: "Remote title", description: "Remote description" }}
        />,
      ),
    );
    expect((document.getElementById("settings-title") as HTMLInputElement).value).toBe("My draft");
    expect((document.getElementById("settings-description") as HTMLInputElement).value).toBe(
      "Remote description",
    );
    click("Save");
    expect(mutate.mock.calls[0][0]).toMatchObject({
      title: "My draft",
      description: "Remote description",
    });
  });
  it("rebases untouched styling fields when the saved document changes", () => {
    function Draft({ saved }: { saved: Record<string, unknown> }) {
      const [draft, setDraft] = useSavedRecord(saved);
      return (
        <>
          <button onClick={() => setDraft((prev) => ({ ...prev, color: "local" }))}>
            Edit color
          </button>
          <pre>{JSON.stringify(draft)}</pre>
        </>
      );
    }
    act(() => root.render(<Draft saved={{ color: "old", width: 10 }} />));
    click("Edit color");
    act(() => root.render(<Draft saved={{ color: "remote", width: 20, newField: true }} />));
    expect(JSON.parse(container.querySelector("pre")!.textContent!)).toEqual({
      color: "local",
      width: 20,
      newField: true,
    });
    act(() => root.render(<Draft saved={{ color: "local", width: 20, newField: true }} />));
    act(() => root.render(<Draft saved={{ color: "later", width: 30 }} />));
    expect(JSON.parse(container.querySelector("pre")!.textContent!)).toEqual({
      color: "later",
      width: 30,
    });
  });
});

it("rejects a duplicate sound effect ID without replacing another effect", () => {
  const project = fixture();
  project.app.soundEffects = [
    {
      id: "chime",
      name: "Original",
      audio: "",
      volume: 1,
      pitch: 0,
      isDefault: false,
      onSelected: true,
      onDeselected: false,
      groups: [],
      requireds: [],
    },
  ];
  act(() => root.render(<SoundEffectsPanel project={project} />));
  click("Add sound effect");
  fill("sfx-id", " chime ");
  click("Add");
  expect(mutate).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalledWith("Use a unique, non-empty sound effect ID");
});
