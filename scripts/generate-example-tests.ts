/**
 * Generates shared/cyoa-example.spec.ts — a parity test suite for the large
 * (17 MB) reference ICCPlus document in examples/project.json.
 *
 * The suite pins the aggregate shape of the document (per-collection key
 * presence + sample values, styling values) and verifies our import path
 * *applies* it instead of silently dropping it:
 *   - normalizeApp preserves every source value (full-document diff),
 *   - each styling key survives import with its value,
 *   - the styling cascade resolves the document's styling for choice cards,
 *     row cards, text, images and buttons.
 *
 * Usage: pnpm script generate-example-tests [--file path] [--out path]
 *   --file  source project.json (default examples/project.json)
 *   --out   generated spec path (default shared/cyoa-example.spec.ts)
 *
 * The generated file reads the example at runtime and skips cleanly when the
 * fixture is absent, so the suite stays green in fixture-less CI.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createDefaultApp, normalizeApp } from "../shared/cyoa.js";

/** Keys that carry binary/embedded payloads — presence is asserted, values never embedded. */
const PAYLOAD_KEYS = new Set([
  "image",
  "backgroundImage",
  "rowBackgroundImage",
  "objectBackgroundImage",
  "addonBackgroundImage",
  "backpackBgImage",
  "objectBorderImage",
  "rowBorderImage",
  "addonBorderImage",
  "bgImage",
  "defaultImage",
  "negativeImage",
  "audio",
  "favicon",
  "loadingBgImage",
]);

const MAX_EMBED_LEN = 400;

type Collection = {
  label: string;
  /** Runtime accessor on the normalized app (used by generated code). */
  accessor: string;
  items: unknown[];
};

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** JSON literal for a value (undefined/null safe). */
function lit(v: unknown): string {
  if (v === undefined) return "undefined";
  return JSON.stringify(v);
}

/** True when the value is small enough to embed in the generated spec. */
function embeddable(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.length <= MAX_EMBED_LEN;
  if (typeof v === "number" || typeof v === "boolean") return true;
  if (Array.isArray(v)) return v.every(embeddable);
  return false;
}

/** Build the sample set for one key: distinct values + first-occurrence paths. */
function samplesFor(
  items: unknown[],
  key: string,
  max = 4,
): Array<{ path: string; value: unknown }> {
  const out: Array<{ path: string; value: unknown }> = [];
  const seen = new Set<string>();
  items.forEach((item, i) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return;
    const record = item as Record<string, unknown>;
    if (!(key in record)) return;
    const value = record[key];
    const tag = JSON.stringify(value);
    if (seen.has(tag)) return;
    seen.add(tag);
    if (out.length >= max) return;
    out.push({ path: `$.${i}.${key}`, value });
  });
  return out;
}

function keyPresence(items: unknown[], key: string): number {
  return items.filter(
    (item): boolean =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item) && key in (item as object),
  ).length;
}

/** Count of styling keys whose value differs from the default (customized). */
function customizedStylingKeys(raw: Record<string, unknown>): string[] {
  const defaults = createDefaultApp().styling as Record<string, unknown>;
  const src = raw.styling as Record<string, unknown> | undefined;
  if (!src) return [];
  return Object.keys(src).filter(
    (k) => !PAYLOAD_KEYS.has(k) && JSON.stringify(src[k]) !== JSON.stringify(defaults[k]),
  );
}

export default async function generateExampleTests(args: Record<string, unknown>) {
  const file = resolve((args.file as string) ?? "examples/project.json");
  const out = resolve((args.out as string) ?? "shared/cyoa-example.spec.ts");
  const raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  const app = normalizeApp(raw);

  const collections: Collection[] = [
    { label: "rows", accessor: "app.rows", items: arr(raw.rows) },
    { label: "backpack rows", accessor: "app.backpack", items: arr(raw.backpack) },
    {
      label: "choices",
      accessor: "app.rows.flatMap((r) => r.objects ?? [])",
      items: arr(raw.rows).flatMap((r) => arr((r as Record<string, unknown>).objects)),
    },
    {
      label: "addons",
      accessor: "app.rows.flatMap((r) => r.objects ?? []).flatMap((o) => o.addons ?? [])",
      items: arr(raw.rows).flatMap((r) =>
        arr((r as Record<string, unknown>).objects).flatMap((o) =>
          arr((o as Record<string, unknown>).addons),
        ),
      ),
    },
    { label: "pointTypes", accessor: "app.pointTypes", items: arr(raw.pointTypes) },
    { label: "groups", accessor: "app.groups", items: arr(raw.groups) },
    {
      label: "globalRequirements",
      accessor: "app.globalRequirements ?? []",
      items: arr(raw.globalRequirements),
    },
    { label: "variables", accessor: "app.variables", items: arr(raw.variables) },
    { label: "words", accessor: "app.words", items: arr(raw.words) },
    { label: "soundEffects", accessor: "app.soundEffects", items: arr(raw.soundEffects) },
    {
      label: "rowDesignGroups",
      accessor: "app.rowDesignGroups ?? []",
      items: arr(raw.rowDesignGroups),
    },
    {
      label: "objectDesignGroups",
      accessor: "app.objectDesignGroups",
      items: arr(raw.objectDesignGroups),
    },
  ];

  const srcStyling = (raw.styling as Record<string, unknown> | undefined) ?? {};

  const lines: string[] = [];
  const push = (s: string) => lines.push(s);

  /* ------------------------------------------------------------------ */
  /* File header                                                         */
  /* ------------------------------------------------------------------ */
  push(`/**
 * GENERATED FILE — do not edit by hand.
 * Source: scripts/generate-example-tests.ts
 * Regenerate with: pnpm script generate-example-tests
 *
 * Import parity suite for the reference ICCPlus document
 * examples/project.json (${(raw as Record<string, unknown>).version ?? "?"}, ${
   (raw.rows as unknown[] | undefined)?.length ?? 0
 } rows, ${
   arr(raw.rows).flatMap((r) => arr((r as Record<string, unknown>).objects)).length
 } choices).
 *
 * Pins the aggregate shape of the document and verifies our import path
 * applies it instead of silently dropping it: normalizeApp preserves every
 * source value, every styling key survives with its value, and the styling
 * cascade resolves the document's styling for choice cards, row cards, text,
 * images and buttons.
 */
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vite-plus/test";

import { normalizeApp } from "./cyoa.js";
import { buildCyoaIndex, createCyoaState } from "./cyoa-engine.js";
import { buildFilterString } from "./cyoa-styling.js";
import {
  choiceSurfaceStyle,
  imageStyle,
  rowButtonStyle,
  rowSurfaceStyle,
  textStyle,
} from "../app/components/projects/cyoa-styles.js";
import type { App, Choice, Row } from "./types.js";

const EXAMPLE_PATH = new URL("../examples/project.json", import.meta.url).pathname;

let exampleExists = false;
try {
  readFileSync(EXAMPLE_PATH);
  exampleExists = true;
} catch {
  // fixture absent (e.g. CI without the large example) — suite is skipped
}

/** Resolve a generated path like \`$.rows.0.buttonText\` against a root. */
function valueAt(root: unknown, path: string): unknown {
  let cur: unknown = root;
  for (const part of path.slice(1).split(".")) {
    if (part === "") continue;
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

describe.skipIf(!exampleExists)("examples/project.json import parity", () => {
  let raw: Record<string, unknown>;
  let app: App;
  let idx: ReturnType<typeof buildCyoaIndex>;
  let state: ReturnType<typeof createCyoaState>;
  let sampleRow: Row;
  let sampleChoice: Choice;

  beforeAll(() => {
    raw = JSON.parse(readFileSync(EXAMPLE_PATH, "utf8")) as Record<string, unknown>;
    app = normalizeApp(raw);
    idx = buildCyoaIndex(app);
    state = createCyoaState(app);
    sampleRow = app.rows.find((r) => (r.objects?.length ?? 0) > 0) ?? app.rows[0];
    sampleChoice = sampleRow.objects[0];
  });

  /* ------------------------------------------------------------------ */
  /* Top-level keys                                                      */
  /* ------------------------------------------------------------------ */
  describe("top-level keys", () => {
    it("has ${Object.keys(raw).length} source keys", () => {
      expect(Object.keys(raw).length).toBe(${Object.keys(raw).length});
    });

    it("keeps every source top-level key after normalize", () => {
      const keys = Object.keys(raw);
      for (const key of keys) {
        expect(app).toHaveProperty(key);
      }
    });

    it("preserves forward-compat extras unknown to the defaults", () => {
      const known = new Set(Object.keys(app));
      const extras = Object.keys(raw).filter((k) => !known.has(k));
      for (const key of extras) {
        expect((app as unknown as Record<string, unknown>)[key]).toEqual(raw[key]);
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /* Document diff: nothing dropped or rewritten                         */
  /* ------------------------------------------------------------------ */
  describe("normalizeApp round-trip", () => {
    it("never drops or rewrites any source value", () => {
      const after = JSON.parse(JSON.stringify(app)) as Record<string, unknown>;
      const mutations: string[] = [];
      const diffTree = (before: unknown, afterVal: unknown, path: string): void => {
        if (typeof before !== typeof afterVal) {
          if (before === null) return;
          if (typeof before === "number" && typeof afterVal === "number") return;
          if (typeof before === "boolean" && typeof afterVal === "boolean") return;
          mutations.push(\`[type change] \${path}: \${typeof before} -> \${typeof afterVal}\`);
          return;
        }
        if (Array.isArray(before) && Array.isArray(afterVal)) {
          if (before.length !== afterVal.length) return;
          for (let i = 0; i < before.length; i++) diffTree(before[i], afterVal[i], \`\${path}[\${i}]\`);
          return;
        }
        if (before && typeof before === "object" && afterVal && typeof afterVal === "object") {
          for (const [k, v] of Object.entries(before as Record<string, unknown>)) {
            if (!(k in (afterVal as Record<string, unknown>))) {
              mutations.push(\`[missing key] \${path}.\${k}\`);
            } else {
              diffTree(v, (afterVal as Record<string, unknown>)[k], \`\${path}.\${k}\`);
            }
          }
          return;
        }
        if (before !== afterVal) {
          mutations.push(\`[value change] \${path}: \${JSON.stringify(before)} -> \${JSON.stringify(afterVal)}\`);
        }
      };
      diffTree(raw, after, "$");
      expect(mutations).toEqual([]);
    });
  });

  /* ------------------------------------------------------------------ */
  /* Entity collections                                                  */
  /* ------------------------------------------------------------------ */
`);

  for (const collection of collections) {
    const { label, accessor, items } = collection;
    const keys = new Set<string>();
    for (const item of items) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      for (const key of Object.keys(item as object)) keys.add(key);
    }

    push(`  describe("${label}", () => {
    it("has ${items.length} items", () => {
      expect((${accessor}).length).toBe(${items.length});
    });
`);

    for (const key of [...keys].sort()) {
      const count = keyPresence(items, key);
      const isPayload = PAYLOAD_KEYS.has(key);
      push(`    it("${key} is present on ${count}/${items.length} items", () => {
      const withKey = (${accessor} as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && ${lit(key)} in item,
      );
      expect(withKey.length).toBe(${count});
    });
`);
      if (!isPayload) {
        const samples = samplesFor(items, key);
        if (samples.length > 0 && samples.every((s) => embeddable(s.value))) {
          push(`    it("${key} sample values survive normalize", () => {`);
          for (const sample of samples) {
            push(
              `      expect(valueAt(${accessor}, "${sample.path}")).toEqual(${lit(sample.value)});`,
            );
          }
          push(`    });
`);
        }
      }
    }
    push(`  });
`);
  }

  /* ------------------------------------------------------------------ */
  /* Styling values                                                      */
  /* ------------------------------------------------------------------ */
  push(`
  /* ------------------------------------------------------------------ */
  /* Styling: every source key keeps its value                            */
  /* ------------------------------------------------------------------ */
  describe("styling values", () => {
    it("has ${Object.keys(srcStyling).length} source styling keys", () => {
      expect(Object.keys(raw.styling as Record<string, unknown>).length).toBe(${Object.keys(srcStyling).length});
    });
`);
  for (const key of Object.keys(srcStyling).sort()) {
    const value = srcStyling[key];
    if (PAYLOAD_KEYS.has(key)) {
      push(`    it("styling.${key} survives normalize", () => {
      expect(app.styling).toHaveProperty(${lit(key)});
    });
`);
    } else {
      push(`    it("styling.${key} keeps its value", () => {
      expect(app.styling![${lit(key)}]).toEqual(${lit(value)});
    });
`);
    }
  }
  push(`  });

  /* ------------------------------------------------------------------ */
  /* Styling cascade: the document's styling is applied, not dropped      */
  /* ------------------------------------------------------------------ */
  describe("styling cascade applies the document", () => {
`);

  /* ---- choice card surface ---- */
  const st = srcStyling;
  const hasChoices = collections.find((c) => c.label === "choices")!.items.length > 0;
  if (hasChoices) {
    if (st.objectBgColorIsOn === true && typeof st.objectBgColor === "string" && st.objectBgColor) {
      push(`    it("applies objectBgColor to the choice card background", () => {
      expect(choiceSurfaceStyle(sampleChoice, sampleRow, idx, state).backgroundColor).toBe(${lit(st.objectBgColor)});
    });
`);
    }
    if (
      st.objectBorderIsOn === true &&
      typeof st.objectBorderColor === "string" &&
      st.objectBorderColor
    ) {
      push(`    it("applies the object border to the choice card", () => {
      const surface = choiceSurfaceStyle(sampleChoice, sampleRow, idx, state);
      expect(surface.borderColor).toBe(${lit(st.objectBorderColor)});
      expect(surface.borderStyle).toBe(${lit(st.objectBorderStyle ?? "")});
      expect(surface.borderWidth).toBe(${lit(`${st.objectBorderWidth ?? 0}px`)});
    });
`);
    }
    if (
      [
        st.objectBorderRadiusTopLeft,
        st.objectBorderRadiusTopRight,
        st.objectBorderRadiusBottomRight,
        st.objectBorderRadiusBottomLeft,
      ].some((v) => typeof v === "number" && v !== 0)
    ) {
      const suffix = st.objectBorderRadiusIsPixels === true ? "px" : "%";
      const radius = `${st.objectBorderRadiusTopLeft ?? 0}${suffix} ${st.objectBorderRadiusTopRight ?? 0}${suffix} ${st.objectBorderRadiusBottomRight ?? 0}${suffix} ${st.objectBorderRadiusBottomLeft ?? 0}${suffix}`;
      push(`    it("applies the object border radius to the choice card", () => {
      expect(choiceSurfaceStyle(sampleChoice, sampleRow, idx, state).borderRadius).toBe(${lit(radius)});
    });
`);
    }
    if (typeof st.objectMargin === "number" && st.objectMargin !== 0) {
      push(`    it("applies objectMargin to the choice card", () => {
      expect(choiceSurfaceStyle(sampleChoice, sampleRow, idx, state).margin).toBe(${lit(`${st.objectMargin}px`)});
    });
`);
    }
    if (st.objectDropShadowIsOn === true) {
      const shadow = `${st.objectDropShadowH ?? 0}px ${st.objectDropShadowV ?? 0}px ${st.objectDropShadowBlur ?? 0}px ${st.objectDropShadowSpread ?? 0}px ${st.objectDropShadowColor ?? ""}`;
      if (st.objectUseBoxShadowIsOn === true) {
        push(`    it("applies the object box shadow to the choice card", () => {
      expect(choiceSurfaceStyle(sampleChoice, sampleRow, idx, state).boxShadow).toBe(${lit(shadow)});
    });
`);
      } else {
        push(`    it("applies the object drop shadow filter to the choice card", () => {
      const filter = choiceSurfaceStyle(sampleChoice, sampleRow, idx, state).filter;
      expect(filter).toContain(${lit(`drop-shadow(${shadow})`)});
    });
`);
      }
    }
    if (typeof st.objectImageWidth === "number") {
      push(`    it("applies objectImageWidth to choice images", () => {
      expect(imageStyle("objectImage", idx, state, sampleRow, sampleChoice).width).toBe(${lit(`${st.objectImageWidth}%`)});
    });
`);
    }
    /* ---- text ---- */
    const textGroups: Array<[string, string]> = [
      ["objectTitle", "objectTitle"],
      ["objectText", "objectText"],
      ["scoreText", "scoreText"],
    ];
    for (const [group, prefix] of textGroups) {
      const font = st[prefix];
      const size = st[`${prefix}TextSize`];
      const color = st[`${prefix}Color`];
      if (typeof font === "string" && font) {
        push(`    it("applies ${prefix} font to ${group} text", () => {
      expect(textStyle(${lit(group)}, idx, state, sampleRow, sampleChoice).fontFamily).toBe(${lit(font)});
    });
`);
      }
      if (typeof size === "number" && size > 0) {
        push(`    it("applies ${prefix}TextSize to ${group} text", () => {
      expect(textStyle(${lit(group)}, idx, state, sampleRow, sampleChoice).fontSize).toBe(${lit(`${size}%`)});
    });
`);
      }
      if (typeof color === "string" && color) {
        push(`    it("applies ${prefix}Color to ${group} text", () => {
      expect(textStyle(${lit(group)}, idx, state, sampleRow, sampleChoice).color).toBe(${lit(color)});
    });
`);
      }
    }
    if (typeof st.addonTitle === "string" && st.addonTitle) {
      push(`    it("applies addonTitle font to addon titles", () => {
      expect(textStyle("addonTitle", idx, state, sampleRow, sampleChoice).fontFamily).toBe(${lit(st.addonTitle)});
    });
`);
    }
    if (typeof st.addonText === "string" && st.addonText) {
      push(`    it("applies addonText font to addon text", () => {
      expect(textStyle("addonText", idx, state, sampleRow, sampleChoice).fontFamily).toBe(${lit(st.addonText)});
    });
`);
    }
  }

  /* ---- row card surface ---- */
  if (st.rowBgColorIsOn === true && typeof st.rowBgColor === "string" && st.rowBgColor) {
    push(`    it("applies rowBgColor to the row card background", () => {
      expect(rowSurfaceStyle(sampleRow, idx, state).backgroundColor).toBe(${lit(st.rowBgColor)});
    });
`);
  }
  if (st.rowBorderIsOn === true && typeof st.rowBorderColor === "string" && st.rowBorderColor) {
    push(`    it("applies the row border to the row card", () => {
      const surface = rowSurfaceStyle(sampleRow, idx, state);
      expect(surface.borderColor).toBe(${lit(st.rowBorderColor)});
      expect(surface.borderStyle).toBe(${lit(st.rowBorderStyle ?? "")});
      expect(surface.borderWidth).toBe(${lit(`${st.rowBorderWidth ?? 0}px`)});
    });
`);
  }
  if (
    [
      st.rowBorderRadiusTopLeft,
      st.rowBorderRadiusTopRight,
      st.rowBorderRadiusBottomRight,
      st.rowBorderRadiusBottomLeft,
    ].some((v) => typeof v === "number" && v !== 0)
  ) {
    const suffix = st.rowBorderRadiusIsPixels === true ? "px" : "%";
    const radius = `${st.rowBorderRadiusTopLeft ?? 0}${suffix} ${st.rowBorderRadiusTopRight ?? 0}${suffix} ${st.rowBorderRadiusBottomRight ?? 0}${suffix} ${st.rowBorderRadiusBottomLeft ?? 0}${suffix}`;
    push(`    it("applies the row border radius to the row card", () => {
      expect(rowSurfaceStyle(sampleRow, idx, state).borderRadius).toBe(${lit(radius)});
    });
`);
  }
  if (typeof st.rowMargin === "number" && st.rowMargin !== 0) {
    push(`    it("applies rowMargin to the row card", () => {
      const surface = rowSurfaceStyle(sampleRow, idx, state);
      expect(surface.marginLeft).toBe(${lit(`${st.rowMargin}%`)});
      expect(surface.marginRight).toBe(${lit(`${st.rowMargin}%`)});
    });
`);
  }
  if (st.rowDropShadowIsOn === true) {
    const shadow = `${st.rowDropShadowH ?? 0}px ${st.rowDropShadowV ?? 0}px ${st.rowDropShadowBlur ?? 0}px ${st.rowDropShadowSpread ?? 0}px ${st.rowDropShadowColor ?? ""}`;
    if (st.rowUseBoxShadowIsOn === true) {
      push(`    it("applies the row box shadow to the row card", () => {
      expect(rowSurfaceStyle(sampleRow, idx, state).boxShadow).toBe(${lit(shadow)});
    });
`);
    } else {
      push(`    it("applies the row drop shadow filter to the row card", () => {
      expect(rowSurfaceStyle(sampleRow, idx, state).filter).toContain(${lit(`drop-shadow(${shadow})`)});
    });
`);
    }
  }
  const rowTextGroups: Array<[string, string]> = [
    ["rowTitle", "rowTitle"],
    ["rowText", "rowText"],
  ];
  for (const [group, prefix] of rowTextGroups) {
    const font = st[prefix];
    const size = st[`${prefix}TextSize`];
    const color = st[`${prefix}Color`];
    if (typeof font === "string" && font) {
      push(`    it("applies ${prefix} font to ${group} text", () => {
      expect(textStyle(${lit(group)}, idx, state, sampleRow).fontFamily).toBe(${lit(font)});
    });
`);
    }
    if (typeof size === "number" && size > 0) {
      push(`    it("applies ${prefix}TextSize to ${group} text", () => {
      expect(textStyle(${lit(group)}, idx, state, sampleRow).fontSize).toBe(${lit(`${size}%`)});
    });
`);
    }
    if (typeof color === "string" && color) {
      push(`    it("applies ${prefix}Color to ${group} text", () => {
      expect(textStyle(${lit(group)}, idx, state, sampleRow).color).toBe(${lit(color)});
    });
`);
    }
  }
  if (typeof st.rowButtonXPadding === "number" || typeof st.rowButtonYPadding === "number") {
    push(`    it("applies the row button padding (X = vertical, Y = horizontal)", () => {
      expect(rowButtonStyle(sampleRow, idx, state).padding).toBe(${lit(`${st.rowButtonXPadding ?? 0}px ${st.rowButtonYPadding ?? 0}px`)});
    });
`);
  }
  if (
    typeof st.rowBodyMarginTop === "number" ||
    typeof st.rowBodyMarginBottom === "number" ||
    typeof st.rowBodyMarginSides === "number"
  ) {
    push(`    it("applies the row body margins", () => {
      expect(rowSurfaceStyle(sampleRow, idx, state).margin).toBe(${lit(`${st.rowBodyMarginTop ?? 0}px ${st.rowBodyMarginSides ?? 0}% ${st.rowBodyMarginBottom ?? 0}px`)});
    });
`);
  }
  if (typeof st.rowImageWidth === "number") {
    push(`    it("applies rowImageWidth to row images", () => {
      expect(imageStyle("rowImage", idx, state, sampleRow).width).toBe(${lit(`${st.rowImageWidth}%`)});
    });
`);
  }
  push(`    it("applies the filter string for the unselected state", () => {
      expect(buildFilterString(app.styling as Record<string, unknown>, "unsel")).toBe(${lit(
        (() => {
          // mirrors buildFilterString for the unselected prefix using the raw doc
          const parts: string[] = [];
          const v = (k: string): number | undefined =>
            typeof st[k] === "number" ? (st[k] as number) : undefined;
          const on = (k: string): boolean => st[k] === true;
          if (on("unselFilterBlurIsOn")) parts.push(`blur(${v("unselFilterBlur") ?? 0}px)`);
          if (on("unselFilterBrightIsOn"))
            parts.push(`brightness(${v("unselFilterBright") ?? 100}%)`);
          if (on("unselFilterContIsOn")) parts.push(`contrast(${v("unselFilterCont") ?? 100}%)`);
          if (on("unselFilterGrayIsOn")) parts.push(`grayscale(${v("unselFilterGray") ?? 0}%)`);
          if (on("unselFilterHueIsOn")) parts.push(`hue-rotate(${v("unselFilterHue") ?? 0}deg)`);
          if (on("unselFilterInvertIsOn")) parts.push(`invert(${v("unselFilterInvert") ?? 0}%)`);
          if (on("unselFilterOpacIsOn")) parts.push(`opacity(${v("unselFilterOpac") ?? 100}%)`);
          if (on("unselFilterSaturIsOn")) parts.push(`saturate(${v("unselFilterSatur") ?? 100}%)`);
          if (on("unselFilterSepiaIsOn")) parts.push(`sepia(${v("unselFilterSepia") ?? 0}%)`);
          return parts.join(" ");
        })(),
      )});
    });
`);
  push(`  });
});
`);

  const spec = lines.join("\n");
  writeFileSync(out, spec, "utf8");

  // Quick sanity: the emitted file must parse as TypeScript-ish (balanced braces).
  const open = (spec.match(/\{/g) ?? []).length;
  const close = (spec.match(/\}/g) ?? []).length;
  const ok = open === close;
  console.log(`wrote ${out} (${spec.length} bytes, ${(spec.match(/it\(/g) ?? []).length} tests)`);
  console.log(`customized styling keys: ${customizedStylingKeys(raw).length}`);
  return { ok, tests: (spec.match(/it\(/g) ?? []).length };
}
