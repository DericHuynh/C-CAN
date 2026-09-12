// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import {
  createDefaultApp,
  createDefaultChoice,
  createDefaultPointType,
  createDefaultRow,
  createDefaultScore,
} from "@shared/cyoa";
import { MultiChoice } from "./MultiChoice";
import { useCyoa, type UseCyoaResult } from "./use-cyoa";

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.clear();
  vi.unstubAllGlobals();
});

it.each([false, undefined, true])(
  "keeps the counter, costs and restored build in sync with legacy variable flag %s",
  (isMultipleUseVariable) => {
    const app = createDefaultApp();
    const row = createDefaultRow(app, 0);
    const choice = createDefaultChoice(app, 0);
    const currency = {
      ...createDefaultPointType(app),
      id: "dream",
      startingSum: 10,
      belowZeroNotAllowed: true,
    };
    const legacyCounter = { ...createDefaultPointType(app), id: "legacy-counter", startingSum: 0 };
    Object.assign(choice, {
      isSelectableMultiple: true,
      isMultipleUseVariable,
      multipleScoreId: legacyCounter.id,
      numMultipleTimesPluss: 10,
      numMultipleTimesMinus: 0,
      scores: [createDefaultScore(currency.id, 3)],
    });
    row.objects = [choice];
    app.rows = [row];
    app.pointTypes = [currency, legacyCounter];
    let viewer: UseCyoaResult;
    function Harness() {
      viewer = useCyoa({ app });
      return <MultiChoice cyoa={viewer} choice={choice} row={row} />;
    }
    act(() => root.render(<Harness />));
    const counter = () => container.querySelector('[title="Click to set count"]')!.textContent;
    const click = (label: string) =>
      act(() => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());
    expect(counter()).toBe("0");
    click("Increase");
    click("Increase");
    expect(counter()).toBe("2");
    expect(viewer!.totals.get(currency.id)?.total).toBe(4);
    expect(viewer!.totals.get(legacyCounter.id)?.total).toBe(0);
    const build = viewer!.buildCode;
    click("Decrease");
    expect(counter()).toBe("1");
    expect(viewer!.totals.get(currency.id)?.total).toBe(7);
    act(() => viewer.importBuildCode(build));
    expect(counter()).toBe("2");
    expect(viewer!.totals.get(currency.id)?.total).toBe(4);
    click("Increase");
    click("Increase");
    expect(counter()).toBe("3");
    expect(viewer!.totals.get(currency.id)?.total).toBe(1);
    click("Decrease");
    click("Decrease");
    click("Decrease");
    expect(counter()).toBe("0");
    expect(viewer!.totals.get(currency.id)?.total).toBe(10);
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Decrease"]')!.disabled).toBe(
      true,
    );
  },
);
