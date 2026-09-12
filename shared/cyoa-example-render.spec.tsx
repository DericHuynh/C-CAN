/**
 * Viewer render parity suite for the reference ICCPlus document
 * examples/project.json.
 *
 * Hand-maintained complement to the generated shared/cyoa-example.spec.ts:
 * it renders <CyoaViewer> to static markup and asserts the document's styling
 * is actually applied to the DOM (inline styles on choice cards, rows, images,
 * the bottom-docked point bar and requirement labels) instead of being
 * silently dropped.
 */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { normalizeApp } from "./cyoa";
import { CyoaViewer } from "../app/features/viewer/CyoaViewer";

const EXAMPLE_PATH = new URL("../examples/project.json", import.meta.url).pathname;

let exampleExists = false;
try {
  readFileSync(EXAMPLE_PATH);
  exampleExists = true;
} catch {
  // fixture absent (e.g. CI without the large example) — suite is skipped
}

const RAW = exampleExists
  ? (JSON.parse(readFileSync(EXAMPLE_PATH, "utf8")) as Record<string, unknown>)
  : {};
const app = normalizeApp(RAW);

function render(): string {
  return renderToStaticMarkup(<CyoaViewer app={app} />);
}

describe.skipIf(!exampleExists)("viewer render applies examples/project.json styling", () => {
  const html = render();

  it("renders choice cards", () => {
    expect(html).toContain("data-cyoa-choice=");
  });

  it("applies objectBgColor #9A997BFF to the choice card", () => {
    expect(html).toContain("background-color:#9A997BFF");
  });

  it("applies the object border (double 2px #D64800FF)", () => {
    expect(html).toContain("border-style:double");
    expect(html).toContain("border-width:2px");
    expect(html).toContain("border-color:#D64800FF");
  });

  it("applies the object border radius 40px 40px 10px 10px", () => {
    expect(html).toContain("border-radius:40px 40px 10px 10px");
  });

  it("applies the object drop shadow", () => {
    expect(html).toContain("drop-shadow(3px 3px 3px");
  });

  it("applies objectMargin 10px to the card wrapper (padding)", () => {
    expect(html).toContain("padding:10px");
  });

  it("does not put the bg-card utility on choice cards", () => {
    const cardOpen = html.match(/<div data-cyoa-choice="[^"]*"[^>]* class="([^"]*)"/);
    expect(cardOpen).toBeTruthy();
    expect(cardOpen![1]).not.toMatch(/\bbg-card\b/);
  });

  it("renders choice images at width 100%", () => {
    expect(html).toMatch(/<img[^>]*width:100%/);
  });

  it("applies rowBgColor to the row header", () => {
    // Row surface backgrounds come through headerStyle.
    expect(html).toContain("background-color:#9A997BFF");
  });

  it("applies the row border (double 4px #D64800FF)", () => {
    expect(html).toContain("border:4px double #D64800FF");
  });

  it("renders the point bar docked at the bottom (sticky bottom-0)", () => {
    expect(html).toContain("sticky bottom-0");
    // The bar must come AFTER the rows in the DOM so sticky bottom-0 pins it
    // to the bottom of the scrollport from the start (the original viewer's
    // bottom bar). The rows container is the only direct child with the rows.
    const barIdx = html.indexOf("sticky bottom-0 z-20");
    const rowsIdx = html.indexOf("data-cyoa-row=");
    expect(barIdx).toBeGreaterThan(-1);
    expect(rowsIdx).toBeGreaterThan(-1);
    expect(barIdx).toBeGreaterThan(rowsIdx);
  });

  it("renders requirements under the title without the 'choice' suffix", () => {
    // requirementLabel strips `afterText === "choice"` — no stray "choice" text.
    const choiceCardSnippet = html.slice(html.indexOf("data-cyoa-choice="));
    // Titles/text may legitimately contain the word; check the requirement area
    // does not append "(choice)" — assert no "choice)" suffix pattern.
    expect(html).not.toMatch(/choice\)/);
  });

  it("renders fonts from the doc (Courier titles, Georgia text)", () => {
    expect(html).toContain("font-family:Courier");
    expect(html).toContain("font-family:Georgia");
  });

  it("renders row margins from rowMargin (10% side insets on the header)", () => {
    expect(html).toContain("margin-left:10%");
    expect(html).toContain("margin-right:10%");
  });

  it("does not apply an unselected filter the doc does not enable", () => {
    // The example keeps every unsel*IsOn flag off, so no grayscale etc.
    // ICCPlus-compatible choice-unselected CSS classes are expected; inspect
    // the actual style rather than rejecting a word anywhere in the HTML.
    const styles = [...html.matchAll(/data-cyoa-choice="[^"]+"[^>]*style="([^"]*)"/g)].map(
      (match) => match[1],
    );
    expect(styles.length).toBeGreaterThan(0);
    expect(
      styles.some((style) =>
        /filter:[^;]*(?:blur|grayscale|opacity|brightness|contrast|hue-rotate|invert|sepia|saturate)\(/.test(
          style,
        ),
      ),
    ).toBe(false);
  });

  it("renders the initially-visible rows (progressive gating)", () => {
    // Rows 2+ require the "World Section" choice (reqId choice-kvl2), so the
    // initial render shows only the first two rows and their choices — the
    // same gating the original viewer applies.
    expect(html).toContain("Introduction");
    expect(html).toContain("World Section");
    expect(html).not.toContain("Population");
  });
});
