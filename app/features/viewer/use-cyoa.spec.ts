// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  createDefaultAddon,
  createDefaultApp,
  createDefaultChoice,
  createDefaultPointType,
  createDefaultRequireds,
  createDefaultRow,
  createDefaultScore,
  createDefaultVariable,
} from "@shared/cyoa";
import type { App, SelectableAddon } from "@shared/types";
import { resolveChoiceImage } from "@/features/viewer/cyoa-styles";
import { checkRequirements } from "@shared/cyoa-engine";
import { useCyoa, type UseCyoaResult } from "./use-cyoa";

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
  vi.useRealTimers();
  document.body.style.cursor = "";
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mountViewer(app: App) {
  let result: UseCyoaResult;
  function Harness() {
    result = useCyoa({ app });
    return null;
  }
  act(() => root.render(createElement(Harness)));
  return () => result;
}

describe("ICCPlus viewer parity regressions", () => {
  it("charges gated scores per copy and preserves the result through a saved build", () => {
    const app = createDefaultApp();
    const row = createDefaultRow(app, 0);
    const point = createDefaultPointType(app);
    point.startingSum = 10;
    const gate = createDefaultChoice(app, 0);
    const choice = createDefaultChoice(app, 1);
    choice.isSelectableMultiple = true;
    const score = createDefaultScore(point.id, 3);
    score.requireds = [{ ...createDefaultRequireds(), type: "id", reqId: gate.id, required: true }];
    choice.scores = [score];
    app.pointTypes = [point];
    app.rows = [row];
    row.objects = [gate, choice];
    const viewer = mountViewer(app);
    act(() => viewer().more(choice, row));
    expect(viewer().totals.get(point.id)?.total).toBe(10);
    act(() => viewer().toggleChoice(gate, row));
    act(() => viewer().more(choice, row));
    expect(viewer().totals.get(point.id)?.total).toBe(7);
    const build = viewer().buildCode;
    act(() => viewer().importBuildCode(build));
    expect(viewer().totals.get(point.id)?.total).toBe(7);
    act(() => viewer().less(choice, row));
    expect(viewer().totals.get(point.id)?.total).toBe(10);
  });

  it("checks a score's point requirement against the balance before paying it", () => {
    const app = createDefaultApp();
    const row = createDefaultRow(app, 0);
    const point = createDefaultPointType(app);
    point.startingSum = 5;
    const choice = createDefaultChoice(app, 0);
    const score = createDefaultScore(point.id, 5);
    score.requireds = [
      {
        ...createDefaultRequireds(),
        type: "points",
        reqId: point.id,
        reqPoints: 5,
        operator: "2",
        required: true,
      },
    ];
    choice.scores = [score];
    app.pointTypes = [point];
    app.rows = [row];
    row.objects = [choice];
    const viewer = mountViewer(app);
    act(() => viewer().toggleChoice(choice, row));
    expect(viewer().totals.get(point.id)?.total).toBe(0);
  });

  it("activates automatic choices after their gate is selected, including their linked effects", () => {
    const app = createDefaultApp();
    const row = createDefaultRow(app, 0);
    const gate = createDefaultChoice(app, 0);
    const automatic = createDefaultChoice(app, 1);
    const target = createDefaultChoice(app, 2);
    Object.assign(automatic, {
      isAutoActive: true,
      activateOtherChoice: true,
      activateThisChoice: target.id,
    });
    automatic.requireds = [
      { ...createDefaultRequireds(), type: "id", reqId: gate.id, required: true },
    ];
    app.rows = [row];
    row.objects = [gate, automatic, target];
    const viewer = mountViewer(app);
    expect(viewer().state.activated.has(automatic.id)).toBe(false);
    act(() => viewer().toggleChoice(gate, row));
    expect(viewer().state.activated.has(automatic.id)).toBe(true);
    expect(viewer().state.activated.has(target.id)).toBe(true);
  });

  it("releases variable effects when a row-limit replacement displaces a choice", () => {
    const app = createDefaultApp();
    const row = createDefaultRow(app, 0);
    row.allowedChoices = 1;
    const variable = createDefaultVariable();
    const old = createDefaultChoice(app, 0);
    Object.assign(old, {
      isChangeVariables: true,
      changeType: "1",
      changedVariables: [variable.id],
    });
    const replacement = createDefaultChoice(app, 1);
    app.rows = [row];
    app.variables = [variable];
    row.objects = [old, replacement];
    const viewer = mountViewer(app);
    act(() => viewer().toggleChoice(old, row));
    expect(viewer().state.variables.get(variable.id)).toBe(true);
    act(() => viewer().toggleChoice(replacement, row));
    expect(viewer().state.variables.get(variable.id)).toBe(false);
  });
  it("prevents overspending and refunding a spent grant, while allowing affordable changes", () => {
    const app = createDefaultApp();
    const point = createDefaultPointType(app);
    point.belowZeroNotAllowed = true;
    point.startingSum = 2;
    const row = createDefaultRow(app, 0);
    const grant = createDefaultChoice(app, 0);
    grant.scores = [createDefaultScore(point.id, -5)];
    const cost = createDefaultChoice(app, 1);
    cost.scores = [createDefaultScore(point.id, 6)];
    app.pointTypes = [point];
    app.rows = [row];
    row.objects = [grant, cost];
    const viewer = mountViewer(app);
    act(() => viewer().toggleChoice(cost, row));
    expect(viewer().state.activated.has(cost.id)).toBe(false);
    act(() => viewer().toggleChoice(grant, row));
    act(() => viewer().toggleChoice(cost, row));
    expect(viewer().totals.get(point.id)?.total).toBe(1);
    act(() => viewer().toggleChoice(grant, row));
    expect(viewer().state.activated.has(grant.id)).toBe(true);
    act(() => viewer().toggleChoice(cost, row));
    act(() => viewer().toggleChoice(grant, row));
    expect(viewer().totals.get(point.id)?.total).toBe(2);
  });

  it("information-only rows cannot select cards or counters", () => {
    const app = createDefaultApp();
    const row = createDefaultRow(app, 0);
    row.isInfoRow = true;
    const choice = createDefaultChoice(app, 0);
    app.rows = [row];
    row.objects = [choice];
    const viewer = mountViewer(app);
    act(() => viewer().toggleChoice(choice, row));
    act(() => viewer().more(choice, row));
    expect(viewer().state.activated.size).toBe(0);
  });

  it("a locked choice cannot be deselected or displaced by a full-row selection", () => {
    const app = createDefaultApp();
    const row = createDefaultRow(app, 0);
    row.allowedChoices = 1;
    const locked = createDefaultChoice(app, 0);
    locked.selectOnce = true;
    const other = createDefaultChoice(app, 1);
    app.rows = [row];
    row.objects = [locked, other];
    const viewer = mountViewer(app);
    act(() => viewer().toggleChoice(locked, row));
    act(() => viewer().toggleChoice(locked, row));
    act(() => viewer().toggleChoice(other, row));
    act(() => viewer().more(other, row));
    expect([...viewer().state.activated.keys()]).toEqual([locked.id]);
  });

  it("word requirements observe configured and player-entered words", () => {
    const app = createDefaultApp();
    app.words = [{ id: "hero", replaceText: "before" }];
    const row = createDefaultRow(app, 0);
    const choice = createDefaultChoice(app, 0);
    Object.assign(choice, {
      textfieldIsOn: true,
      idOfTheTextfieldWord: "hero",
      wordChangeSelect: "after",
      wordChangeDeselect: "before",
    });
    app.rows = [row];
    row.objects = [choice];
    const viewer = mountViewer(app);
    const requirement = {
      ...createDefaultRequireds(),
      type: "word",
      required: true,
      reqId: "hero",
      orRequired: [{ req: "after" }],
    };
    act(() => viewer().toggleChoice(choice, row));
    expect(checkRequirements([requirement], viewer().idx, viewer().state)).toBe(true);
    act(() => viewer().toggleChoice(choice, row));
    expect(checkRequirements([requirement], viewer().idx, viewer().state)).toBe(false);
  });

  it("supports negative counts, signed scores, and returning through zero", () => {
    const app = createDefaultApp();
    const row = createDefaultRow(app, 0);
    const point = createDefaultPointType(app);
    const choice = createDefaultChoice(app, 0);
    Object.assign(choice, {
      isSelectableMultiple: true,
      numMultipleTimesMinus: -2,
      numMultipleTimesPluss: 2,
    });
    choice.scores = [createDefaultScore(point.id, 3)];
    app.rows = [row];
    row.objects = [choice];
    app.pointTypes = [point];
    const viewer = mountViewer(app);
    act(() => viewer().less(choice, row));
    act(() => viewer().less(choice, row));
    expect(viewer().state.activated.get(choice.id)?.multiple).toBe(-2);
    expect(viewer().totals.get(point.id)?.total).toBe(6);
    const build = viewer().buildCode;
    act(() => viewer().importBuildCode(build));
    expect(viewer().state.activated.get(choice.id)?.multiple).toBe(-2);
    expect(viewer().totals.get(point.id)?.total).toBe(6);
    expect(viewer().state.currentChoices.get(row.id)).toBe(1);
    act(() => viewer().more(choice, row));
    act(() => viewer().more(choice, row));
    expect(viewer().state.activated.has(choice.id)).toBe(false);
    expect(viewer().state.currentChoices.get(row.id)).toBe(0);
    expect(viewer().totals.get(point.id)?.total).toBe(0);
  });

  it("excludes non-counting choices and addons from row-count requirements", () => {
    const app = createDefaultApp();
    const row = createDefaultRow(app, 0);
    const parent = createDefaultChoice(app, 0);
    parent.isCountDisabled = true;
    const addon = {
      ...createDefaultChoice(app, 0),
      isSelectable: true,
      countAsChoice: false,
    } as unknown as SelectableAddon;
    parent.addons = [addon];
    row.objects = [parent];
    app.rows = [row];
    const viewer = mountViewer(app);
    act(() => viewer().toggleAddon(addon, parent, row));
    expect(viewer().state.currentChoices.get(row.id)).toBe(0);
  });
});

describe("viewer selection pipeline", () => {
  it("reports storage failures while keeping the active build available", () => {
    const app = createDefaultApp();
    const viewer = mountViewer(app);
    const code = viewer().buildCode;
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota", "QuotaExceededError");
    });
    let saved = true;
    act(() => {
      saved = viewer().saveSlot("slot-1", "Build");
    });
    expect(saved).toBe(false);
    expect(viewer().storageError).toBe(true);
    expect(viewer().buildCode).toBe(code);
    setItem.mockRestore();
    act(() => {
      saved = viewer().saveSlot("slot-1", "Build");
    });
    expect(saved).toBe(true);
    expect(viewer().storageError).toBe(false);
  });

  it("stores uploaded files with the build and ignores a late upload after deselection", () => {
    const app = createDefaultApp();
    const row = createDefaultRow(app, 0);
    const choice = createDefaultChoice(app, 0);
    choice.isImageUpload = true;
    row.objects = [choice];
    app.rows = [row];
    const image = "data:image/webp;base64,UklGRg==";
    const viewer = mountViewer(app);
    act(() => viewer().toggleChoice(choice, row));
    act(() => viewer().setUploadedImage(choice.id, image));
    const code = viewer().buildCode;
    act(() => viewer().clean());
    act(() => viewer().setUploadedImage(choice.id, image));
    expect(viewer().state.uploadedImages.has(choice.id)).toBe(false);
    act(() => viewer().importBuildCode(code));
    expect(viewer().state.uploadedImages.get(choice.id)).toBe(image);
    expect(choice.image).not.toBe(image);
  });

  it.each([false, true])(
    "retains custom values and rolled scores across reset (counter: %s)",
    (counter) => {
      const app = createDefaultApp();
      const point = createDefaultPointType(app);
      point.startingSum = 20;
      app.pointTypes = [point];
      const row = createDefaultRow(app, 0);
      const choice = createDefaultChoice(app, 0);
      Object.assign(choice, {
        notDeselectedByClean: true,
        isSelectableMultiple: counter,
        allowSelectByClick: true,
        textfieldIsOn: true,
        customTextfieldIsOn: true,
        idOfTheTextfieldWord: "hero",
        isImageUpload: true,
      });
      choice.scores = [
        { ...createDefaultScore(point.id), isRandom: true, minValue: 3, maxValue: 3 },
      ];
      row.objects = [choice];
      app.rows = [row];
      vi.spyOn(window, "prompt").mockReturnValueOnce("Ari");
      const viewer = mountViewer(app);
      act(() => viewer().toggleChoice(choice, row));
      act(() => viewer().setUploadedImage(choice.id, "https://example.com/portrait.png"));
      const code = viewer().buildCode;
      const total = viewer().totals.get(point.id)?.total;
      act(() => viewer().clean());
      expect(viewer().state.activated.has(choice.id)).toBe(true);
      expect(viewer().state.wordValues.get("hero")).toBe("Ari");
      expect(viewer().state.uploadedImages.get(choice.id)).toBe("https://example.com/portrait.png");
      expect(viewer().state.rolledScores.get(`${choice.id}:0:1`)).toBe(3);
      expect(viewer().totals.get(point.id)?.total).toBe(total);
      expect(viewer().buildCode).toBe(code);
    },
  );

  it("clears variable effects when a choice is removed by a missing requirement", () => {
    const app = createDefaultApp();
    const variable = createDefaultVariable();
    app.variables = [variable];
    const row = createDefaultRow(app, 0);
    row.allowedChoices = 0;
    const gate = createDefaultChoice(app, 0);
    const effect = createDefaultChoice(app, 1);
    effect.requireds = [
      { ...createDefaultRequireds(), type: "id", reqId: gate.id, required: true },
    ];
    Object.assign(effect, {
      isChangeVariables: true,
      changeType: "1",
      changedVariables: [variable.id],
    });
    const dependent = createDefaultChoice(app, 2);
    dependent.requireds = [
      { ...createDefaultRequireds(), type: "id", reqId: variable.id, required: true },
    ];
    row.objects = [gate, effect, dependent];
    app.rows = [row];
    const viewer = mountViewer(app);
    act(() => viewer().toggleChoice(gate, row));
    act(() => viewer().toggleChoice(effect, row));
    act(() => viewer().toggleChoice(dependent, row));
    expect(viewer().state.activated.has(dependent.id)).toBe(true);
    act(() => viewer().toggleChoice(gate, row));
    expect(viewer().state.activated.has(effect.id)).toBe(false);
    expect(viewer().state.variables.get(variable.id)).toBe(false);
    expect(viewer().state.activated.has(variable.id)).toBe(false);
    expect(viewer().state.activated.has(dependent.id)).toBe(false);
  });

  it.each([false, true])(
    "runs score rolls and linked effects for random row selection (counter: %s)",
    (counter) => {
      const app = createDefaultApp();
      const point = createDefaultPointType(app);
      point.startingSum = 10;
      app.pointTypes = [point];
      const row = createDefaultRow(app, 0);
      row.buttonRandom = true;
      const targetRow = createDefaultRow(app, 1);
      const target = createDefaultChoice(app, 1);
      targetRow.objects = [target];
      const choice = createDefaultChoice(app, 0);
      Object.assign(choice, {
        isSelectableMultiple: counter,
        allowSelectByClick: true,
        activateOtherChoice: true,
        activateThisChoice: target.id,
      });
      choice.scores = [
        { ...createDefaultScore(point.id), isRandom: true, minValue: 3, maxValue: 3 },
      ];
      row.objects = [choice];
      app.rows = [row, targetRow];
      const viewer = mountViewer(app);

      act(() => viewer().rowButton(row));
      expect(viewer().state.activated.has(target.id)).toBe(true);
      expect(viewer().state.rolledScores.get(`${choice.id}:0:1`)).toBe(3);
      const code = viewer().buildCode;
      act(() => viewer().importBuildCode(code));
      expect(viewer().state.rolledScores.get(`${choice.id}:0:1`)).toBe(3);
      expect(viewer().state.activated.has(target.id)).toBe(true);
    },
  );

  it("honors cancellation of a randomly selected choice's confirmation", () => {
    const app = createDefaultApp();
    const row = createDefaultRow(app, 0);
    row.buttonRandom = true;
    const choice = createDefaultChoice(app, 0);
    choice.confirmIsOn = true;
    row.objects = [choice];
    app.rows = [row];
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const viewer = mountViewer(app);

    act(() => viewer().rowButton(row));
    expect(confirm).toHaveBeenCalledOnce();
    expect(viewer().state.activated.has(choice.id)).toBe(false);
    expect(viewer().state.currentChoices.get(row.id)).toBe(0);
  });

  it("does not double-count a retained selection that is also selected in the document", () => {
    const app = createDefaultApp();
    const row = createDefaultRow(app, 0);
    const choice = createDefaultChoice(app, 0);
    choice.notDeselectedByClean = true;
    row.objects = [choice];
    app.rows = [row];
    app.activated = [choice.id];
    const viewer = mountViewer(app);

    for (let i = 0; i < 2; i++) {
      act(() => viewer().clean());
      expect(viewer().state.activated.has(choice.id)).toBe(true);
      expect(viewer().state.currentChoices.get(row.id)).toBe(1);
    }
  });

  it("keeps the cursor hidden until all overlapping selection delays finish", () => {
    vi.useFakeTimers();
    document.body.style.cursor = "crosshair";
    const app = createDefaultApp();
    const row = createDefaultRow(app, 0);
    row.allowedChoices = 0;
    const first = createDefaultChoice(app, 0);
    const second = createDefaultChoice(app, 1);
    Object.assign(first, { isSelectDelayed: true, selectDelayTime: 100 });
    Object.assign(second, { isSelectDelayed: true, selectDelayTime: 200 });
    row.objects = [first, second];
    app.rows = [row];
    const viewer = mountViewer(app);

    act(() => {
      viewer().toggleChoice(first, row);
      viewer().toggleChoice(second, row);
    });
    act(() => vi.advanceTimersByTime(100));
    expect(viewer().state.activated.has(first.id)).toBe(true);
    expect(document.body.style.cursor).toBe("none");
    act(() => vi.advanceTimersByTime(100));
    expect(viewer().state.activated.has(second.id)).toBe(true);
    expect(document.body.style.cursor).toBe("crosshair");
  });

  it.each(["reset", "import", "unmount"])("cancels delayed selections on %s", (operation) => {
    vi.useFakeTimers();
    document.body.style.cursor = "crosshair";
    const app = createDefaultApp();
    const row = createDefaultRow(app, 0);
    const choice = createDefaultChoice(app, 0);
    Object.assign(choice, { isSelectDelayed: true, selectDelayTime: 100 });
    row.objects = [choice];
    app.rows = [row];
    const viewer = mountViewer(app);
    act(() => viewer().toggleChoice(choice, row));
    expect(document.body.style.cursor).toBe("none");
    act(() => {
      if (operation === "reset") viewer().clean();
      else if (operation === "import") viewer().importBuildCode("");
      else root.render(null);
    });
    expect(document.body.style.cursor).toBe("crosshair");
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(100));
    expect(viewer().state.activated.has(choice.id)).toBe(false);
  });

  it("autosaves the latest build at the ICCPlus interval in minutes, even during continuous play", () => {
    vi.useFakeTimers();
    const app = createDefaultApp();
    app.buildAutoSaveIsOn = true;
    app.buildAutoSaveInterval = 1;
    const row = createDefaultRow(app, 0);
    const choice = createDefaultChoice(app, 0);
    row.objects = [choice];
    app.rows = [row];
    const viewer = mountViewer(app);

    act(() => vi.advanceTimersByTime(30_000));
    act(() => viewer().toggleChoice(choice, row));
    act(() => vi.advanceTimersByTime(30_000));
    expect(viewer().loadSlot("buildAutoSave")).toBe(viewer().buildCode);
    act(() => vi.advanceTimersByTime(30_000));
    act(() => viewer().toggleChoice(choice, row));
    act(() => vi.advanceTimersByTime(30_000));
    expect(viewer().loadSlot("buildAutoSave")).toBe(viewer().buildCode);
  });

  it("makes a variable's true default available to choice requirements", () => {
    const app = createDefaultApp();
    const variable = createDefaultVariable();
    variable.isTrue = true;
    app.variables = [variable];
    const row = createDefaultRow(app, 0);
    const choice = createDefaultChoice(app, 0);
    choice.requireds = [
      { ...createDefaultRequireds(), type: "id", reqId: variable.id, required: true },
    ];
    row.objects = [choice];
    app.rows = [row];
    const viewer = mountViewer(app);

    act(() => viewer().toggleChoice(choice, row));
    expect(viewer().state.activated.has(choice.id)).toBe(true);
  });

  it.each(["2", "3"])("restores a false variable after saving change type %s", (changeType) => {
    const app = createDefaultApp();
    const variable = createDefaultVariable();
    variable.isTrue = true;
    app.variables = [variable];
    const row = createDefaultRow(app, 0);
    const choice = createDefaultChoice(app, 0);
    Object.assign(choice, { isChangeVariables: true, changeType, changedVariables: [variable.id] });
    row.objects = [choice];
    app.rows = [row];
    const viewer = mountViewer(app);

    act(() => viewer().toggleChoice(choice, row));
    expect(viewer().state.variables.get(variable.id)).toBe(false);
    const code = viewer().buildCode;
    act(() => viewer().importBuildCode(code));
    expect(viewer().state.variables.get(variable.id)).toBe(false);
    expect(viewer().state.activated.has(variable.id)).toBe(false);
  });

  it("initializes auto-selected counters and applies their variable effect once", () => {
    const app = createDefaultApp();
    const variable = createDefaultVariable();
    variable.isTrue = true;
    app.variables = [variable];
    const row = createDefaultRow(app, 0);
    row.currentChoices = 9;
    const choice = createDefaultChoice(app, 0);
    Object.assign(choice, {
      isAutoActive: true,
      isSelectableMultiple: true,
      isChangeVariables: true,
      changeType: "2",
      changedVariables: [variable.id],
    });
    app.activated = [choice.id];
    row.objects = [choice];
    app.rows = [row];
    const viewer = mountViewer(app);

    expect(viewer().state.activated.get(choice.id)?.multiple).toBe(1);
    expect(viewer().state.currentChoices.get(row.id)).toBe(1);
    expect(viewer().state.variables.get(variable.id)).toBe(false);
  });

  it.each([false, true])(
    "selects an addon's parent and removes its scores with the parent (multi: %s)",
    (multi) => {
      const app = createDefaultApp();
      const row = createDefaultRow(app, 0);
      row.allowedChoices = 1;
      const point = createDefaultPointType(app);
      point.startingSum = 100;
      app.pointTypes = [point];
      const parent = createDefaultChoice(app, 0);
      parent.scores = [createDefaultScore(point.id, 10)];
      const addon = {
        ...createDefaultAddon(app),
        isSelectable: true,
        isSelectableMultiple: multi,
        scores: [createDefaultScore(point.id, 5)],
        countAsChoice: false,
        requireds: [{ ...createDefaultRequireds(), type: "id", reqId: parent.id, required: true }],
      } as SelectableAddon;
      // Old documents may omit parentId; the containing choice is authoritative.
      parent.addons = [addon];
      row.objects = [parent];
      app.rows = [row];
      const viewer = mountViewer(app);

      act(() => (multi ? viewer().more(addon, row) : viewer().toggleAddon(addon, parent, row)));
      expect(viewer().state.activated.has(parent.id)).toBe(true);
      expect(viewer().state.activated.has(addon.id)).toBe(true);
      expect(viewer().totals.get(point.id)?.total).toBe(85);
      act(() => viewer().toggleChoice(parent, row));
      expect(viewer().state.activated.has(addon.id)).toBe(false);
      expect(viewer().totals.get(point.id)?.total).toBe(100);
    },
  );

  it.each(["parent", "addon"])(
    "leaves the session unchanged when the %s requirements block an addon",
    (blocked) => {
      const app = createDefaultApp();
      const row = createDefaultRow(app, 0);
      const parent = createDefaultChoice(app, 0);
      const addon = {
        ...createDefaultAddon(app),
        isSelectable: true,
        parentId: parent.id,
      } as SelectableAddon;
      (blocked === "parent" ? parent : addon).requireds = [
        { ...createDefaultRequireds(), type: "id", reqId: "missing", required: true },
      ];
      parent.addons = [addon];
      row.objects = [parent];
      app.rows = [row];
      const viewer = mountViewer(app);

      act(() => viewer().toggleAddon(addon, parent, row));
      expect(viewer().state.activated.size).toBe(0);
    },
  );

  it("deselects the parent after its last addon is removed when configured", () => {
    const app = createDefaultApp();
    const row = createDefaultRow(app, 0);
    row.allowedChoices = 0;
    const parent = createDefaultChoice(app, 0);
    parent.deselectWhenNoAddon = true;
    const a = {
      ...createDefaultAddon(app),
      isSelectable: true,
      parentId: parent.id,
    } as SelectableAddon;
    const b = {
      ...createDefaultAddon(app),
      isSelectable: true,
      parentId: parent.id,
    } as SelectableAddon;
    parent.addons = [a, b];
    row.objects = [parent];
    app.rows = [row];
    const viewer = mountViewer(app);

    act(() => viewer().toggleChoice(parent, row));
    act(() => viewer().toggleAddon(a, parent, row));
    act(() => viewer().toggleAddon(b, parent, row));
    act(() => viewer().toggleAddon(a, parent, row));
    expect(viewer().state.activated.has(parent.id)).toBe(true);
    act(() => viewer().toggleAddon(b, parent, row));
    expect(viewer().state.activated.size).toBe(0);
  });

  it("displays the player's image URL before and after loading a saved build", () => {
    const app = createDefaultApp();
    const row = createDefaultRow(app, 0);
    const choice = createDefaultChoice(app, 0);
    choice.isImageUpload = true;
    choice.image = "https://example.com/default.png";
    row.objects = [choice];
    app.rows = [row];
    const image = "https://example.com/player.png";
    const viewer = mountViewer(app);

    act(() => viewer().toggleChoice(choice, row));
    act(() => viewer().setUploadedImage(choice.id, image));
    expect(resolveChoiceImage(choice, viewer().idx, viewer().state)).toBe(image);
    const code = viewer().buildCode;
    act(() => viewer().clean());
    expect(resolveChoiceImage(choice, viewer().idx, viewer().state)).toBe(choice.image);
    act(() => viewer().importBuildCode(code));
    expect(resolveChoiceImage(choice, viewer().idx, viewer().state)).toBe(image);
  });

  it.each(["1", "2", "3"])(
    "applies variable change type %s once and cleans up dependents on deselection",
    (changeType) => {
      const app = createDefaultApp();
      const variable = createDefaultVariable();
      variable.isTrue = changeType === "2";
      app.variables = [variable];
      const row = createDefaultRow(app, 0);
      row.allowedChoices = 0;
      const toggle = createDefaultChoice(app, 0);
      Object.assign(toggle, {
        isChangeVariables: true,
        changeType,
        changedVariables: [variable.id],
      });
      const dependent = createDefaultChoice(app, 1);
      dependent.requireds = [
        {
          ...createDefaultRequireds(),
          type: "id",
          reqId: variable.id,
          required: changeType !== "2",
        },
      ];
      row.objects = [toggle, dependent];
      app.rows = [row];
      const viewer = mountViewer(app);

      act(() => viewer().toggleChoice(toggle, row));
      expect(viewer().state.variables.get(variable.id)).toBe(changeType !== "2");
      act(() => viewer().toggleChoice(dependent, row));
      expect(viewer().state.activated.has(dependent.id)).toBe(true);
      act(() => viewer().toggleChoice(toggle, row));
      expect(viewer().state.variables.get(variable.id)).toBe(changeType === "2");
      expect(viewer().state.activated.has(dependent.id)).toBe(false);
    },
  );

  it("keeps each random roll stable through increments, decrements, and save/load", () => {
    const app = createDefaultApp();
    const point = createDefaultPointType(app, "Gold");
    point.startingSum = 100;
    app.pointTypes = [point];
    const row = createDefaultRow(app, 0);
    const choice = createDefaultChoice(app, 0);
    Object.assign(choice, { isSelectableMultiple: true, numMultipleTimesPluss: 5 });
    choice.scores = [{ ...createDefaultScore(point.id), isRandom: true, minValue: 1, maxValue: 9 }];
    row.objects = [choice];
    app.rows = [row];
    const viewer = mountViewer(app);
    const rng = vi.spyOn(Math, "random").mockReturnValue(0.25);

    act(() => viewer().more(choice, row)); // roll 3
    expect(viewer().totals.get(point.id)?.total).toBe(97);
    rng.mockReturnValue(0.75);
    act(() => viewer().more(choice, row)); // roll 7, retain first roll 3
    expect(viewer().totals.get(point.id)?.total).toBe(90);
    const code = viewer().buildCode;
    rng.mockReturnValue(0);
    act(() => viewer().importBuildCode(code));
    expect(viewer().totals.get(point.id)?.total).toBe(90);
    act(() => viewer().less(choice, row));
    expect(viewer().totals.get(point.id)?.total).toBe(97);
    act(() => viewer().more(choice, row)); // roll 1 for the new second copy
    expect(viewer().totals.get(point.id)?.total).toBe(96);
  });
});
