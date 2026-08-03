import { describe, expect, it } from "vitest";

import {
  aclImportImages,
  createDefaultApp,
  normalizeApp,
  resolveImageRef,
  appVersion,
} from "./cyoa.js";
import { buildCyoaIndex, checkRequirements, createCyoaState, selectChoice } from "./cyoa-engine.js";
import type { App, Choice, Requireds, Row } from "./types.js";

/**
 * Import/export interchange parity tests.
 *
 * `normalizeApp` is the port of the original ICCPlus `loadFromDisk` +
 * `initializeApp` path. These tests pin the legacy-document migrations so an
 * ICCPlus-exported project.json behaves identically after import, and the
 * re-export stays loadable by the original creator (extra keys preserved,
 * nothing dropped).
 */
describe("normalizeApp legacy migrations", () => {
  it("fills every default key and preserves unknown (forward-compat) keys", () => {
    const raw = { version: appVersion, rows: [], mysteryKey: { nested: true } };
    const app = normalizeApp(raw);
    const defaults = createDefaultApp();
    for (const key of Object.keys(defaults)) {
      expect(app).toHaveProperty(key);
    }
    expect((app as unknown as Record<string, unknown>).mysteryKey).toEqual({ nested: true });
  });

  it("migrates legacy orRequired -> orRequireds for 'or' requirements", () => {
    const legacy: Requireds = {
      required: true,
      requireds: [],
      orRequired: [{ req: "choice_a" }, { req: "choice_b" }],
      id: "1",
      type: "or",
      reqId: "",
      reqId1: "",
      reqId2: "",
      reqId3: "",
      reqPoints: 0,
      showRequired: true,
      orNum: 1,
      afterText: "",
      beforeText: "",
    };
    const row = {
      id: "row_1",
      index: 0,
      title: "R",
      titleText: "",
      objectWidth: "col-md-3",
      image: "",
      template: 1,
      defaultAspectWidth: 1,
      defaultAspectHeight: 1,
      allowedChoices: 0,
      currentChoices: 0,
      requireds: [legacy],
      objects: [],
    } as unknown as Row;
    const app = normalizeApp({ version: "2.0.0-beta", rows: [row] });
    const migrated = app.rows![0].requireds[0];
    expect(migrated.orRequireds?.map((r) => r.reqId)).toEqual(["choice_a", "choice_b"]);

    // And the migrated document drives the engine exactly like a native one.
    const idx = buildCyoaIndex(app);
    const state = createCyoaState(app);
    state.activated.set("choice_a", { multiple: 0 });
    expect(checkRequirements([migrated], idx, state)).toBe(true);
  });

  it("migrates nested requireds inside scores, choices and addons", () => {
    const legacyReq = (): Requireds => ({
      required: true,
      requireds: [],
      orRequired: [{ req: "choice_x" }],
      id: "1",
      type: "or",
      reqId: "",
      reqId1: "",
      reqId2: "",
      reqId3: "",
      reqPoints: 0,
      showRequired: true,
      orNum: 1,
      afterText: "",
      beforeText: "",
    });
    const addon = {
      id: "addon_1",
      title: "A",
      text: "",
      template: 0,
      image: "",
      requireds: [legacyReq()],
      isSelectable: false,
    };
    const choice = {
      id: "choice_1",
      index: 0,
      title: "C",
      text: "",
      image: "",
      template: 1,
      objectWidth: "",
      isActive: false,
      multipleUseVariable: 99,
      selectedThisManyTimesProp: 0,
      requireds: [legacyReq()],
      addons: [addon],
      scores: [{ idx: "s0", id: "pt_1", value: 1, requireds: [legacyReq()] }],
      groups: [],
    } as unknown as Choice;
    const app = normalizeApp({ version: "2.0.0-beta", rows: [{ id: "r1", objects: [choice] }] });
    const c = app.rows![0].objects[0];
    expect(c.requireds[0].orRequireds?.map((r) => r.reqId)).toEqual(["choice_x"]);
    expect(c.scores[0].requireds[0].orRequireds?.map((r) => r.reqId)).toEqual(["choice_x"]);
    expect(c.addons[0].requireds[0].orRequireds?.map((r) => r.reqId)).toEqual(["choice_x"]);
    // addon template default + parentId wiring
    expect(c.addons[0].template).toBe(1);
    expect((c.addons[0] as unknown as Record<string, unknown>).parentId).toBe("choice_1");
  });

  it("normalizes rows: width string -> false, defaultWidth boolean dropped, index set", () => {
    const app = normalizeApp({
      version: "2.4.7",
      rows: [
        {
          id: "row_1",
          title: "R",
          titleText: "",
          objectWidth: "col-md-3",
          image: "",
          template: 1,
          defaultAspectWidth: 1,
          defaultAspectHeight: 1,
          allowedChoices: 0,
          currentChoices: 0,
          requireds: [],
          objects: [],
          width: "col-md-3",
          defaultWidth: true,
        },
      ],
    });
    const row = app.rows![0] as unknown as Record<string, unknown>;
    expect(row.width).toBe(false);
    expect(row.defaultWidth).toBeUndefined();
    expect(app.rows![0].index).toBe(0);
  });

  it("normalizes choices: multiply/divide arrays, fade time, allow-choice list, groups, sfx", () => {
    const app = normalizeApp({
      version: "2.0.0-beta",
      rows: [
        {
          id: "row_1",
          objects: [
            {
              id: "choice_1",
              index: 0,
              title: "C",
              text: "",
              image: "",
              template: 1,
              objectWidth: "",
              isActive: false,
              multipleUseVariable: 99,
              selectedThisManyTimesProp: 0,
              requireds: [],
              addons: [],
              scores: [],
              groups: [{ id: "group_1" }],
              multiplyPointtypeIsOn: true,
              pointTypeToMultiply: "pt_a",
              startingSumAtMultiply: 5,
              dividePointtypeIsOn: true,
              pointTypeToDivide: "pt_b",
              startingSumAtDivide: 7,
              isFadeTransition: true,
              fadeTransitionTime: 0.5,
              addToAllowChoice: true,
              idOfAllowChoice: "choice_2",
              sfxId: "sfx_1",
              sfxOnSelect: true,
              sfxOnDeselect: true,
              width: "col-12",
              defaultWidth: true,
              defaultAspectWidth: 3,
              defaultAspectHeight: 4,
            },
          ],
        },
      ],
    });
    const c = app.rows![0].objects[0];
    expect(c.pointTypeToMultiply).toEqual(["pt_a"]);
    expect(c.startingSumAtMultiply).toEqual([{ value: 5, calcVal: 5 }]);
    expect(c.pointTypeToDivide).toEqual(["pt_b"]);
    expect(c.startingSumAtDivide).toEqual([{ value: 7, calcVal: 7 }]);
    expect(c.groups).toEqual(["group_1"]);
    expect(c.idOfAllowChoice).toEqual(["choice_2"]);
    expect(c.sfxIdOnSelect).toBe("sfx_1");
    expect(c.sfxIdOnDeselect).toBe("sfx_1");
    const record = c as unknown as Record<string, unknown>;
    expect(record.sfxId).toBeUndefined();
    expect(record.fadeInTransitionTime).toBe(0.5);
    expect(record.fadeOutTransitionTime).toBe(0.5);
    expect(record.fadeTransitionTime).toBeUndefined();
    expect(record.width).toBeUndefined();
    expect(record.defaultWidth).toBeUndefined();
    expect(record.defaultAspectWidth).toBeUndefined();
    expect(record.defaultAspectHeight).toBeUndefined();
  });

  it("fills point-type initValue from startingSum and flattens color objects", () => {
    const app = normalizeApp({
      pointTypes: [
        {
          id: "pt_1",
          name: "Gold",
          startingSum: 10,
          positiveColor: { hexa: "#ff0000" },
          activatedId: "choice_a",
        },
      ],
    });
    const pt = app.pointTypes![0];
    expect(pt.initValue).toBe(10);
    expect(pt.positiveColor).toBe("#ff0000");
    expect(pt.isNotShownObjects).toBe(true);
    expect(pt.isNotShownPointBar).toBe(true);
  });

  it("migrates legacy styling (old radius x10 and color objects) on the main styling", () => {
    const app = normalizeApp({
      version: "2.0.0-beta",
      styling: {
        rowBorderRadiusTopLeft: 3,
        backgroundColor: { hexa: "#112233" },
      },
    });
    expect(app.styling!.rowBorderRadiusTopLeft).toBe(30);
    expect(app.styling!.backgroundColor).toBe("#112233");
    // multi-choice defaults are filled on the main styling object
    expect(app.styling!.customMultiTextFont).toBe(false);
    expect(app.styling!.multiChoiceCounterSize).toBe(170);
  });

  it("tags backpack rows isBackpack + index", () => {
    const app = normalizeApp({
      backpack: [{ id: "bp_1", title: "R", requireds: [], objects: [] }],
    });
    expect(app.backpack![0].isBackpack).toBe(true);
    expect(app.backpack![0].index).toBe(0);
  });
});

describe("export stays loadable by the original ICCPlus", () => {
  it("keeps every original value after a full normalize + serialize round-trip", () => {
    // A representative modern ICCPlus export (the shape `saveToDisk` writes).
    const source = {
      version: "2.9.29",
      rows: [
        {
          id: "row-aaaa",
          index: 0,
          title: "Start",
          titleText: "Begin here",
          objectWidth: "col-md-3",
          image: "",
          template: 1,
          defaultAspectWidth: 1,
          defaultAspectHeight: 1,
          allowedChoices: 1,
          currentChoices: 0,
          requireds: [],
          objects: [
            {
              id: "choice-bbbb",
              index: 0,
              title: "Take the sword",
              text: "It glows.",
              image: "",
              template: 1,
              objectWidth: "",
              isActive: false,
              multipleUseVariable: 99,
              selectedThisManyTimesProp: 0,
              requireds: [],
              addons: [],
              scores: [
                {
                  idx: "s-00000",
                  id: "pt-cccc",
                  value: -5,
                  type: "pt-cccc",
                  beforeText: "",
                  afterText: "",
                  requireds: [],
                  showScore: true,
                },
              ],
              groups: [],
            },
          ],
        },
      ],
      pointTypes: [
        {
          id: "pt-cccc",
          name: "Gold",
          startingSum: 10,
          initValue: 10,
          activatedId: "",
          beforeText: "Cost:",
          afterText: "gold",
          belowZeroNotAllowed: false,
          isNotShownPointBar: false,
          isNotShownObjects: false,
          allowFloat: false,
          decimalPlaces: 0,
        },
      ],
      backpack: [
        {
          index: 0,
          id: "default_backpack_row",
          isBackpack: true,
          title: "Result",
          titleText: "",
          objectWidth: "col-md-3",
          image: "",
          template: 1,
          defaultAspectWidth: 1,
          defaultAspectHeight: 1,
          allowedChoices: 0,
          currentChoices: 0,
          requireds: [],
          objects: [],
          isResultRow: true,
          isInfoRow: true,
        },
      ],
      words: [],
      groups: [],
      variables: [],
      globalRequirements: [],
      soundEffects: [],
      googleFonts: [],
      customFonts: [],
      rowDesignGroups: [],
      objectDesignGroups: [],
      styling: { objectBorderRadiusTopLeft: 4 },
    };
    const app = normalizeApp(source) as App;
    const exported = JSON.parse(JSON.stringify(app)) as Record<string, unknown>;

    // Re-import of our own export must be stable (idempotent round-trip).
    const again = normalizeApp(exported) as App;
    expect(JSON.stringify(again)).toBe(JSON.stringify(app));

    // Modern docs must not be mutated by the migrations (radius stays, no drops).
    expect(app.styling!.objectBorderRadiusTopLeft).toBe(4);
    expect(app.rows![0].objects[0].scores[0].value).toBe(-5);
  });
});

describe("ACL import translation (images as resources)", () => {
  const legacyChoice = (image: string): Choice =>
    ({
      id: "choice_x",
      index: 0,
      title: "C",
      text: "",
      image,
      template: 1,
      objectWidth: "",
      isActive: false,
      multipleUseVariable: 99,
      selectedThisManyTimesProp: 0,
      requireds: [],
      addons: [],
      scores: [],
      groups: [],
    }) as unknown as Choice;

  it("translates legacy inline images into image resources referenced by id", () => {
    const app = normalizeApp({
      rows: [
        {
          id: "row_1",
          objects: [
            legacyChoice("data:image/webp;base64,AAAA"),
            legacyChoice("data:image/webp;base64,BBBB"),
            {
              ...legacyChoice("https://example.com/img.png"),
              id: "choice_y",
            },
            legacyChoice(""),
          ],
        },
      ],
      backpack: [{ id: "bp", image: "data:image/webp;base64,CCCC", objects: [] }],
    });
    aclImportImages(app);

    expect(app.images).toHaveLength(4);
    const payloads = app.images.map((img) => img.image);
    expect(payloads).toContain("data:image/webp;base64,AAAA");
    expect(payloads).toContain("https://example.com/img.png");
    // References are rewritten to resource ids.
    for (const choice of app.rows![0].objects) {
      if (choice.image) {
        expect(app.images.some((img) => img.id === choice.image)).toBe(true);
      } else {
        expect(choice.image).toBe("");
      }
    }
    // Empty strings stay empty.
    expect(app.rows![0].objects[3].image).toBe("");
    // Backpack rows are translated too.
    expect(app.backpack![0].image).toMatch(/^image-/);
    // Resolution round-trips the payload.
    expect(resolveImageRef(app, app.rows![0].objects[0].image)).toBe("data:image/webp;base64,AAAA");
    // Legacy inline strings pass through resolution untouched.
    expect(resolveImageRef(app, "data:image/webp;base64,ZZZZ")).toBe("data:image/webp;base64,ZZZZ");
  });

  it("deduplicates identical images into one resource", () => {
    const app = normalizeApp({
      rows: [
        {
          id: "row_1",
          objects: [
            legacyChoice("data:image/webp;base64,SAME"),
            { ...legacyChoice("data:image/webp;base64,SAME"), id: "choice_y" },
            {
              ...legacyChoice("data:image/webp;base64,SAME"),
              id: "choice_z",
              addons: [
                {
                  id: "addon_1",
                  title: "A",
                  text: "",
                  image: "data:image/webp;base64,SAME",
                  requireds: [],
                  isSelectable: false,
                },
              ],
            },
          ],
        },
      ],
    });
    aclImportImages(app);

    expect(app.images).toHaveLength(1);
    const id = app.images[0].id;
    const objects = app.rows![0].objects;
    expect(objects[0].image).toBe(id);
    expect(objects[1].image).toBe(id);
    expect((objects[2].addons ?? [])[0].image).toBe(id);
  });

  it("is idempotent — re-importing a translated document adds no resources", () => {
    const app = normalizeApp({
      rows: [{ id: "row_1", objects: [legacyChoice("data:image/webp;base64,AAAA")] }],
    });
    aclImportImages(app);
    const before = JSON.stringify(app);
    const again = JSON.parse(before) as App;
    aclImportImages(again);
    expect(JSON.stringify(again)).toBe(before);
  });

  it("does not touch image values that are already resource ids", () => {
    const app = normalizeApp({
      images: [{ id: "image_1", name: "Icon", image: "data:image/webp;base64,AAAA" }],
      rows: [
        {
          id: "row_1",
          objects: [{ ...legacyChoice("image_1"), id: "choice_y" }],
        },
      ],
    });
    aclImportImages(app);
    expect(app.images).toHaveLength(1);
    expect(app.rows![0].objects[0].image).toBe("image_1");
    expect(resolveImageRef(app, "image_1")).toBe("data:image/webp;base64,AAAA");
  });

  it("translates point-type icons and image variants too", () => {
    const app = normalizeApp({
      pointTypes: [
        {
          id: "pt_1",
          name: "Gold",
          startingSum: 10,
          initValue: 10,
          activatedId: "",
          beforeText: "",
          afterText: "",
          image: "data:image/png;base64,ICON",
          negativeImage: "https://example.com/neg.png",
        },
      ],
      rows: [
        {
          id: "row_1",
          objects: [
            {
              ...legacyChoice(""),
              id: "choice_y",
              imageSwitchingIsOn: true,
              imageVariants: [
                {
                  id: "v1",
                  image: "data:image/webp;base64,VAR",
                  requireds: [],
                  priority: 1,
                },
              ],
            },
          ],
        },
      ],
    });
    aclImportImages(app);
    expect(app.images).toHaveLength(3);
    expect(app.pointTypes![0].image).toMatch(/^image-/);
    expect(app.pointTypes![0].negativeImage).toMatch(/^image-/);
    expect(app.rows![0].objects[0].imageVariants![0].image).toMatch(/^image-/);
  });

  it("translates styling background images (design tab) into resources", () => {
    const app = normalizeApp({
      styling: {
        backgroundImage: "data:image/webp;base64,PAGE",
        rowBackgroundImage: "https://example.com/row.png",
        objectBackgroundImage: "data:image/webp;base64,PAGE", // dedupes with page bg
        addonBackgroundImage: "https://example.com/addon.png",
        backpackBgImage: "data:image/webp;base64,BACKPACK",
        backgroundColor: "#000000", // not an image — untouched
      },
      rows: [],
    });
    aclImportImages(app);

    const styling = app.styling as Record<string, unknown>;
    for (const key of [
      "backgroundImage",
      "rowBackgroundImage",
      "objectBackgroundImage",
      "addonBackgroundImage",
      "backpackBgImage",
    ]) {
      expect(String(styling[key])).toMatch(/^image-/);
      expect(resolveImageRef(app, String(styling[key]))).toBeTruthy();
    }
    // Same payload dedupes to one resource; total = page/row/addon/backpack.
    expect(app.images).toHaveLength(4);
    expect(styling.backgroundImage).toBe(styling.objectBackgroundImage);
    expect(styling.backgroundColor).toBe("#000000");

    // Idempotent: translating again changes nothing.
    const again = JSON.parse(JSON.stringify(app)) as App;
    aclImportImages(again);
    expect(JSON.stringify(again)).toBe(JSON.stringify(app));
  });
});
