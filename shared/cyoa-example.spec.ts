/**
 * GENERATED FILE — do not edit by hand.
 * Source: scripts/generate-example-tests.ts
 * Regenerate with: pnpm script generate-example-tests
 *
 * Import parity suite for the reference ICCPlus document
 * examples/project.json (2.4.7, 27 rows, 150 choices).
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

/** Resolve a generated path like `$.rows.0.buttonText` against a root. */
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
    it("has 77 source keys", () => {
      expect(Object.keys(raw).length).toBe(77);
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
          mutations.push(`[type change] ${path}: ${typeof before} -> ${typeof afterVal}`);
          return;
        }
        if (Array.isArray(before) && Array.isArray(afterVal)) {
          if (before.length !== afterVal.length) return;
          for (let i = 0; i < before.length; i++) diffTree(before[i], afterVal[i], `${path}[${i}]`);
          return;
        }
        if (before && typeof before === "object" && afterVal && typeof afterVal === "object") {
          for (const [k, v] of Object.entries(before as Record<string, unknown>)) {
            if (!(k in (afterVal as Record<string, unknown>))) {
              mutations.push(`[missing key] ${path}.${k}`);
            } else {
              diffTree(v, (afterVal as Record<string, unknown>)[k], `${path}.${k}`);
            }
          }
          return;
        }
        if (before !== afterVal) {
          mutations.push(`[value change] ${path}: ${JSON.stringify(before)} -> ${JSON.stringify(afterVal)}`);
        }
      };
      diffTree(raw, after, "$");
      expect(mutations).toEqual([]);
    });
  });

  /* ------------------------------------------------------------------ */
  /* Entity collections                                                  */
  /* ------------------------------------------------------------------ */

  describe("rows", () => {
    it("has 27 items", () => {
      expect((app.rows).length).toBe(27);
    });

    it("allowedChoices is present on 27/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "allowedChoices" in item,
      );
      expect(withKey.length).toBe(27);
    });

    it("allowedChoices sample values survive normalize", () => {
      expect(valueAt(app.rows, "$.0.allowedChoices")).toEqual(0);
      expect(valueAt(app.rows, "$.11.allowedChoices")).toEqual(2);
      expect(valueAt(app.rows, "$.12.allowedChoices")).toEqual(1);
    });

    it("buttonId is present on 26/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "buttonId" in item,
      );
      expect(withKey.length).toBe(26);
    });

    it("buttonId sample values survive normalize", () => {
      expect(valueAt(app.rows, "$.1.buttonId")).toEqual("");
    });

    it("buttonRandom is present on 26/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "buttonRandom" in item,
      );
      expect(withKey.length).toBe(26);
    });

    it("buttonRandom sample values survive normalize", () => {
      expect(valueAt(app.rows, "$.1.buttonRandom")).toEqual(false);
    });

    it("buttonRandomNumber is present on 26/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "buttonRandomNumber" in item,
      );
      expect(withKey.length).toBe(26);
    });

    it("buttonRandomNumber sample values survive normalize", () => {
      expect(valueAt(app.rows, "$.1.buttonRandomNumber")).toEqual(1);
    });

    it("buttonText is present on 26/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "buttonText" in item,
      );
      expect(withKey.length).toBe(26);
    });

    it("buttonText sample values survive normalize", () => {
      expect(valueAt(app.rows, "$.1.buttonText")).toEqual("Click");
    });

    it("buttonType is present on 26/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "buttonType" in item,
      );
      expect(withKey.length).toBe(26);
    });

    it("buttonType sample values survive normalize", () => {
      expect(valueAt(app.rows, "$.1.buttonType")).toEqual(true);
    });

    it("currentChoices is present on 27/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "currentChoices" in item,
      );
      expect(withKey.length).toBe(27);
    });

    it("currentChoices sample values survive normalize", () => {
      expect(valueAt(app.rows, "$.0.currentChoices")).toEqual(0);
    });

    it("debugTitle is present on 27/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "debugTitle" in item,
      );
      expect(withKey.length).toBe(27);
    });

    it("debugTitle sample values survive normalize", () => {
      expect(valueAt(app.rows, "$.0.debugTitle")).toEqual("");
    });

    it("defaultAspectHeight is present on 27/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "defaultAspectHeight" in item,
      );
      expect(withKey.length).toBe(27);
    });

    it("defaultAspectHeight sample values survive normalize", () => {
      expect(valueAt(app.rows, "$.0.defaultAspectHeight")).toEqual(4);
      expect(valueAt(app.rows, "$.1.defaultAspectHeight")).toEqual(1);
    });

    it("defaultAspectWidth is present on 27/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "defaultAspectWidth" in item,
      );
      expect(withKey.length).toBe(27);
    });

    it("defaultAspectWidth sample values survive normalize", () => {
      expect(valueAt(app.rows, "$.0.defaultAspectWidth")).toEqual(4);
      expect(valueAt(app.rows, "$.1.defaultAspectWidth")).toEqual(1);
    });

    it("id is present on 27/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "id" in item,
      );
      expect(withKey.length).toBe(27);
    });

    it("id sample values survive normalize", () => {
      expect(valueAt(app.rows, "$.0.id")).toEqual("row-x2y3");
      expect(valueAt(app.rows, "$.1.id")).toEqual("row-zhgt");
      expect(valueAt(app.rows, "$.2.id")).toEqual("row-9za9");
      expect(valueAt(app.rows, "$.3.id")).toEqual("row-k0fy");
    });

    it("image is present on 27/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "image" in item,
      );
      expect(withKey.length).toBe(27);
    });

    it("imageSourceTooltip is present on 2/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "imageSourceTooltip" in item,
      );
      expect(withKey.length).toBe(2);
    });

    it("imageSourceTooltip sample values survive normalize", () => {
      expect(valueAt(app.rows, "$.0.imageSourceTooltip")).toEqual("");
      expect(valueAt(app.rows, "$.1.imageSourceTooltip")).toEqual("https://www.pinterest.com/pin/39828777961141932/");
    });

    it("index is present on 27/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "index" in item,
      );
      expect(withKey.length).toBe(27);
    });

    it("index sample values survive normalize", () => {
      expect(valueAt(app.rows, "$.0.index")).toEqual(0);
      expect(valueAt(app.rows, "$.1.index")).toEqual(1);
      expect(valueAt(app.rows, "$.2.index")).toEqual(2);
      expect(valueAt(app.rows, "$.3.index")).toEqual(3);
    });

    it("isButtonRow is present on 27/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "isButtonRow" in item,
      );
      expect(withKey.length).toBe(27);
    });

    it("isButtonRow sample values survive normalize", () => {
      expect(valueAt(app.rows, "$.0.isButtonRow")).toEqual(false);
    });

    it("isEditModeOn is present on 27/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "isEditModeOn" in item,
      );
      expect(withKey.length).toBe(27);
    });

    it("isEditModeOn sample values survive normalize", () => {
      expect(valueAt(app.rows, "$.0.isEditModeOn")).toEqual(false);
    });

    it("isInfoRow is present on 27/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "isInfoRow" in item,
      );
      expect(withKey.length).toBe(27);
    });

    it("isInfoRow sample values survive normalize", () => {
      expect(valueAt(app.rows, "$.0.isInfoRow")).toEqual(false);
    });

    it("isRequirementOpen is present on 27/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "isRequirementOpen" in item,
      );
      expect(withKey.length).toBe(27);
    });

    it("isRequirementOpen sample values survive normalize", () => {
      expect(valueAt(app.rows, "$.0.isRequirementOpen")).toEqual(false);
    });

    it("isResultRow is present on 27/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "isResultRow" in item,
      );
      expect(withKey.length).toBe(27);
    });

    it("isResultRow sample values survive normalize", () => {
      expect(valueAt(app.rows, "$.0.isResultRow")).toEqual(false);
    });

    it("objectWidth is present on 27/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "objectWidth" in item,
      );
      expect(withKey.length).toBe(27);
    });

    it("objectWidth sample values survive normalize", () => {
      expect(valueAt(app.rows, "$.0.objectWidth")).toEqual("");
      expect(valueAt(app.rows, "$.1.objectWidth")).toEqual("col-sm-6");
      expect(valueAt(app.rows, "$.2.objectWidth")).toEqual("col-md-3");
      expect(valueAt(app.rows, "$.3.objectWidth")).toEqual("col-md-4");
    });

    it("objects is present on 27/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "objects" in item,
      );
      expect(withKey.length).toBe(27);
    });

    it("requireds is present on 27/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "requireds" in item,
      );
      expect(withKey.length).toBe(27);
    });

    it("resultGroupId is present on 27/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "resultGroupId" in item,
      );
      expect(withKey.length).toBe(27);
    });

    it("resultGroupId sample values survive normalize", () => {
      expect(valueAt(app.rows, "$.0.resultGroupId")).toEqual("");
      expect(valueAt(app.rows, "$.3.resultGroupId")).toEqual("W1");
    });

    it("rowDesignGroups is present on 27/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "rowDesignGroups" in item,
      );
      expect(withKey.length).toBe(27);
    });

    it("rowDesignGroups sample values survive normalize", () => {
      expect(valueAt(app.rows, "$.0.rowDesignGroups")).toEqual([]);
    });

    it("rowJustify is present on 18/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "rowJustify" in item,
      );
      expect(withKey.length).toBe(18);
    });

    it("rowJustify sample values survive normalize", () => {
      expect(valueAt(app.rows, "$.0.rowJustify")).toEqual("start");
      expect(valueAt(app.rows, "$.2.rowJustify")).toEqual("center");
    });

    it("template is present on 27/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "template" in item,
      );
      expect(withKey.length).toBe(27);
    });

    it("template sample values survive normalize", () => {
      expect(valueAt(app.rows, "$.0.template")).toEqual(1);
    });

    it("title is present on 27/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "title" in item,
      );
      expect(withKey.length).toBe(27);
    });

    it("title sample values survive normalize", () => {
      expect(valueAt(app.rows, "$.0.title")).toEqual("");
      expect(valueAt(app.rows, "$.1.title")).toEqual("<p>Introduction</p>");
      expect(valueAt(app.rows, "$.2.title")).toEqual("<p>World Section</p>");
      expect(valueAt(app.rows, "$.3.title")).toEqual("<p>World State</p>");
    });

    it("titleText is present on 27/27 items", () => {
      const withKey = (app.rows as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "titleText" in item,
      );
      expect(withKey.length).toBe(27);
    });

  });

  describe("backpack rows", () => {
    it("has 1 items", () => {
      expect((app.backpack).length).toBe(1);
    });

    it("allowedChoices is present on 1/1 items", () => {
      const withKey = (app.backpack as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "allowedChoices" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("allowedChoices sample values survive normalize", () => {
      expect(valueAt(app.backpack, "$.0.allowedChoices")).toEqual(0);
    });

    it("buttonId is present on 1/1 items", () => {
      const withKey = (app.backpack as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "buttonId" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("buttonId sample values survive normalize", () => {
      expect(valueAt(app.backpack, "$.0.buttonId")).toEqual("");
    });

    it("buttonRandom is present on 1/1 items", () => {
      const withKey = (app.backpack as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "buttonRandom" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("buttonRandom sample values survive normalize", () => {
      expect(valueAt(app.backpack, "$.0.buttonRandom")).toEqual(false);
    });

    it("buttonRandomNumber is present on 1/1 items", () => {
      const withKey = (app.backpack as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "buttonRandomNumber" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("buttonRandomNumber sample values survive normalize", () => {
      expect(valueAt(app.backpack, "$.0.buttonRandomNumber")).toEqual(1);
    });

    it("buttonText is present on 1/1 items", () => {
      const withKey = (app.backpack as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "buttonText" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("buttonText sample values survive normalize", () => {
      expect(valueAt(app.backpack, "$.0.buttonText")).toEqual("Click");
    });

    it("buttonType is present on 1/1 items", () => {
      const withKey = (app.backpack as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "buttonType" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("buttonType sample values survive normalize", () => {
      expect(valueAt(app.backpack, "$.0.buttonType")).toEqual(true);
    });

    it("currentChoices is present on 1/1 items", () => {
      const withKey = (app.backpack as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "currentChoices" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("currentChoices sample values survive normalize", () => {
      expect(valueAt(app.backpack, "$.0.currentChoices")).toEqual(0);
    });

    it("debugTitle is present on 1/1 items", () => {
      const withKey = (app.backpack as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "debugTitle" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("debugTitle sample values survive normalize", () => {
      expect(valueAt(app.backpack, "$.0.debugTitle")).toEqual("");
    });

    it("defaultAspectHeight is present on 1/1 items", () => {
      const withKey = (app.backpack as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "defaultAspectHeight" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("defaultAspectHeight sample values survive normalize", () => {
      expect(valueAt(app.backpack, "$.0.defaultAspectHeight")).toEqual(1);
    });

    it("defaultAspectWidth is present on 1/1 items", () => {
      const withKey = (app.backpack as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "defaultAspectWidth" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("defaultAspectWidth sample values survive normalize", () => {
      expect(valueAt(app.backpack, "$.0.defaultAspectWidth")).toEqual(1);
    });

    it("id is present on 1/1 items", () => {
      const withKey = (app.backpack as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "id" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("id sample values survive normalize", () => {
      expect(valueAt(app.backpack, "$.0.id")).toEqual("default_backpack_row");
    });

    it("image is present on 1/1 items", () => {
      const withKey = (app.backpack as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "image" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("index is present on 1/1 items", () => {
      const withKey = (app.backpack as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "index" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("index sample values survive normalize", () => {
      expect(valueAt(app.backpack, "$.0.index")).toEqual(0);
    });

    it("isBackpack is present on 1/1 items", () => {
      const withKey = (app.backpack as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "isBackpack" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("isBackpack sample values survive normalize", () => {
      expect(valueAt(app.backpack, "$.0.isBackpack")).toEqual(true);
    });

    it("isButtonRow is present on 1/1 items", () => {
      const withKey = (app.backpack as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "isButtonRow" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("isButtonRow sample values survive normalize", () => {
      expect(valueAt(app.backpack, "$.0.isButtonRow")).toEqual(false);
    });

    it("isEditModeOn is present on 1/1 items", () => {
      const withKey = (app.backpack as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "isEditModeOn" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("isEditModeOn sample values survive normalize", () => {
      expect(valueAt(app.backpack, "$.0.isEditModeOn")).toEqual(false);
    });

    it("isInfoRow is present on 1/1 items", () => {
      const withKey = (app.backpack as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "isInfoRow" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("isInfoRow sample values survive normalize", () => {
      expect(valueAt(app.backpack, "$.0.isInfoRow")).toEqual(true);
    });

    it("isRequirementOpen is present on 1/1 items", () => {
      const withKey = (app.backpack as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "isRequirementOpen" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("isRequirementOpen sample values survive normalize", () => {
      expect(valueAt(app.backpack, "$.0.isRequirementOpen")).toEqual(false);
    });

    it("isResultRow is present on 1/1 items", () => {
      const withKey = (app.backpack as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "isResultRow" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("isResultRow sample values survive normalize", () => {
      expect(valueAt(app.backpack, "$.0.isResultRow")).toEqual(true);
    });

    it("objectWidth is present on 1/1 items", () => {
      const withKey = (app.backpack as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "objectWidth" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("objectWidth sample values survive normalize", () => {
      expect(valueAt(app.backpack, "$.0.objectWidth")).toEqual("col-md-3");
    });

    it("objects is present on 1/1 items", () => {
      const withKey = (app.backpack as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "objects" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("objects sample values survive normalize", () => {
      expect(valueAt(app.backpack, "$.0.objects")).toEqual([]);
    });

    it("requireds is present on 1/1 items", () => {
      const withKey = (app.backpack as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "requireds" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("requireds sample values survive normalize", () => {
      expect(valueAt(app.backpack, "$.0.requireds")).toEqual([]);
    });

    it("resultGroupId is present on 1/1 items", () => {
      const withKey = (app.backpack as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "resultGroupId" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("resultGroupId sample values survive normalize", () => {
      expect(valueAt(app.backpack, "$.0.resultGroupId")).toEqual("");
    });

    it("rowDesignGroups is present on 1/1 items", () => {
      const withKey = (app.backpack as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "rowDesignGroups" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("rowDesignGroups sample values survive normalize", () => {
      expect(valueAt(app.backpack, "$.0.rowDesignGroups")).toEqual([]);
    });

    it("template is present on 1/1 items", () => {
      const withKey = (app.backpack as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "template" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("template sample values survive normalize", () => {
      expect(valueAt(app.backpack, "$.0.template")).toEqual(1);
    });

    it("title is present on 1/1 items", () => {
      const withKey = (app.backpack as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "title" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("title sample values survive normalize", () => {
      expect(valueAt(app.backpack, "$.0.title")).toEqual("<p>Result</p>");
    });

    it("titleText is present on 1/1 items", () => {
      const withKey = (app.backpack as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "titleText" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("titleText sample values survive normalize", () => {
      expect(valueAt(app.backpack, "$.0.titleText")).toEqual("");
    });

  });

  describe("choices", () => {
    it("has 150 items", () => {
      expect((app.rows.flatMap((r) => r.objects ?? [])).length).toBe(150);
    });

    it("addonJustify is present on 150/150 items", () => {
      const withKey = (app.rows.flatMap((r) => r.objects ?? []) as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "addonJustify" in item,
      );
      expect(withKey.length).toBe(150);
    });

    it("addonJustify sample values survive normalize", () => {
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.0.addonJustify")).toEqual("start");
    });

    it("addons is present on 150/150 items", () => {
      const withKey = (app.rows.flatMap((r) => r.objects ?? []) as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "addons" in item,
      );
      expect(withKey.length).toBe(150);
    });

    it("addons sample values survive normalize", () => {
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.0.addons")).toEqual([]);
    });

    it("debugTitle is present on 150/150 items", () => {
      const withKey = (app.rows.flatMap((r) => r.objects ?? []) as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "debugTitle" in item,
      );
      expect(withKey.length).toBe(150);
    });

    it("debugTitle sample values survive normalize", () => {
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.0.debugTitle")).toEqual("");
    });

    it("groups is present on 150/150 items", () => {
      const withKey = (app.rows.flatMap((r) => r.objects ?? []) as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "groups" in item,
      );
      expect(withKey.length).toBe(150);
    });

    it("groups sample values survive normalize", () => {
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.0.groups")).toEqual([]);
    });

    it("id is present on 150/150 items", () => {
      const withKey = (app.rows.flatMap((r) => r.objects ?? []) as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "id" in item,
      );
      expect(withKey.length).toBe(150);
    });

    it("id sample values survive normalize", () => {
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.0.id")).toEqual("choice-qox1");
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.1.id")).toEqual("choice-kvl2");
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.2.id")).toEqual("choice-ogf5");
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.3.id")).toEqual("choice-vumd");
    });

    it("image is present on 150/150 items", () => {
      const withKey = (app.rows.flatMap((r) => r.objects ?? []) as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "image" in item,
      );
      expect(withKey.length).toBe(150);
    });

    it("imageSourceTooltip is present on 107/150 items", () => {
      const withKey = (app.rows.flatMap((r) => r.objects ?? []) as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "imageSourceTooltip" in item,
      );
      expect(withKey.length).toBe(107);
    });

    it("imageSourceTooltip sample values survive normalize", () => {
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.0.imageSourceTooltip")).toEqual("https://e621.net/posts/5494744?q=friendship_is_magic+twilight_sparkle_%28mlp%29+rainbow_dash_%28mlp%29+applejack_%28mlp%29+rarity_%28mlp%29+pinkie_pie_%28mlp%29+fluttershy_%28mlp%29");
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.10.imageSourceTooltip")).toEqual("https://www.pinterest.com/pin/15340454975683651/");
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.11.imageSourceTooltip")).toEqual("https://www.pinterest.com/pin/AcvM4IeVYsJjzlx5_Db58RRKM_CQB14e-mKrUJtyLBghwS11vAEVaQY/");
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.12.imageSourceTooltip")).toEqual("https://www.pinterest.com/pin/83949980541678763/");
    });

    it("index is present on 150/150 items", () => {
      const withKey = (app.rows.flatMap((r) => r.objects ?? []) as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "index" in item,
      );
      expect(withKey.length).toBe(150);
    });

    it("index sample values survive normalize", () => {
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.0.index")).toEqual(0);
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.2.index")).toEqual(1);
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.5.index")).toEqual(2);
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.6.index")).toEqual(3);
    });

    it("initMultipleTimesMinus is present on 150/150 items", () => {
      const withKey = (app.rows.flatMap((r) => r.objects ?? []) as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "initMultipleTimesMinus" in item,
      );
      expect(withKey.length).toBe(150);
    });

    it("initMultipleTimesMinus sample values survive normalize", () => {
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.0.initMultipleTimesMinus")).toEqual(0);
    });

    it("isActive is present on 150/150 items", () => {
      const withKey = (app.rows.flatMap((r) => r.objects ?? []) as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "isActive" in item,
      );
      expect(withKey.length).toBe(150);
    });

    it("isActive sample values survive normalize", () => {
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.0.isActive")).toEqual(false);
    });

    it("isVisible is present on 150/150 items", () => {
      const withKey = (app.rows.flatMap((r) => r.objects ?? []) as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "isVisible" in item,
      );
      expect(withKey.length).toBe(150);
    });

    it("isVisible sample values survive normalize", () => {
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.0.isVisible")).toEqual(true);
    });

    it("multipleUseVariable is present on 150/150 items", () => {
      const withKey = (app.rows.flatMap((r) => r.objects ?? []) as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "multipleUseVariable" in item,
      );
      expect(withKey.length).toBe(150);
    });

    it("multipleUseVariable sample values survive normalize", () => {
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.0.multipleUseVariable")).toEqual(0);
    });

    it("numMultipleTimesMinus is present on 3/150 items", () => {
      const withKey = (app.rows.flatMap((r) => r.objects ?? []) as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "numMultipleTimesMinus" in item,
      );
      expect(withKey.length).toBe(3);
    });

    it("numMultipleTimesMinus sample values survive normalize", () => {
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.1.numMultipleTimesMinus")).toEqual(0);
    });

    it("objectDesignGroups is present on 150/150 items", () => {
      const withKey = (app.rows.flatMap((r) => r.objects ?? []) as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "objectDesignGroups" in item,
      );
      expect(withKey.length).toBe(150);
    });

    it("objectDesignGroups sample values survive normalize", () => {
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.0.objectDesignGroups")).toEqual([]);
    });

    it("objectWidth is present on 150/150 items", () => {
      const withKey = (app.rows.flatMap((r) => r.objects ?? []) as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "objectWidth" in item,
      );
      expect(withKey.length).toBe(150);
    });

    it("objectWidth sample values survive normalize", () => {
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.0.objectWidth")).toEqual("");
    });

    it("requireds is present on 150/150 items", () => {
      const withKey = (app.rows.flatMap((r) => r.objects ?? []) as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "requireds" in item,
      );
      expect(withKey.length).toBe(150);
    });

    it("requireds sample values survive normalize", () => {
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.0.requireds")).toEqual([]);
    });

    it("scores is present on 150/150 items", () => {
      const withKey = (app.rows.flatMap((r) => r.objects ?? []) as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "scores" in item,
      );
      expect(withKey.length).toBe(150);
    });

    it("scores sample values survive normalize", () => {
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.0.scores")).toEqual([]);
    });

    it("selectedThisManyTimesProp is present on 150/150 items", () => {
      const withKey = (app.rows.flatMap((r) => r.objects ?? []) as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "selectedThisManyTimesProp" in item,
      );
      expect(withKey.length).toBe(150);
    });

    it("selectedThisManyTimesProp sample values survive normalize", () => {
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.0.selectedThisManyTimesProp")).toEqual(0);
    });

    it("template is present on 150/150 items", () => {
      const withKey = (app.rows.flatMap((r) => r.objects ?? []) as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "template" in item,
      );
      expect(withKey.length).toBe(150);
    });

    it("template sample values survive normalize", () => {
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.0.template")).toEqual(1);
    });

    it("text is present on 150/150 items", () => {
      const withKey = (app.rows.flatMap((r) => r.objects ?? []) as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "text" in item,
      );
      expect(withKey.length).toBe(150);
    });

    it("title is present on 150/150 items", () => {
      const withKey = (app.rows.flatMap((r) => r.objects ?? []) as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "title" in item,
      );
      expect(withKey.length).toBe(150);
    });

    it("title sample values survive normalize", () => {
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.0.title")).toEqual("");
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.1.title")).toEqual("<p>World Section</p>");
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.2.title")).toEqual("<p>You</p>");
      expect(valueAt(app.rows.flatMap((r) => r.objects ?? []), "$.3.title")).toEqual("<p>World State</p>");
    });

  });

  describe("addons", () => {
    it("has 0 items", () => {
      expect((app.rows.flatMap((r) => r.objects ?? []).flatMap((o) => o.addons ?? [])).length).toBe(0);
    });

  });

  describe("pointTypes", () => {
    it("has 0 items", () => {
      expect((app.pointTypes).length).toBe(0);
    });

  });

  describe("groups", () => {
    it("has 1 items", () => {
      expect((app.groups).length).toBe(1);
    });

    it("elements is present on 1/1 items", () => {
      const withKey = (app.groups as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "elements" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("elements sample values survive normalize", () => {
      expect(valueAt(app.groups, "$.0.elements")).toEqual([]);
    });

    it("id is present on 1/1 items", () => {
      const withKey = (app.groups as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "id" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("id sample values survive normalize", () => {
      expect(valueAt(app.groups, "$.0.id")).toEqual("W1");
    });

    it("name is present on 1/1 items", () => {
      const withKey = (app.groups as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "name" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("name sample values survive normalize", () => {
      expect(valueAt(app.groups, "$.0.name")).toEqual("World ");
    });

    it("rowElements is present on 1/1 items", () => {
      const withKey = (app.groups as Record<string, unknown>[]).filter(
        (item) => item !== null && typeof item === "object" && "rowElements" in item,
      );
      expect(withKey.length).toBe(1);
    });

    it("rowElements sample values survive normalize", () => {
      expect(valueAt(app.groups, "$.0.rowElements")).toEqual([]);
    });

  });

  describe("globalRequirements", () => {
    it("has 0 items", () => {
      expect((app.globalRequirements ?? []).length).toBe(0);
    });

  });

  describe("variables", () => {
    it("has 0 items", () => {
      expect((app.variables).length).toBe(0);
    });

  });

  describe("words", () => {
    it("has 0 items", () => {
      expect((app.words).length).toBe(0);
    });

  });

  describe("soundEffects", () => {
    it("has 0 items", () => {
      expect((app.soundEffects).length).toBe(0);
    });

  });

  describe("rowDesignGroups", () => {
    it("has 0 items", () => {
      expect((app.rowDesignGroups ?? []).length).toBe(0);
    });

  });

  describe("objectDesignGroups", () => {
    it("has 0 items", () => {
      expect((app.objectDesignGroups).length).toBe(0);
    });

  });


  /* ------------------------------------------------------------------ */
  /* Styling: every source key keeps its value                            */
  /* ------------------------------------------------------------------ */
  describe("styling values", () => {
    it("has 223 source styling keys", () => {
      expect(Object.keys(raw.styling as Record<string, unknown>).length).toBe(223);
    });

    it("styling.addonText keeps its value", () => {
      expect(app.styling!["addonText"]).toEqual("Georgia");
    });

    it("styling.addonTextAlign keeps its value", () => {
      expect(app.styling!["addonTextAlign"]).toEqual("center");
    });

    it("styling.addonTextColor keeps its value", () => {
      expect(app.styling!["addonTextColor"]).toEqual("#000000FF");
    });

    it("styling.addonTextTextSize keeps its value", () => {
      expect(app.styling!["addonTextTextSize"]).toEqual(100);
    });

    it("styling.addonTitle keeps its value", () => {
      expect(app.styling!["addonTitle"]).toEqual("Courier");
    });

    it("styling.addonTitleAlign keeps its value", () => {
      expect(app.styling!["addonTitleAlign"]).toEqual("center");
    });

    it("styling.addonTitleColor keeps its value", () => {
      expect(app.styling!["addonTitleColor"]).toEqual("#000000FF");
    });

    it("styling.addonTitleTextSize keeps its value", () => {
      expect(app.styling!["addonTitleTextSize"]).toEqual(200);
    });

    it("styling.backPackWidth keeps its value", () => {
      expect(app.styling!["backPackWidth"]).toEqual(1200);
    });

    it("styling.backgroundColor keeps its value", () => {
      expect(app.styling!["backgroundColor"]).toEqual("#5E645AFF");
    });

    it("styling.backgroundImage survives normalize", () => {
      expect(app.styling).toHaveProperty("backgroundImage");
    });

    it("styling.barBackgroundColor keeps its value", () => {
      expect(app.styling!["barBackgroundColor"]).toEqual("#9A997BFF");
    });

    it("styling.barIconColor keeps its value", () => {
      expect(app.styling!["barIconColor"]).toEqual("#0000008A");
    });

    it("styling.barMargin keeps its value", () => {
      expect(app.styling!["barMargin"]).toEqual(0);
    });

    it("styling.barPadding keeps its value", () => {
      expect(app.styling!["barPadding"]).toEqual(0);
    });

    it("styling.barPointNeg keeps its value", () => {
      expect(app.styling!["barPointNeg"]).toEqual("#FF0000FF");
    });

    it("styling.barPointPos keeps its value", () => {
      expect(app.styling!["barPointPos"]).toEqual("#FF0000FF");
    });

    it("styling.barTextColor keeps its value", () => {
      expect(app.styling!["barTextColor"]).toEqual("#000000");
    });

    it("styling.barTextFont keeps its value", () => {
      expect(app.styling!["barTextFont"]).toEqual("Courier");
    });

    it("styling.barTextMargin keeps its value", () => {
      expect(app.styling!["barTextMargin"]).toEqual(0);
    });

    it("styling.barTextPadding keeps its value", () => {
      expect(app.styling!["barTextPadding"]).toEqual(13);
    });

    it("styling.barTextSize keeps its value", () => {
      expect(app.styling!["barTextSize"]).toEqual(21);
    });

    it("styling.customMultiTextFont keeps its value", () => {
      expect(app.styling!["customMultiTextFont"]).toEqual(false);
    });

    it("styling.multiChoiceCounterPosition keeps its value", () => {
      expect(app.styling!["multiChoiceCounterPosition"]).toEqual(0);
    });

    it("styling.multiChoiceCounterSize keeps its value", () => {
      expect(app.styling!["multiChoiceCounterSize"]).toEqual(170);
    });

    it("styling.multiChoiceTextFont keeps its value", () => {
      expect(app.styling!["multiChoiceTextFont"]).toEqual("Candara");
    });

    it("styling.multiChoiceTextSize keeps its value", () => {
      expect(app.styling!["multiChoiceTextSize"]).toEqual(200);
    });

    it("styling.objectBackgroundImage survives normalize", () => {
      expect(app.styling).toHaveProperty("objectBackgroundImage");
    });

    it("styling.objectBgColor keeps its value", () => {
      expect(app.styling!["objectBgColor"]).toEqual("#9A997BFF");
    });

    it("styling.objectBgColorIsOn keeps its value", () => {
      expect(app.styling!["objectBgColorIsOn"]).toEqual(true);
    });

    it("styling.objectBorderColor keeps its value", () => {
      expect(app.styling!["objectBorderColor"]).toEqual("#D64800FF");
    });

    it("styling.objectBorderImage survives normalize", () => {
      expect(app.styling).toHaveProperty("objectBorderImage");
    });

    it("styling.objectBorderImageRepeat keeps its value", () => {
      expect(app.styling!["objectBorderImageRepeat"]).toEqual("stretch");
    });

    it("styling.objectBorderImageSliceBottom keeps its value", () => {
      expect(app.styling!["objectBorderImageSliceBottom"]).toEqual(5);
    });

    it("styling.objectBorderImageSliceLeft keeps its value", () => {
      expect(app.styling!["objectBorderImageSliceLeft"]).toEqual(5);
    });

    it("styling.objectBorderImageSliceRight keeps its value", () => {
      expect(app.styling!["objectBorderImageSliceRight"]).toEqual(5);
    });

    it("styling.objectBorderImageSliceTop keeps its value", () => {
      expect(app.styling!["objectBorderImageSliceTop"]).toEqual(5);
    });

    it("styling.objectBorderImageWidth keeps its value", () => {
      expect(app.styling!["objectBorderImageWidth"]).toEqual(5);
    });

    it("styling.objectBorderIsOn keeps its value", () => {
      expect(app.styling!["objectBorderIsOn"]).toEqual(true);
    });

    it("styling.objectBorderRadiusBottomLeft keeps its value", () => {
      expect(app.styling!["objectBorderRadiusBottomLeft"]).toEqual(10);
    });

    it("styling.objectBorderRadiusBottomRight keeps its value", () => {
      expect(app.styling!["objectBorderRadiusBottomRight"]).toEqual(10);
    });

    it("styling.objectBorderRadiusIsPixels keeps its value", () => {
      expect(app.styling!["objectBorderRadiusIsPixels"]).toEqual(true);
    });

    it("styling.objectBorderRadiusTopLeft keeps its value", () => {
      expect(app.styling!["objectBorderRadiusTopLeft"]).toEqual(40);
    });

    it("styling.objectBorderRadiusTopRight keeps its value", () => {
      expect(app.styling!["objectBorderRadiusTopRight"]).toEqual(40);
    });

    it("styling.objectBorderStyle keeps its value", () => {
      expect(app.styling!["objectBorderStyle"]).toEqual("double");
    });

    it("styling.objectBorderWidth keeps its value", () => {
      expect(app.styling!["objectBorderWidth"]).toEqual(2);
    });

    it("styling.objectDesignIsAdvanced keeps its value", () => {
      expect(app.styling!["objectDesignIsAdvanced"]).toEqual(true);
    });

    it("styling.objectDropShadowBlur keeps its value", () => {
      expect(app.styling!["objectDropShadowBlur"]).toEqual(3);
    });

    it("styling.objectDropShadowColor keeps its value", () => {
      expect(app.styling!["objectDropShadowColor"]).toEqual("#D64800FF");
    });

    it("styling.objectDropShadowH keeps its value", () => {
      expect(app.styling!["objectDropShadowH"]).toEqual(3);
    });

    it("styling.objectDropShadowIsOn keeps its value", () => {
      expect(app.styling!["objectDropShadowIsOn"]).toEqual(true);
    });

    it("styling.objectDropShadowSpread keeps its value", () => {
      expect(app.styling!["objectDropShadowSpread"]).toEqual(0);
    });

    it("styling.objectDropShadowV keeps its value", () => {
      expect(app.styling!["objectDropShadowV"]).toEqual(3);
    });

    it("styling.objectHeight keeps its value", () => {
      expect(app.styling!["objectHeight"]).toEqual(true);
    });

    it("styling.objectImageBoxWidth keeps its value", () => {
      expect(app.styling!["objectImageBoxWidth"]).toEqual(50);
    });

    it("styling.objectImageMarginBottom keeps its value", () => {
      expect(app.styling!["objectImageMarginBottom"]).toEqual(3);
    });

    it("styling.objectImageMarginTop keeps its value", () => {
      expect(app.styling!["objectImageMarginTop"]).toEqual(4);
    });

    it("styling.objectImageWidth keeps its value", () => {
      expect(app.styling!["objectImageWidth"]).toEqual(91);
    });

    it("styling.objectImgBorderColor keeps its value", () => {
      expect(app.styling!["objectImgBorderColor"]).toEqual("#D64800FF");
    });

    it("styling.objectImgBorderIsOn keeps its value", () => {
      expect(app.styling!["objectImgBorderIsOn"]).toEqual(true);
    });

    it("styling.objectImgBorderRadiusBottomLeft keeps its value", () => {
      expect(app.styling!["objectImgBorderRadiusBottomLeft"]).toEqual(10);
    });

    it("styling.objectImgBorderRadiusBottomRight keeps its value", () => {
      expect(app.styling!["objectImgBorderRadiusBottomRight"]).toEqual(10);
    });

    it("styling.objectImgBorderRadiusIsPixels keeps its value", () => {
      expect(app.styling!["objectImgBorderRadiusIsPixels"]).toEqual(false);
    });

    it("styling.objectImgBorderRadiusTopLeft keeps its value", () => {
      expect(app.styling!["objectImgBorderRadiusTopLeft"]).toEqual(10);
    });

    it("styling.objectImgBorderRadiusTopRight keeps its value", () => {
      expect(app.styling!["objectImgBorderRadiusTopRight"]).toEqual(10);
    });

    it("styling.objectImgBorderStyle keeps its value", () => {
      expect(app.styling!["objectImgBorderStyle"]).toEqual("double");
    });

    it("styling.objectImgBorderWidth keeps its value", () => {
      expect(app.styling!["objectImgBorderWidth"]).toEqual(4);
    });

    it("styling.objectImgObjectFillIsOn keeps its value", () => {
      expect(app.styling!["objectImgObjectFillIsOn"]).toEqual(false);
    });

    it("styling.objectImgObjectFillStyle keeps its value", () => {
      expect(app.styling!["objectImgObjectFillStyle"]).toEqual("contain");
    });

    it("styling.objectImgOverflowIsOn keeps its value", () => {
      expect(app.styling!["objectImgOverflowIsOn"]).toEqual(true);
    });

    it("styling.objectMargin keeps its value", () => {
      expect(app.styling!["objectMargin"]).toEqual(10);
    });

    it("styling.objectOverflowIsOn keeps its value", () => {
      expect(app.styling!["objectOverflowIsOn"]).toEqual(true);
    });

    it("styling.objectText keeps its value", () => {
      expect(app.styling!["objectText"]).toEqual("Georgia");
    });

    it("styling.objectTextAlign keeps its value", () => {
      expect(app.styling!["objectTextAlign"]).toEqual("center");
    });

    it("styling.objectTextColor keeps its value", () => {
      expect(app.styling!["objectTextColor"]).toEqual("#000000FF");
    });

    it("styling.objectTextPadding keeps its value", () => {
      expect(app.styling!["objectTextPadding"]).toEqual(10);
    });

    it("styling.objectTextTextSize keeps its value", () => {
      expect(app.styling!["objectTextTextSize"]).toEqual(100);
    });

    it("styling.objectTitle keeps its value", () => {
      expect(app.styling!["objectTitle"]).toEqual("Courier");
    });

    it("styling.objectTitleAlign keeps its value", () => {
      expect(app.styling!["objectTitleAlign"]).toEqual("center");
    });

    it("styling.objectTitleColor keeps its value", () => {
      expect(app.styling!["objectTitleColor"]).toEqual("#000000FF");
    });

    it("styling.objectTitleTextSize keeps its value", () => {
      expect(app.styling!["objectTitleTextSize"]).toEqual(200);
    });

    it("styling.reqATextColorIsOn keeps its value", () => {
      expect(app.styling!["reqATextColorIsOn"]).toEqual(false);
    });

    it("styling.reqATitleColorIsOn keeps its value", () => {
      expect(app.styling!["reqATitleColorIsOn"]).toEqual(false);
    });

    it("styling.reqBgColorIsOn keeps its value", () => {
      expect(app.styling!["reqBgColorIsOn"]).toEqual(false);
    });

    it("styling.reqBorderColorIsOn keeps its value", () => {
      expect(app.styling!["reqBorderColorIsOn"]).toEqual(false);
    });

    it("styling.reqCTextColorIsOn keeps its value", () => {
      expect(app.styling!["reqCTextColorIsOn"]).toEqual(false);
    });

    it("styling.reqCTitleColorIsOn keeps its value", () => {
      expect(app.styling!["reqCTitleColorIsOn"]).toEqual(false);
    });

    it("styling.reqFilterATextColor keeps its value", () => {
      expect(app.styling!["reqFilterATextColor"]).toEqual("#000000FF");
    });

    it("styling.reqFilterATitleColor keeps its value", () => {
      expect(app.styling!["reqFilterATitleColor"]).toEqual("#000000FF");
    });

    it("styling.reqFilterBgColor keeps its value", () => {
      expect(app.styling!["reqFilterBgColor"]).toEqual("#FFFFFFFF");
    });

    it("styling.reqFilterBlur keeps its value", () => {
      expect(app.styling!["reqFilterBlur"]).toEqual(0);
    });

    it("styling.reqFilterBlurIsOn keeps its value", () => {
      expect(app.styling!["reqFilterBlurIsOn"]).toEqual(false);
    });

    it("styling.reqFilterBorderColor keeps its value", () => {
      expect(app.styling!["reqFilterBorderColor"]).toEqual("#000000FF");
    });

    it("styling.reqFilterBright keeps its value", () => {
      expect(app.styling!["reqFilterBright"]).toEqual(100);
    });

    it("styling.reqFilterBrightIsOn keeps its value", () => {
      expect(app.styling!["reqFilterBrightIsOn"]).toEqual(false);
    });

    it("styling.reqFilterCTextColor keeps its value", () => {
      expect(app.styling!["reqFilterCTextColor"]).toEqual("#000000FF");
    });

    it("styling.reqFilterCTitleColor keeps its value", () => {
      expect(app.styling!["reqFilterCTitleColor"]).toEqual("#000000FF");
    });

    it("styling.reqFilterCont keeps its value", () => {
      expect(app.styling!["reqFilterCont"]).toEqual(100);
    });

    it("styling.reqFilterContIsOn keeps its value", () => {
      expect(app.styling!["reqFilterContIsOn"]).toEqual(false);
    });

    it("styling.reqFilterGray keeps its value", () => {
      expect(app.styling!["reqFilterGray"]).toEqual(0);
    });

    it("styling.reqFilterGrayIsOn keeps its value", () => {
      expect(app.styling!["reqFilterGrayIsOn"]).toEqual(false);
    });

    it("styling.reqFilterHue keeps its value", () => {
      expect(app.styling!["reqFilterHue"]).toEqual(0);
    });

    it("styling.reqFilterHueIsOn keeps its value", () => {
      expect(app.styling!["reqFilterHueIsOn"]).toEqual(false);
    });

    it("styling.reqFilterInvert keeps its value", () => {
      expect(app.styling!["reqFilterInvert"]).toEqual(0);
    });

    it("styling.reqFilterInvertIsOn keeps its value", () => {
      expect(app.styling!["reqFilterInvertIsOn"]).toEqual(false);
    });

    it("styling.reqFilterOpac keeps its value", () => {
      expect(app.styling!["reqFilterOpac"]).toEqual(50);
    });

    it("styling.reqFilterOpacIsOn keeps its value", () => {
      expect(app.styling!["reqFilterOpacIsOn"]).toEqual(true);
    });

    it("styling.reqFilterSatur keeps its value", () => {
      expect(app.styling!["reqFilterSatur"]).toEqual(1);
    });

    it("styling.reqFilterSaturIsOn keeps its value", () => {
      expect(app.styling!["reqFilterSaturIsOn"]).toEqual(false);
    });

    it("styling.reqFilterSepia keeps its value", () => {
      expect(app.styling!["reqFilterSepia"]).toEqual(0);
    });

    it("styling.reqFilterSepiaIsOn keeps its value", () => {
      expect(app.styling!["reqFilterSepiaIsOn"]).toEqual(false);
    });

    it("styling.reqFilterVisibleIsOn keeps its value", () => {
      expect(app.styling!["reqFilterVisibleIsOn"]).toEqual(false);
    });

    it("styling.reqOverlayOnImage keeps its value", () => {
      expect(app.styling!["reqOverlayOnImage"]).toEqual(false);
    });

    it("styling.rowBackgroundImage survives normalize", () => {
      expect(app.styling).toHaveProperty("rowBackgroundImage");
    });

    it("styling.rowBgColor keeps its value", () => {
      expect(app.styling!["rowBgColor"]).toEqual("#9A997BFF");
    });

    it("styling.rowBgColorIsOn keeps its value", () => {
      expect(app.styling!["rowBgColorIsOn"]).toEqual(true);
    });

    it("styling.rowBodyMarginBottom keeps its value", () => {
      expect(app.styling!["rowBodyMarginBottom"]).toEqual(25);
    });

    it("styling.rowBodyMarginSides keeps its value", () => {
      expect(app.styling!["rowBodyMarginSides"]).toEqual(1);
    });

    it("styling.rowBodyMarginTop keeps its value", () => {
      expect(app.styling!["rowBodyMarginTop"]).toEqual(25);
    });

    it("styling.rowBorderColor keeps its value", () => {
      expect(app.styling!["rowBorderColor"]).toEqual("#D64800FF");
    });

    it("styling.rowBorderImage survives normalize", () => {
      expect(app.styling).toHaveProperty("rowBorderImage");
    });

    it("styling.rowBorderImageRepeat keeps its value", () => {
      expect(app.styling!["rowBorderImageRepeat"]).toEqual("stretch");
    });

    it("styling.rowBorderImageSliceBottom keeps its value", () => {
      expect(app.styling!["rowBorderImageSliceBottom"]).toEqual(5);
    });

    it("styling.rowBorderImageSliceLeft keeps its value", () => {
      expect(app.styling!["rowBorderImageSliceLeft"]).toEqual(5);
    });

    it("styling.rowBorderImageSliceRight keeps its value", () => {
      expect(app.styling!["rowBorderImageSliceRight"]).toEqual(5);
    });

    it("styling.rowBorderImageSliceTop keeps its value", () => {
      expect(app.styling!["rowBorderImageSliceTop"]).toEqual(5);
    });

    it("styling.rowBorderImageWidth keeps its value", () => {
      expect(app.styling!["rowBorderImageWidth"]).toEqual(5);
    });

    it("styling.rowBorderIsOn keeps its value", () => {
      expect(app.styling!["rowBorderIsOn"]).toEqual(true);
    });

    it("styling.rowBorderRadiusBottomLeft keeps its value", () => {
      expect(app.styling!["rowBorderRadiusBottomLeft"]).toEqual(20);
    });

    it("styling.rowBorderRadiusBottomRight keeps its value", () => {
      expect(app.styling!["rowBorderRadiusBottomRight"]).toEqual(20);
    });

    it("styling.rowBorderRadiusIsPixels keeps its value", () => {
      expect(app.styling!["rowBorderRadiusIsPixels"]).toEqual(true);
    });

    it("styling.rowBorderRadiusTopLeft keeps its value", () => {
      expect(app.styling!["rowBorderRadiusTopLeft"]).toEqual(60);
    });

    it("styling.rowBorderRadiusTopRight keeps its value", () => {
      expect(app.styling!["rowBorderRadiusTopRight"]).toEqual(60);
    });

    it("styling.rowBorderStyle keeps its value", () => {
      expect(app.styling!["rowBorderStyle"]).toEqual("double");
    });

    it("styling.rowBorderWidth keeps its value", () => {
      expect(app.styling!["rowBorderWidth"]).toEqual(4);
    });

    it("styling.rowButtonXPadding keeps its value", () => {
      expect(app.styling!["rowButtonXPadding"]).toEqual(0);
    });

    it("styling.rowButtonYPadding keeps its value", () => {
      expect(app.styling!["rowButtonYPadding"]).toEqual(0);
    });

    it("styling.rowDesignIsAdvanced keeps its value", () => {
      expect(app.styling!["rowDesignIsAdvanced"]).toEqual(true);
    });

    it("styling.rowDropShadowBlur keeps its value", () => {
      expect(app.styling!["rowDropShadowBlur"]).toEqual(3);
    });

    it("styling.rowDropShadowColor keeps its value", () => {
      expect(app.styling!["rowDropShadowColor"]).toEqual("#D64800FF");
    });

    it("styling.rowDropShadowH keeps its value", () => {
      expect(app.styling!["rowDropShadowH"]).toEqual(3);
    });

    it("styling.rowDropShadowIsOn keeps its value", () => {
      expect(app.styling!["rowDropShadowIsOn"]).toEqual(true);
    });

    it("styling.rowDropShadowSpread keeps its value", () => {
      expect(app.styling!["rowDropShadowSpread"]).toEqual(0);
    });

    it("styling.rowDropShadowV keeps its value", () => {
      expect(app.styling!["rowDropShadowV"]).toEqual(3);
    });

    it("styling.rowImageBoxWidth keeps its value", () => {
      expect(app.styling!["rowImageBoxWidth"]).toEqual(50);
    });

    it("styling.rowImageMarginBottom keeps its value", () => {
      expect(app.styling!["rowImageMarginBottom"]).toEqual(0);
    });

    it("styling.rowImageMarginTop keeps its value", () => {
      expect(app.styling!["rowImageMarginTop"]).toEqual(0);
    });

    it("styling.rowImageWidth keeps its value", () => {
      expect(app.styling!["rowImageWidth"]).toEqual(100);
    });

    it("styling.rowImgBorderColor keeps its value", () => {
      expect(app.styling!["rowImgBorderColor"]).toEqual("#FFEEDDFF");
    });

    it("styling.rowImgBorderIsOn keeps its value", () => {
      expect(app.styling!["rowImgBorderIsOn"]).toEqual(false);
    });

    it("styling.rowImgBorderRadiusBottomLeft keeps its value", () => {
      expect(app.styling!["rowImgBorderRadiusBottomLeft"]).toEqual(0);
    });

    it("styling.rowImgBorderRadiusBottomRight keeps its value", () => {
      expect(app.styling!["rowImgBorderRadiusBottomRight"]).toEqual(0);
    });

    it("styling.rowImgBorderRadiusIsPixels keeps its value", () => {
      expect(app.styling!["rowImgBorderRadiusIsPixels"]).toEqual(true);
    });

    it("styling.rowImgBorderRadiusTopLeft keeps its value", () => {
      expect(app.styling!["rowImgBorderRadiusTopLeft"]).toEqual(0);
    });

    it("styling.rowImgBorderRadiusTopRight keeps its value", () => {
      expect(app.styling!["rowImgBorderRadiusTopRight"]).toEqual(0);
    });

    it("styling.rowImgBorderStyle keeps its value", () => {
      expect(app.styling!["rowImgBorderStyle"]).toEqual("solid");
    });

    it("styling.rowImgBorderWidth keeps its value", () => {
      expect(app.styling!["rowImgBorderWidth"]).toEqual(2);
    });

    it("styling.rowImgOverflowIsOn keeps its value", () => {
      expect(app.styling!["rowImgOverflowIsOn"]).toEqual(true);
    });

    it("styling.rowMargin keeps its value", () => {
      expect(app.styling!["rowMargin"]).toEqual(10);
    });

    it("styling.rowOverflowIsOn keeps its value", () => {
      expect(app.styling!["rowOverflowIsOn"]).toEqual(true);
    });

    it("styling.rowText keeps its value", () => {
      expect(app.styling!["rowText"]).toEqual("Georgia");
    });

    it("styling.rowTextAlign keeps its value", () => {
      expect(app.styling!["rowTextAlign"]).toEqual("center");
    });

    it("styling.rowTextColor keeps its value", () => {
      expect(app.styling!["rowTextColor"]).toEqual("#000000FF");
    });

    it("styling.rowTextPaddingX keeps its value", () => {
      expect(app.styling!["rowTextPaddingX"]).toEqual(10);
    });

    it("styling.rowTextPaddingY keeps its value", () => {
      expect(app.styling!["rowTextPaddingY"]).toEqual(5);
    });

    it("styling.rowTextTextSize keeps its value", () => {
      expect(app.styling!["rowTextTextSize"]).toEqual(100);
    });

    it("styling.rowTitle keeps its value", () => {
      expect(app.styling!["rowTitle"]).toEqual("Courier");
    });

    it("styling.rowTitleAlign keeps its value", () => {
      expect(app.styling!["rowTitleAlign"]).toEqual("center");
    });

    it("styling.rowTitleColor keeps its value", () => {
      expect(app.styling!["rowTitleColor"]).toEqual("#000000FF");
    });

    it("styling.rowTitleTextSize keeps its value", () => {
      expect(app.styling!["rowTitleTextSize"]).toEqual(200);
    });

    it("styling.scoreText keeps its value", () => {
      expect(app.styling!["scoreText"]).toEqual("Courier New");
    });

    it("styling.scoreTextAlign keeps its value", () => {
      expect(app.styling!["scoreTextAlign"]).toEqual("center");
    });

    it("styling.scoreTextColor keeps its value", () => {
      expect(app.styling!["scoreTextColor"]).toEqual("#000000FF");
    });

    it("styling.scoreTextSize keeps its value", () => {
      expect(app.styling!["scoreTextSize"]).toEqual(75);
    });

    it("styling.selATextColorIsOn keeps its value", () => {
      expect(app.styling!["selATextColorIsOn"]).toEqual(false);
    });

    it("styling.selATitleColorIsOn keeps its value", () => {
      expect(app.styling!["selATitleColorIsOn"]).toEqual(false);
    });

    it("styling.selBgColorIsOn keeps its value", () => {
      expect(app.styling!["selBgColorIsOn"]).toEqual(true);
    });

    it("styling.selBorderColorIsOn keeps its value", () => {
      expect(app.styling!["selBorderColorIsOn"]).toEqual(false);
    });

    it("styling.selCTextColorIsOn keeps its value", () => {
      expect(app.styling!["selCTextColorIsOn"]).toEqual(false);
    });

    it("styling.selCTitleColorIsOn keeps its value", () => {
      expect(app.styling!["selCTitleColorIsOn"]).toEqual(false);
    });

    it("styling.selFilterATextColor keeps its value", () => {
      expect(app.styling!["selFilterATextColor"]).toEqual("#000000FF");
    });

    it("styling.selFilterATitleColor keeps its value", () => {
      expect(app.styling!["selFilterATitleColor"]).toEqual("#000000FF");
    });

    it("styling.selFilterBgColor keeps its value", () => {
      expect(app.styling!["selFilterBgColor"]).toEqual("#70FF7EFF");
    });

    it("styling.selFilterBlur keeps its value", () => {
      expect(app.styling!["selFilterBlur"]).toEqual(0);
    });

    it("styling.selFilterBlurIsOn keeps its value", () => {
      expect(app.styling!["selFilterBlurIsOn"]).toEqual(false);
    });

    it("styling.selFilterBorderColor keeps its value", () => {
      expect(app.styling!["selFilterBorderColor"]).toEqual("#000000FF");
    });

    it("styling.selFilterBright keeps its value", () => {
      expect(app.styling!["selFilterBright"]).toEqual(100);
    });

    it("styling.selFilterBrightIsOn keeps its value", () => {
      expect(app.styling!["selFilterBrightIsOn"]).toEqual(false);
    });

    it("styling.selFilterCTextColor keeps its value", () => {
      expect(app.styling!["selFilterCTextColor"]).toEqual("#000000FF");
    });

    it("styling.selFilterCTitleColor keeps its value", () => {
      expect(app.styling!["selFilterCTitleColor"]).toEqual("#000000FF");
    });

    it("styling.selFilterCont keeps its value", () => {
      expect(app.styling!["selFilterCont"]).toEqual(100);
    });

    it("styling.selFilterContIsOn keeps its value", () => {
      expect(app.styling!["selFilterContIsOn"]).toEqual(false);
    });

    it("styling.selFilterGray keeps its value", () => {
      expect(app.styling!["selFilterGray"]).toEqual(0);
    });

    it("styling.selFilterGrayIsOn keeps its value", () => {
      expect(app.styling!["selFilterGrayIsOn"]).toEqual(false);
    });

    it("styling.selFilterHue keeps its value", () => {
      expect(app.styling!["selFilterHue"]).toEqual(0);
    });

    it("styling.selFilterHueIsOn keeps its value", () => {
      expect(app.styling!["selFilterHueIsOn"]).toEqual(false);
    });

    it("styling.selFilterInvert keeps its value", () => {
      expect(app.styling!["selFilterInvert"]).toEqual(0);
    });

    it("styling.selFilterInvertIsOn keeps its value", () => {
      expect(app.styling!["selFilterInvertIsOn"]).toEqual(false);
    });

    it("styling.selFilterOpac keeps its value", () => {
      expect(app.styling!["selFilterOpac"]).toEqual(100);
    });

    it("styling.selFilterOpacIsOn keeps its value", () => {
      expect(app.styling!["selFilterOpacIsOn"]).toEqual(false);
    });

    it("styling.selFilterSatur keeps its value", () => {
      expect(app.styling!["selFilterSatur"]).toEqual(1);
    });

    it("styling.selFilterSaturIsOn keeps its value", () => {
      expect(app.styling!["selFilterSaturIsOn"]).toEqual(false);
    });

    it("styling.selFilterSepia keeps its value", () => {
      expect(app.styling!["selFilterSepia"]).toEqual(0);
    });

    it("styling.selFilterSepiaIsOn keeps its value", () => {
      expect(app.styling!["selFilterSepiaIsOn"]).toEqual(false);
    });

    it("styling.selOverlayOnImage keeps its value", () => {
      expect(app.styling!["selOverlayOnImage"]).toEqual(false);
    });

    it("styling.unselFilterBlur keeps its value", () => {
      expect(app.styling!["unselFilterBlur"]).toEqual(0);
    });

    it("styling.unselFilterBlurIsOn keeps its value", () => {
      expect(app.styling!["unselFilterBlurIsOn"]).toEqual(false);
    });

    it("styling.unselFilterBright keeps its value", () => {
      expect(app.styling!["unselFilterBright"]).toEqual(100);
    });

    it("styling.unselFilterBrightIsOn keeps its value", () => {
      expect(app.styling!["unselFilterBrightIsOn"]).toEqual(false);
    });

    it("styling.unselFilterCont keeps its value", () => {
      expect(app.styling!["unselFilterCont"]).toEqual(100);
    });

    it("styling.unselFilterContIsOn keeps its value", () => {
      expect(app.styling!["unselFilterContIsOn"]).toEqual(false);
    });

    it("styling.unselFilterGray keeps its value", () => {
      expect(app.styling!["unselFilterGray"]).toEqual(0);
    });

    it("styling.unselFilterGrayIsOn keeps its value", () => {
      expect(app.styling!["unselFilterGrayIsOn"]).toEqual(false);
    });

    it("styling.unselFilterHue keeps its value", () => {
      expect(app.styling!["unselFilterHue"]).toEqual(0);
    });

    it("styling.unselFilterHueIsOn keeps its value", () => {
      expect(app.styling!["unselFilterHueIsOn"]).toEqual(false);
    });

    it("styling.unselFilterInvert keeps its value", () => {
      expect(app.styling!["unselFilterInvert"]).toEqual(0);
    });

    it("styling.unselFilterInvertIsOn keeps its value", () => {
      expect(app.styling!["unselFilterInvertIsOn"]).toEqual(false);
    });

    it("styling.unselFilterOpac keeps its value", () => {
      expect(app.styling!["unselFilterOpac"]).toEqual(100);
    });

    it("styling.unselFilterOpacIsOn keeps its value", () => {
      expect(app.styling!["unselFilterOpacIsOn"]).toEqual(false);
    });

    it("styling.unselFilterSatur keeps its value", () => {
      expect(app.styling!["unselFilterSatur"]).toEqual(0);
    });

    it("styling.unselFilterSaturIsOn keeps its value", () => {
      expect(app.styling!["unselFilterSaturIsOn"]).toEqual(false);
    });

    it("styling.unselFilterSepia keeps its value", () => {
      expect(app.styling!["unselFilterSepia"]).toEqual(0);
    });

    it("styling.unselFilterSepiaIsOn keeps its value", () => {
      expect(app.styling!["unselFilterSepiaIsOn"]).toEqual(false);
    });

  });

  /* ------------------------------------------------------------------ */
  /* Styling cascade: the document's styling is applied, not dropped      */
  /* ------------------------------------------------------------------ */
  describe("styling cascade applies the document", () => {

    it("applies objectBgColor to the choice card background", () => {
      expect(choiceSurfaceStyle(sampleChoice, sampleRow, idx, state).backgroundColor).toBe("#9A997BFF");
    });

    it("applies the object border to the choice card", () => {
      const surface = choiceSurfaceStyle(sampleChoice, sampleRow, idx, state);
      expect(surface.borderColor).toBe("#D64800FF");
      expect(surface.borderStyle).toBe("double");
      expect(surface.borderWidth).toBe("2px");
    });

    it("applies the object border radius to the choice card", () => {
      expect(choiceSurfaceStyle(sampleChoice, sampleRow, idx, state).borderRadius).toBe("40px 40px 10px 10px");
    });

    it("applies objectMargin to the choice card", () => {
      expect(choiceSurfaceStyle(sampleChoice, sampleRow, idx, state).margin).toBe("10px");
    });

    it("applies the object drop shadow filter to the choice card", () => {
      const filter = choiceSurfaceStyle(sampleChoice, sampleRow, idx, state).filter;
      expect(filter).toContain("drop-shadow(3px 3px 3px 0px #D64800FF)");
    });

    it("applies objectImageWidth to choice images", () => {
      expect(imageStyle("objectImage", idx, state, sampleRow, sampleChoice).width).toBe("91%");
    });

    it("applies objectTitle font to objectTitle text", () => {
      expect(textStyle("objectTitle", idx, state, sampleRow, sampleChoice).fontFamily).toBe("Courier");
    });

    it("applies objectTitleTextSize to objectTitle text", () => {
      expect(textStyle("objectTitle", idx, state, sampleRow, sampleChoice).fontSize).toBe("200%");
    });

    it("applies objectTitleColor to objectTitle text", () => {
      expect(textStyle("objectTitle", idx, state, sampleRow, sampleChoice).color).toBe("#000000FF");
    });

    it("applies objectText font to objectText text", () => {
      expect(textStyle("objectText", idx, state, sampleRow, sampleChoice).fontFamily).toBe("Georgia");
    });

    it("applies objectTextTextSize to objectText text", () => {
      expect(textStyle("objectText", idx, state, sampleRow, sampleChoice).fontSize).toBe("100%");
    });

    it("applies objectTextColor to objectText text", () => {
      expect(textStyle("objectText", idx, state, sampleRow, sampleChoice).color).toBe("#000000FF");
    });

    it("applies scoreText font to scoreText text", () => {
      expect(textStyle("scoreText", idx, state, sampleRow, sampleChoice).fontFamily).toBe("Courier New");
    });

    it("applies scoreTextColor to scoreText text", () => {
      expect(textStyle("scoreText", idx, state, sampleRow, sampleChoice).color).toBe("#000000FF");
    });

    it("applies addonTitle font to addon titles", () => {
      expect(textStyle("addonTitle", idx, state, sampleRow, sampleChoice).fontFamily).toBe("Courier");
    });

    it("applies addonText font to addon text", () => {
      expect(textStyle("addonText", idx, state, sampleRow, sampleChoice).fontFamily).toBe("Georgia");
    });

    it("applies rowBgColor to the row card background", () => {
      expect(rowSurfaceStyle(sampleRow, idx, state).backgroundColor).toBe("#9A997BFF");
    });

    it("applies the row border to the row card", () => {
      const surface = rowSurfaceStyle(sampleRow, idx, state);
      expect(surface.borderColor).toBe("#D64800FF");
      expect(surface.borderStyle).toBe("double");
      expect(surface.borderWidth).toBe("4px");
    });

    it("applies the row border radius to the row card", () => {
      expect(rowSurfaceStyle(sampleRow, idx, state).borderRadius).toBe("60px 60px 20px 20px");
    });

    it("applies rowMargin to the row card", () => {
      const surface = rowSurfaceStyle(sampleRow, idx, state);
      expect(surface.marginLeft).toBe("10%");
      expect(surface.marginRight).toBe("10%");
    });

    it("applies the row drop shadow filter to the row card", () => {
      expect(rowSurfaceStyle(sampleRow, idx, state).filter).toContain("drop-shadow(3px 3px 3px 0px #D64800FF)");
    });

    it("applies rowTitle font to rowTitle text", () => {
      expect(textStyle("rowTitle", idx, state, sampleRow).fontFamily).toBe("Courier");
    });

    it("applies rowTitleTextSize to rowTitle text", () => {
      expect(textStyle("rowTitle", idx, state, sampleRow).fontSize).toBe("200%");
    });

    it("applies rowTitleColor to rowTitle text", () => {
      expect(textStyle("rowTitle", idx, state, sampleRow).color).toBe("#000000FF");
    });

    it("applies rowText font to rowText text", () => {
      expect(textStyle("rowText", idx, state, sampleRow).fontFamily).toBe("Georgia");
    });

    it("applies rowTextTextSize to rowText text", () => {
      expect(textStyle("rowText", idx, state, sampleRow).fontSize).toBe("100%");
    });

    it("applies rowTextColor to rowText text", () => {
      expect(textStyle("rowText", idx, state, sampleRow).color).toBe("#000000FF");
    });

    it("applies the row button padding (X = vertical, Y = horizontal)", () => {
      expect(rowButtonStyle(sampleRow, idx, state).padding).toBe("0px 0px");
    });

    it("applies the row body margins", () => {
      expect(rowSurfaceStyle(sampleRow, idx, state).margin).toBe("25px 1% 25px");
    });

    it("applies rowImageWidth to row images", () => {
      expect(imageStyle("rowImage", idx, state, sampleRow).width).toBe("100%");
    });

    it("applies the filter string for the unselected state", () => {
      expect(buildFilterString(app.styling as Record<string, unknown>, "unsel")).toBe("");
    });

  });
});
