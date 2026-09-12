// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  createDefaultApp,
  createDefaultChoice,
  createDefaultRow,
  createDefaultScore,
  createDefaultPointType,
  createDefaultRequireds,
} from "@shared/cyoa";
import type { SelectableAddon } from "@shared/types";
import { CyoaViewer } from "./CyoaViewer";

function fixture() {
  const app = createDefaultApp();
  const row = createDefaultRow(app, 0);
  row.id = "row";
  const choice = createDefaultChoice(app, 0);
  choice.id = "choice";
  choice.title = "Parent";
  row.objects = [choice];
  app.rows = [row];
  const render = () =>
    new DOMParser().parseFromString(renderToStaticMarkup(<CyoaViewer app={app} />), "text/html");
  return { app, row, choice, render };
}

describe("ICCPlus viewer rendering parity", () => {
  it.each([
    ["1", ">", "More than: ", ""],
    ["2", "≥", "More than: ", "or more"],
    ["3", "=", "Equal to ", ""],
    ["4", "≤", "Less or equal to ", ""],
    ["5", "<", "Less than: ", ""],
    ["6", "≠", "Not equal to ", ""],
  ])(
    "renders point operator %s as %s instead of legacy prose",
    (operator, symbol, beforeText, afterText) => {
      const { app, choice, render } = fixture();
      const point = { ...createDefaultPointType(app), name: "Dream" };
      app.pointTypes = [point];
      choice.requireds = [
        {
          ...createDefaultRequireds(),
          type: "points",
          reqId: point.id,
          reqPoints: 5,
          operator,
          beforeText,
          afterText,
          required: true,
          showRequired: true,
        },
      ];
      const text = render().querySelector('[data-cyoa-choice="choice"]')!.textContent;
      expect(text).toContain(`Dream ${symbol} 5`);
      expect(text).not.toMatch(/more than|less than|equal to|or more/i);
    },
  );

  it("preserves custom requirement prose and chained prefixes", () => {
    const { app, choice, render } = fixture();
    const point = { ...createDefaultPointType(app), name: "Dream" };
    app.pointTypes = [point];
    const req = {
      ...createDefaultRequireds(),
      type: "points",
      reqId: point.id,
      reqPoints: 5,
      operator: "2",
      beforeText: "Requires: ",
      afterText: "or more",
      required: true,
      showRequired: true,
    };
    choice.requireds = [
      req,
      { ...req, reqPoints: 10, operator: "5", beforeText: "and less than: ", afterText: "" },
    ];
    expect(
      render().querySelector('[data-cyoa-choice="choice"]')!.textContent?.replace(/\s+/g, " "),
    ).toContain("Requires: Dream ≥ 5 and Dream < 10");
    choice.requireds = [{ ...req, customTextIsOn: true, customText: "Bring more than dreams" }];
    expect(render().querySelector('[data-cyoa-choice="choice"]')!.textContent).toContain(
      "Bring more than dreams",
    );
  });

  it("honors disabled borders, transparent backgrounds and natural card height", () => {
    const { app, choice, render } = fixture();
    choice.image = "https://example.com/image.png";
    Object.assign(app.styling, {
      objectBorderIsOn: false,
      objectBgColorIsOn: false,
      objectHeight: false,
      objectImgBorderIsOn: false,
    });
    const card = render().querySelector<HTMLElement>('[data-cyoa-choice="choice"]')!;
    expect(card.style.borderStyle).toBe("none");
    expect(card.style.backgroundColor).toBe("transparent");
    expect(card.classList.contains("h-full")).toBe(false);
    expect(card.querySelector("img")!.getAttribute("style")).toContain("border:none");
  });

  it("honors authored image widths and addon alignment", () => {
    const { app, choice, render } = fixture();
    choice.template = 2;
    choice.image = "https://example.com/image.png";
    choice.addonJustify = "end";
    choice.addons = [
      {
        id: "detail",
        title: "Detail",
        text: "",
        image: "",
        template: 1,
        requireds: [],
        isSelectable: false,
      },
    ];
    Object.assign(app.styling, { objectImageBoxWidth: 30, objectImageWidth: 75 });
    const card = render().querySelector('[data-cyoa-choice="choice"]')!;
    const img = card.querySelector("img")!;
    expect(img.style.width).toBe("75%");
    expect(img.parentElement!.style.width).toBe("30%");
    expect(
      card
        .querySelector('[data-cyoa-addon="detail"]')!
        .parentElement!.classList.contains("justify-end"),
    ).toBe(true);
  });

  it.each([
    [2, "flex-row"],
    [3, "flex-row-reverse"],
    [4, "flex-col-reverse"],
  ])("applies choice template %s to the image/body wrapper", (template, className) => {
    const { choice, render } = fixture();
    choice.template = Number(template);
    choice.image = "https://example.com/image.png";
    const card = render().querySelector('[data-cyoa-choice="choice"]')!;
    expect(card.querySelector(`:scope > .${className}`)).not.toBeNull();
  });

  it("renders independent addon widths, templates, and author styling without nested buttons", () => {
    const { app, choice, render } = fixture();
    choice.addons = [
      {
        ...createDefaultChoice(app, 0),
        id: "addon",
        title: "Addon",
        isSelectable: true,
        isSelectableMultiple: true,
        addonWidth: "col-6",
        template: 2,
        image: "https://example.com/addon.png",
      } as unknown as SelectableAddon,
    ];
    Object.assign(app.styling, {
      useAddonDesign: true,
      addonBgColorIsOn: true,
      addonBgColor: "#123456",
      addonTextPadding: 13,
    });
    const doc = render();
    const addon = doc.querySelector('[data-cyoa-addon="addon"]')!;
    expect(addon.classList.contains("col-6")).toBe(true);
    expect((addon as HTMLElement).style.backgroundColor).toBe("rgb(18, 52, 86)");
    expect((addon as HTMLElement).style.padding).toBe("13px");
    expect(addon.querySelector(".flex-row")).not.toBeNull();
    expect(doc.querySelector("button button")).toBeNull();
  });

  it("shows both parent and addon scores when scores move into the first addon", () => {
    const { app, choice, render } = fixture();
    const point = createDefaultPointType(app);
    app.pointTypes = [point];
    choice.showScoreInAddon = true;
    choice.scores = [createDefaultScore(point.id, 7)];
    choice.addons = [
      {
        ...createDefaultChoice(app, 0),
        id: "addon",
        isSelectable: true,
        scores: [createDefaultScore(point.id, 11)],
      } as unknown as SelectableAddon,
    ];
    const addon = render().querySelector('[data-cyoa-addon="addon"]')!;
    expect(addon.textContent).toContain("7");
    expect(addon.textContent).toContain("11");
  });

  it("moves the parent counter into its addon and honors hidden controls", () => {
    const { app, choice, render } = fixture();
    Object.assign(choice, { isSelectableMultiple: true, showMulInAddon: true, hideCounter: true });
    choice.addons = [
      {
        id: "addon",
        title: "Details",
        text: "",
        image: "",
        template: 1,
        requireds: [],
        isSelectable: false,
      },
    ];
    const doc = render();
    expect(doc.querySelectorAll(".multi-counter")).toHaveLength(1);
    expect(doc.querySelector('[data-cyoa-addon="addon"] .multi-counter')).not.toBeNull();
    expect(doc.querySelector('[aria-label="Increase"]')).toBeNull();
    expect(doc.querySelector('[aria-label="Decrease"]')).toBeNull();
    void app;
  });

  it("result rows use their own layout and show only selected addons with disabled counters", () => {
    const { app, row, choice, render } = fixture();
    choice.isSelectableMultiple = true;
    choice.addons = ["picked", "unpicked"].map(
      (id) =>
        ({
          ...createDefaultChoice(app, 0),
          id,
          title: id,
          isSelectable: true,
        }) as unknown as SelectableAddon,
    );
    app.activated = [choice.id, "picked"];
    const result = createDefaultRow(app, 1);
    Object.assign(result, {
      id: "results",
      isResultRow: true,
      resultShowRowTitle: true,
      choicesShareTemplate: true,
      objectWidth: "col-12",
    });
    app.rows.push(result);
    row.title = "Origin title";
    const output = render().querySelector('[data-cyoa-row="results"]')!;
    expect(output.textContent).toContain("Origin title");
    expect(output.querySelector('[data-cyoa-addon="picked"]')).not.toBeNull();
    expect(output.querySelector('[data-cyoa-addon="unpicked"]')).toBeNull();
    expect(output.querySelector('[aria-label="Increase"]')?.hasAttribute("disabled")).toBe(true);
  });
});

it("plays choices in the visual editor while pencils and double-clicks edit without changing points", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const { app, row, choice } = fixture();
  const point = createDefaultPointType(app, "Dream");
  Object.assign(point, { startingSum: 10, beforeText: "Dream: ", afterText: "" });
  app.pointTypes = [point];
  choice.scores = [createDefaultScore(point.id, 3)];
  choice.addons = [
    {
      ...createDefaultChoice(app, 0),
      id: "addon",
      parentId: choice.id,
      title: "Addon",
      isSelectable: true,
      scores: [createDefaultScore(point.id, 1)],
    } as unknown as SelectableAddon,
  ];
  const counter = createDefaultChoice(app, 1);
  Object.assign(counter, {
    id: "counter",
    title: "Counter",
    isSelectableMultiple: true,
    numMultipleTimesMinus: 0,
    numMultipleTimesPluss: 3,
    scores: [createDefaultScore(point.id, 2)],
  });
  row.objects.push(counter);
  const gated = createDefaultRow(app, 1);
  Object.assign(gated, {
    id: "gated",
    title: "Unlocked",
    requireds: [{ ...createDefaultRequireds(), type: "id", reqId: choice.id, required: true }],
  });
  app.rows.push(gated);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onSelect = vi.fn();
  const onAction = vi.fn();
  const onStartEdit = vi.fn();
  vi.useFakeTimers();
  const render = async (editing: boolean) => {
    await act(async () =>
      root.render(
        <CyoaViewer
          app={app}
          editing={editing}
          onSelect={onSelect}
          onAction={onAction}
          onStartEdit={onStartEdit}
        />,
      ),
    );
  };
  const click = async (selector: string) => {
    const element = host.querySelector<HTMLElement>(selector);
    expect(element).not.toBeNull();
    await act(async () => element!.click());
    await act(async () => vi.advanceTimersByTime(450));
  };
  const selected = () =>
    host.querySelector('[data-cyoa-choice="choice"]')!.classList.contains("choice-selected");
  const points = () => host.querySelector(".bottom-0")!.textContent;
  try {
    await render(true);
    for (const label of ["Edit", "Move up", "Move down", "Delete"]) {
      expect(host.querySelector(`[data-cyoa-choice="choice"] [aria-label="${label}"]`)).not.toBeNull();
      expect(host.querySelector(`[data-cyoa-row="row"] [aria-label="${label}"]`)).not.toBeNull();
    }
    await click('[data-cyoa-choice="choice"] [aria-label="Edit"]');
    expect(onAction).toHaveBeenCalledWith("edit", { kind: "choice", id: "choice" });
    expect(selected()).toBe(false);
    expect(host.querySelector('[data-cyoa-row="gated"]')).toBeNull();
    await click('[data-cyoa-choice="choice"]');
    expect(selected()).toBe(true);
    expect(points()).toMatch(/Dream:\s*7/);
    expect(host.querySelector('[data-cyoa-row="gated"]')).not.toBeNull();
    await click('[data-cyoa-choice="counter"] [aria-label="Increase"]');
    expect(points()).toMatch(/Dream:\s*5/);
    await click('[data-cyoa-addon="addon"]');
    expect(points()).toMatch(/Dream:\s*4/);
    await click('[data-cyoa-addon="addon"]');
    expect(points()).toMatch(/Dream:\s*5/);
    const title = host.querySelector('[data-cyoa-choice="choice"] h3')!;
    await act(async () => {
      title.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
      title.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 2 }));
      title.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, detail: 2 }));
      vi.advanceTimersByTime(450);
    });
    expect(onStartEdit).toHaveBeenCalledWith({ kind: "choice", id: "choice", field: "title" });
    expect(selected()).toBe(true);
    expect(points()).toMatch(/Dream:\s*5/);
    await click('[data-cyoa-choice="choice"]');
    expect(selected()).toBe(false);
    expect(points()).toMatch(/Dream:\s*8/);
    expect(host.querySelector('[data-cyoa-row="gated"]')).toBeNull();
    await click('[data-cyoa-choice="counter"] [aria-label="Decrease"]');
    expect(points()).toMatch(/Dream:\s*10/);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
