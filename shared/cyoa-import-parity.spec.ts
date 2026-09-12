import { describe, expect, it } from "vite-plus/test";
import {
  aclImportImages,
  appVersion,
  normalizeApp,
  parseProjectDocument,
  resolveImageRef,
  visitAppImageFields,
} from "./cyoa";
import { buildCyoaIndex, checkRequirements, createCyoaState } from "./cyoa-engine";
import { getStyling } from "./cyoa-styling";

describe("ICCPlus import compatibility", () => {
  it.each(["null", "[]", "42", '"text"', '{"rows":{}}'])(
    "rejects a non-document import: %s",
    (raw) => {
      expect(() => parseProjectDocument(raw)).toThrow();
    },
  );

  it("accepts JSON files with a UTF-8 BOM", () => {
    expect(parseProjectDocument('\uFEFF{"rows":[]}')).toEqual({ rows: [] });
  });

  it("migrates unversioned private styles once without mutating the source", () => {
    const source = {
      rows: [
        {
          id: "row",
          objects: [
            {
              id: "choice",
              isPrivateStyling: true,
              styling: {
                objectBorderRadiusTopLeft: 2,
                objectBorderRadiusIsPixels: true,
                objectBorderIsOn: true,
                objectBorderColor: { hexa: "#112233FF" },
              },
            },
          ],
        },
      ],
    };
    const original = structuredClone(source);
    const app = normalizeApp(source);
    const choice = app.rows[0].objects[0];
    expect(source).toEqual(original);
    expect(app.version).toBe(appVersion);
    expect(choice.styling?.objectBorderRadiusTopLeft).toBe(20);
    expect(choice.privateObjectIsOn).toBe(true);
    expect(
      getStyling(
        "privateObjectIsOn",
        buildCyoaIndex(app),
        createCyoaState(app),
        app.rows[0],
        choice,
      ).objectBorderColor,
    ).toBe("#112233FF");
    expect(normalizeApp(app)).toEqual(app);
  });

  it("loads null and omitted nested collections and keeps ungated point types visible", () => {
    const app = normalizeApp({
      styling: null,
      viewerConfig: null,
      backpack: null,
      rows: [
        null,
        {
          id: "row",
          requireds: null,
          objects: [null, { id: "choice", addons: null, scores: null }],
        },
      ],
      pointTypes: [{ id: "points", startingSum: 8 }],
    });
    expect(app.rows).toHaveLength(1);
    expect(app.rows[0].objects[0].addons).toEqual([]);
    expect(app.rows[0].objects[0].scores).toEqual([]);
    expect(app.pointTypes[0].isNotShownPointBar).not.toBe(true);
    expect(app.pointTypes[0].initValue).toBe(8);
    expect(() => buildCyoaIndex(app)).not.toThrow();
  });

  it("migrates ORs nested inside ORs and selectable-addon scores", () => {
    const legacy = { type: "or", required: true, orRequired: [{ req: "gate" }], orNum: 1 };
    const app = normalizeApp({
      rows: [
        {
          id: "row",
          objects: [
            {
              id: "choice",
              addons: [
                {
                  id: "addon",
                  isSelectable: true,
                  scores: [
                    {
                      id: "points",
                      requireds: [{ type: "or", required: true, orNum: 1, orRequireds: [legacy] }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    const addon = app.rows[0].objects[0].addons[0];
    if (!addon.isSelectable) throw new Error("Expected selectable addon");
    const state = createCyoaState(app);
    const idx = buildCyoaIndex(app);
    expect(checkRequirements(addon.scores[0].requireds, idx, state)).toBe(false);
    state.activated.set("gate", { multiple: 0 });
    expect(checkRequirements(addon.scores[0].requireds, idx, state)).toBe(true);
  });

  it("translates all image locations and keeps image payloads deduplicated", () => {
    const payload = "data:image/png;base64,AA==";
    const app = normalizeApp({
      version: appVersion,
      viewerConfig: { loadingBgImage: payload },
      rows: [
        {
          id: "row",
          image: payload,
          imageSourceTooltip: "Row credit",
          styling: { rowBorderImage: payload },
          objects: [
            {
              id: "choice",
              bgImage: payload,
              styling: { objectBackgroundImage: payload },
              addons: [{ id: "addon", image: payload, styling: { addonBorderImage: payload } }],
              imageVariants: [{ image: payload }],
            },
          ],
        },
      ],
      rowDesignGroups: [{ id: "design", styling: { backgroundImage: payload } }],
      pointTypes: [{ id: "points", image: payload, negativeImage: payload }],
    });
    aclImportImages(app);
    expect(app.images).toHaveLength(1);
    visitAppImageFields(app, (record, key) => {
      if (record[key]) expect(resolveImageRef(app, String(record[key]))).toBe(payload);
    });
    const once = structuredClone(app);
    expect(aclImportImages(app)).toEqual(once);
  });
});
