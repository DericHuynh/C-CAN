/**
 * Viewer parity suite for the other example documents (SleepersDream,
 * callingOfFaust): pins the fixes where the C-CAN viewer diverged from the
 * original ICCPlus viewer.
 *
 *  - SleepersDream: the doc's mutually-exclusive choices rely on the req-state
 *    filter (`reqFilterBlur` is stored as the STRING "50" — the original
 *    viewer interpolates it; the C-CAN viewer must too). When one exclusive
 *    choice is picked, the others must blur + fade + get the req background.
 *  - callingOfFaust: the point bar must render whenever point types EXIST
 *    (hidden point types are simply not shown inside it), and scores render
 *    with the point's `beforeText`/`afterText` and the +/- prefix.
 */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { normalizeApp } from "./cyoa";
import { CyoaViewer } from "../app/components/projects/CyoaViewer";

const FIXTURES: Record<string, string> = {
  sleepers: new URL("../examples/SleepersDream.json", import.meta.url).pathname,
  faust: new URL("../examples/callingOfFaust.json", import.meta.url).pathname,
};

function loadApp(name: keyof typeof FIXTURES, activated: string[] = []) {
  try {
    const raw = JSON.parse(
      readFileSync(FIXTURES[name], "utf8"),
    ) as Record<string, unknown>;
    const app = normalizeApp(raw);
    if (activated.length > 0) app.activated = activated;
    return app;
  } catch {
    return null; // fixture absent (e.g. CI) — suite is skipped
  }
}

const sleepers = loadApp("sleepers", ["S1R0-0C01", "S1R01-0C01"]);
const faust = loadApp("faust");

describe.skipIf(!sleepers || !faust)("viewer parity with original ICCPlus", () => {
  const html = renderToStaticMarkup(<CyoaViewer app={sleepers!} />);

  it("applies the req-state blur from a STRING reqFilterBlur value", () => {
    // The doc stores `reqFilterBlur: "50"` (string); blur(0px) would mean the
    // mutually-exclusive choices never actually blur.
    expect(html).toContain("filter:blur(50px) opacity(50%)");
  });

  it("applies the req background color to unmet choices", () => {
    expect(html).toContain("background-color:#2929297D");
  });

  it("applies the sel background color to selected choices", () => {
    expect(html).toContain("background-color:#6161616D");
  });

  it("applies string-number border radii and margins", () => {
    // objectBorderRadiusTopLeft etc. are stored as strings in SleepersDream.
    expect(html).toContain("border-radius:3px 3px 3px 3px");
    expect(html).toContain("margin:25px 2% 25px");
  });

  it("renders score badges with the point's beforeText and +/- prefix", () => {
    // S1R01-0C01 costs -5 Dream (stored value "-5") with plussOrMinusAdded.
    expect(html).toContain("Dream: ");
    expect(html).toContain("+5");
  });

  it("does not show requirements the author hid with showRequired:false", () => {
    // The exclusive choices' requireds all carry showRequired:false — the
    // original viewer hides them; the old C-CAN filter showed met ones.
    expect(html).not.toMatch(/Required: Late Late Late!/);
  });
});

describe.skipIf(!faust)("viewer point bar parity", () => {
  const html = renderToStaticMarkup(<CyoaViewer app={faust!} />);

  it("renders the point bar when point types exist even if all are hidden", () => {
    // callingOfFaust has point types with isNotShownPointBar — the bar still
    // docks (the original keys off pointTypes.length, not enabled points).
    expect(html).toContain("sticky bottom-0");
  });

  it("colors the sum with barPointPos for non-negative totals", () => {
    expect(html).toContain("#FF0000FF");
  });

  it("applies the bar text styling (font/size/padding)", () => {
    expect(html).toContain("font-family:Times New Roman;font-size:15px");
    expect(html).toContain("padding:17px");
  });
});
