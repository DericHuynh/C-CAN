// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import {
  createDefaultApp,
  createDefaultChoice,
  createDefaultRow,
  createDefaultScore,
  createDefaultPointType,
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
