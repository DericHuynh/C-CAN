import { describe, expect, it, vi } from "vite-plus/test";

import { createDefaultAddon, createDefaultApp, createDefaultScore } from "./cyoa.js";
import {
  activateRowButton,
  applyActivateOther,
  applyChoiceVariables,
  applyDeactivateOther,
  applyDeselectActivateOther,
  applyDuplicateRow,
  applyMissingReqCascade,
  backgroundOverrides,
  buildCyoaIndex,
  checkActivated,
  checkPointEnable,
  checkRequirements,
  computePointTotals,
  computeScoreNet,
  createCyoaState,
  deselectChoice,
  effectiveTemplate,
  effectiveWidth,
  encodeBuildCode,
  evalExpression,
  hiddenContentsFor,
  loadBuildCode,
  pointBarOverrides,
  pointSum,
  parseBuildCode,
  replaceText,
  rollScoreValue,
  rowAllowedChoices,
  selectChoice,
  selectOneLess,
  selectOneMore,
  templateOverrideFor,
  widthOverrideFor,
} from "./cyoa-engine.js";
import type { Choice, Requireds, Row, SelectableAddon } from "./types.js";

/** Build a positive/negated choice-id requirement. */
function idReq(reqId: string, required = true): Requireds {
  return {
    required,
    requireds: [],
    orRequired: [],
    id: "1",
    type: "id",
    reqId,
    reqId1: "",
    reqId2: "",
    reqId3: "",
    reqPoints: 0,
    showRequired: true,
    afterText: "",
    beforeText: "",
  };
}

function appWith(patch: Partial<ReturnType<typeof createDefaultApp>>) {
  const app = createDefaultApp();
  return { ...app, ...patch };
}

function makeRow(id: string, objects: Choice[] = []): Row {
  return {
    id,
    title: id,
    index: 0,
    requireds: [],
    objects,
    groups: [],
  } as unknown as Row;
}

function makeChoice(id: string, patch: Partial<Choice> = {}): Choice {
  return {
    id,
    title: id,
    text: "",
    index: 0,
    requireds: [],
    scores: [],
    addons: [],
    groups: [],
    ...patch,
  } as Choice;
}

describe("cyoa-engine requirements", () => {
  it("checks choice-id requirements", () => {
    const app = appWith({});
    const idx = buildCyoaIndex(app);
    const state = createCyoaState(app);
    state.activated.set("choice_a", { multiple: 0 });
    const req: Requireds = {
      required: true,
      requireds: [],
      orRequired: [],
      id: "1",
      type: "id",
      reqId: "choice_a",
      reqId1: "",
      reqId2: "",
      reqId3: "",
      reqPoints: 0,
      showRequired: true,
      afterText: "",
      beforeText: "",
    };
    expect(checkRequirements([req], idx, state)).toBe(true);
    state.activated.clear();
    expect(checkRequirements([req], idx, state)).toBe(false);
  });

  it("checks /ON# multiple thresholds", () => {
    const app = appWith({});
    const idx = buildCyoaIndex(app);
    const state = createCyoaState(app);
    state.activated.set("choice_a", { multiple: 3 });
    expect(checkActivated("choice_a/ON#3", state)).toBe(true);
    expect(checkActivated("choice_a/ON#4", state)).toBe(false);
  });

  it("checks point requirements with operators", () => {
    const app = appWith({
      pointTypes: [
        {
          id: "pt_gold",
          name: "Gold",
          startingSum: 10,
          initValue: 0,
          beforeText: "",
          afterText: "",
        } as never,
      ],
    });
    const idx = buildCyoaIndex(app);
    const state = createCyoaState(app);
    const req: Requireds = {
      required: true,
      requireds: [],
      orRequired: [],
      id: "2",
      type: "points",
      reqId: "pt_gold",
      reqId1: "",
      reqId2: "",
      reqId3: "",
      reqPoints: 5,
      operator: "2", // >=
      showRequired: true,
      afterText: "",
      beforeText: "",
    };
    expect(checkRequirements([req], idx, state)).toBe(true);
    req.reqPoints = 10;
    expect(checkRequirements([req], idx, state)).toBe(true);
    req.reqPoints = 11;
    expect(checkRequirements([req], idx, state)).toBe(false);
  });

  it("recurses into global requirements (gid)", () => {
    const app = appWith({
      globalRequirements: [
        {
          id: "gid_1",
          requireds: [
            {
              required: true,
              requireds: [],
              orRequired: [],
              id: "3",
              type: "id",
              reqId: "choice_a",
              reqId1: "",
              reqId2: "",
              reqId3: "",
              reqPoints: 0,
              showRequired: true,
              afterText: "",
              beforeText: "",
            },
          ],
        } as never,
      ],
    });
    const idx = buildCyoaIndex(app);
    const state = createCyoaState(app);
    state.activated.set("choice_a", { multiple: 0 });
    const req: Requireds = {
      required: true,
      requireds: [],
      orRequired: [],
      id: "4",
      type: "gid",
      reqId: "gid_1",
      reqId1: "",
      reqId2: "",
      reqId3: "",
      reqPoints: 0,
      showRequired: true,
      afterText: "",
      beforeText: "",
    };
    expect(checkRequirements([req], idx, state)).toBe(true);
  });

  it("evaluates or (N of M) requirements", () => {
    const app = appWith({});
    const idx = buildCyoaIndex(app);
    const state = createCyoaState(app);
    state.activated.set("choice_a", { multiple: 0 });
    const makeId = (reqId: string): Requireds => ({
      required: true,
      requireds: [],
      orRequired: [],
      id: "x",
      type: "id",
      reqId,
      reqId1: "",
      reqId2: "",
      reqId3: "",
      reqPoints: 0,
      showRequired: true,
      afterText: "",
      beforeText: "",
    });
    const req: Requireds = {
      required: true,
      requireds: [],
      orRequired: [],
      id: "5",
      type: "or",
      reqId: "",
      reqId1: "",
      reqId2: "",
      reqId3: "",
      reqPoints: 0,
      orNum: 2,
      orRequireds: [makeId("choice_a"), makeId("choice_b"), makeId("choice_c")],
      showRequired: true,
      afterText: "",
      beforeText: "",
    };
    expect(checkRequirements([req], idx, state)).toBe(false);
    state.activated.set("choice_b", { multiple: 0 });
    expect(checkRequirements([req], idx, state)).toBe(true);
  });
});

describe("cyoa-engine points", () => {
  it("rolls random scores between expression bounds", () => {
    const app = appWith({ rows: [] });
    const idx = buildCyoaIndex(app);
    const state = createCyoaState(app);
    const rng = vi.spyOn(Math, "random").mockReturnValue(0.5);
    try {
      expect(
        rollScoreValue(
          "choice",
          0,
          {
            isRandom: true,
            useExpression: true,
            expMinValue: "2 + 2",
            expMaxValue: "4 + 4",
            expValue: "99",
          } as never,
          idx,
          state,
        ),
      ).toBe(6);
    } finally {
      rng.mockRestore();
    }
  });

  it("applies cumulative scaling to each recorded multi-select roll", () => {
    const choice = makeChoice("multi", {
      isSelectableMultiple: true,
      scores: [{ id: "gold", isRandom: true, multiplyByTimes: true } as never],
    });
    const app = appWith({
      rows: [makeRow("row", [choice])],
      pointTypes: [{ id: "gold", startingSum: 100 } as never],
    });
    const idx = buildCyoaIndex(app);
    const state = createCyoaState(app);
    state.activated.set(choice.id, { multiple: 2 });
    state.rolledScores.set("multi:0:1", 3);
    state.rolledScores.set("multi:0:2", 7);

    expect(computePointTotals(app, idx, state).get("gold")?.total).toBe(83);
  });

  it("computes totals from starting sum and scores (ICCPlus: negative value is a gain)", () => {
    const row = makeRow("row_1");
    const choice = makeChoice("choice_a", {
      scores: [
        {
          idx: "0",
          id: "pt_gold",
          type: "pt_gold",
          value: -5,
          beforeText: "",
          afterText: "",
          requireds: [],
          showScore: true,
        },
      ],
    });
    row.objects = [choice];
    const app = appWith({
      rows: [row],
      pointTypes: [
        {
          id: "pt_gold",
          name: "Gold",
          startingSum: 10,
          initValue: 0,
          beforeText: "",
          afterText: "",
        } as never,
      ],
    });
    const idx = buildCyoaIndex(app);
    const state = createCyoaState(app);
    const totals = computePointTotals(app, idx, state);
    expect(totals.get("pt_gold")?.total).toBe(10);
    const next = selectChoice(choice, row, idx, state);
    const totals2 = computePointTotals(app, idx, next);
    // value -5 = gain of 5: 10 - (-5) = 15 (the original applies `-score.value`).
    expect(totals2.get("pt_gold")?.total).toBe(15);
  });

  it("treats a positive score value as a cost (ICCPlus convention)", () => {
    const row = makeRow("row_1");
    const choice = makeChoice("choice_a", {
      scores: [
        {
          idx: "0",
          id: "pt_gold",
          type: "pt_gold",
          value: 5,
          beforeText: "",
          afterText: "",
          requireds: [],
          showScore: true,
        },
      ],
    });
    row.objects = [choice];
    const app = appWith({
      rows: [row],
      pointTypes: [
        {
          id: "pt_gold",
          name: "Gold",
          startingSum: 10,
          initValue: 0,
          beforeText: "",
          afterText: "",
        } as never,
      ],
    });
    const idx = buildCyoaIndex(app);
    const next = selectChoice(choice, row, idx, createCyoaState(app));
    expect(computePointTotals(app, idx, next).get("pt_gold")?.total).toBe(5);
  });

  it("point requirements see active choices' accumulated scores", () => {
    const row = makeRow("row_1");
    const gain = makeChoice("choice_gain", {
      scores: [
        {
          idx: "0",
          id: "pt_gold",
          type: "pt_gold",
          value: -5, // gain of 5 (ICCPlus convention)
          beforeText: "",
          afterText: "",
          requireds: [],
          showScore: true,
        },
      ],
    });
    row.objects = [gain];
    const app = appWith({
      rows: [row],
      pointTypes: [
        {
          id: "pt_gold",
          name: "Gold",
          startingSum: 0,
          initValue: 0,
          beforeText: "",
          afterText: "",
        } as never,
      ],
    });
    const idx = buildCyoaIndex(app);
    const req: Requireds = {
      required: true,
      requireds: [],
      orRequired: [],
      id: "2",
      type: "points",
      reqId: "pt_gold",
      reqId1: "",
      reqId2: "",
      reqId3: "",
      reqPoints: 5,
      operator: "2", // >=
      showRequired: true,
      afterText: "",
      beforeText: "",
    };
    let state = createCyoaState(app);
    expect(checkRequirements([req], idx, state)).toBe(false); // 0 >= 5
    state = selectChoice(gain, row, idx, state);
    expect(checkRequirements([req], idx, state)).toBe(true); // 5 >= 5
  });

  it("scales scores by multiple count (multiplyByTimes: cumulative 1+2+...+N)", () => {
    const row = makeRow("row_1");
    const choice = makeChoice("choice_a", {
      isSelectableMultiple: true,
      scores: [
        {
          idx: "0",
          id: "pt_gold",
          type: "pt_gold",
          value: -5,
          beforeText: "",
          afterText: "",
          requireds: [],
          showScore: true,
          multiplyByTimes: true,
        },
      ],
    });
    row.objects = [choice];
    const app = appWith({
      rows: [row],
      pointTypes: [
        {
          id: "pt_gold",
          name: "Gold",
          startingSum: 0,
          initValue: 0,
          beforeText: "",
          afterText: "",
        } as never,
      ],
    });
    const idx = buildCyoaIndex(app);
    const state = createCyoaState(app);
    const once = selectOneMore(choice, row, state);
    expect(once.activated.get("choice_a")?.multiple).toBe(1);
    const twice = selectOneMore(choice, row, once);
    const thrice = selectOneMore(choice, row, twice);
    // multiplyByTimes applies val*(selNum+1) per increment: count 3 = 1+2+3 = 6x.
    // value -5 (gain) at count 3: -(-5 * 6) = 30.
    expect(computePointTotals(app, idx, thrice).get("pt_gold")?.total).toBe(30);
    // count 2 = 1+2 = 3x.
    expect(computePointTotals(app, idx, twice).get("pt_gold")?.total).toBe(15);
  });

  it("scales scores linearly with the count for plain multi-selects", () => {
    const row = makeRow("row_1");
    const choice = makeChoice("choice_a", {
      isSelectableMultiple: true,
      scores: [
        {
          idx: "0",
          id: "pt_gold",
          type: "pt_gold",
          value: -5, // gain of 5 per copy
          beforeText: "",
          afterText: "",
          requireds: [],
          showScore: true,
        },
      ],
    });
    row.objects = [choice];
    const app = appWith({
      rows: [row],
      pointTypes: [
        {
          id: "pt_gold",
          name: "Gold",
          startingSum: 0,
          initValue: 0,
          beforeText: "",
          afterText: "",
        } as never,
      ],
    });
    const idx = buildCyoaIndex(app);
    const state = createCyoaState(app);
    const once = selectOneMore(choice, row, state);
    const twice = selectOneMore(choice, row, once);
    // Each copy applies the base value once: count 2 -> 2 * 5 = 10.
    expect(computePointTotals(app, idx, once).get("pt_gold")?.total).toBe(5);
    expect(computePointTotals(app, idx, twice).get("pt_gold")?.total).toBe(10);
  });
});

describe("cyoa-engine build codes", () => {
  it.each([
    "literal /CHAR# and commas, stay intact",
    "name /ON#42 /VAR#1",
    "name /IMG#not-an-image /RS#0:99",
    "name /RP#gold/NUM#100",
    "  spaces and unicode 🐉\n  ",
    "a lone surrogate \ud800",
  ])("round-trips custom text without interpreting it as build tokens: %s", (word) => {
    const choice = makeChoice("custom", {
      textfieldIsOn: true,
      customTextfieldIsOn: true,
      idOfTheTextfieldWord: "name",
      isImageUpload: true,
    });
    const app = appWith({ rows: [makeRow("row", [choice])] });
    const idx = buildCyoaIndex(app);
    const state = createCyoaState(app);
    state.activated.set(choice.id, { multiple: 0 });
    state.wordValues.set("name", word);
    const image = "https://example.com/image.png#literal/ON#5/CHAR#/WORD#x";
    state.uploadedImages.set(choice.id, image);
    const loaded = loadBuildCode(encodeBuildCode(app, idx, state), app, idx);
    expect(loaded.wordValues.get("name")).toBe(word);
    expect(loaded.uploadedImages.get(choice.id)).toBe(image);
    expect(loaded.activated.get(choice.id)).toEqual({ multiple: 0 });
    expect(loaded.pointAdjustments.size).toBe(0);
    expect(loaded.rolledScores.size).toBe(0);
  });

  it("reads legacy word and image fields without parsing their contents as metadata", () => {
    const [entry] = parseBuildCode(
      "custom/ON#2/WORD#hello/CHAR# world /ON#99/IMG#https://example.com/x/ON#5",
    );
    expect(entry.multiple).toBe(2);
    expect(entry.word).toBe("hello, world /ON#99");
    expect(entry.image).toBe("https://example.com/x/ON#5");
  });

  it("does not treat markers in a legacy image URL as a word field", () => {
    const [entry] = parseBuildCode("custom/IMG#https://example.com/x/WORD#literal");
    expect(entry.word).toBeUndefined();
    expect(entry.image).toBe("https://example.com/x/WORD#literal");
  });

  it("ignores malformed encoded text while retaining valid selections", () => {
    const [entry] = parseBuildCode(
      "custom/ON#2/WORD2#%broken/IMG2#%22https%3A%2F%2Fexample.com%22",
    );
    expect(entry.multiple).toBe(2);
    expect(entry.word).toBeUndefined();
    expect(entry.image).toBe("https://example.com");
  });

  it.each([
    { code: "flag", expected: true },
    { code: "flag/VAR#0,turn-on", expected: false },
    { code: "turn-on,flag/VAR#0", expected: false },
    { code: "flag/VAR#1,turn-off", expected: true },
  ])("restores legacy or explicit variable state from $code", ({ code, expected }) => {
    const on = makeChoice("turn-on", {
      isChangeVariables: true,
      changeType: "1",
      changedVariables: ["flag"],
    });
    const off = makeChoice("turn-off", {
      isChangeVariables: true,
      changeType: "2",
      changedVariables: ["flag"],
    });
    const app = appWith({
      rows: [makeRow("row", [on, off])],
      variables: [{ id: "flag", isTrue: false } as never],
    });
    const idx = buildCyoaIndex(app);
    const loaded = loadBuildCode(code, app, idx);

    expect(loaded.variables.get("flag")).toBe(expected);
    expect(loaded.activated.has("flag")).toBe(expected);
  });

  it("replaces document selections and stale counts when loading a build", () => {
    const row = makeRow("row", [makeChoice("a"), makeChoice("b")]);
    row.currentChoices = 9;
    const app = appWith({ rows: [row], activated: ["a"] });
    const idx = buildCyoaIndex(app);

    const loaded = loadBuildCode("b,b", app, idx);
    expect([...loaded.activated.keys()]).toEqual(["b"]);
    expect(loaded.currentChoices.get(row.id)).toBe(1);
    const cleared = loadBuildCode("", app, idx);
    expect(cleared.activated.size).toBe(0);
    expect(cleared.currentChoices.get(row.id)).toBe(0);
  });

  it("round-trips fractional row-button awards without adding duplicate entries twice", () => {
    const row = makeRow("bonus");
    const app = appWith({
      rows: [row],
      pointTypes: [{ id: "gold", startingSum: 0, allowFloat: true } as never],
    });
    const idx = buildCyoaIndex(app);
    const state = createCyoaState(app);
    state.activated.set(row.id, {
      multiple: 0,
      isRowButton: true,
      rndPoint: "gold",
      pointNum: 2.5,
    });
    state.pointAdjustments.set("gold", 2.5);
    const code = encodeBuildCode(app, idx, state);
    const loaded = loadBuildCode(`${code},${code}`, app, idx);

    expect(loaded.activated.get(row.id)?.pointNum).toBe(2.5);
    expect(computePointTotals(app, idx, loaded).get("gold")?.total).toBe(2.5);
  });

  it.each(["Ari, the Wanderer", ""])(
    "restores player text %j and an uploaded image together",
    (word) => {
      const choice = makeChoice("portrait", {
        textfieldIsOn: true,
        customTextfieldIsOn: true,
        idOfTheTextfieldWord: "player_name",
        wordChangeSelect: "Author's default",
        isImageUpload: true,
        image: "https://example.com/default.png",
      });
      const row = makeRow("row", [choice]);
      const app = appWith({
        rows: [row],
        words: [{ id: "player_name", replaceText: "Default name" } as never],
      });
      const idx = buildCyoaIndex(app);
      const state = selectChoice(choice, row, idx, createCyoaState(app));
      const image = "https://example.com/portrait.png?crop=1,2";
      state.wordValues.set("player_name", word);
      state.uploadedImages.set(choice.id, image);

      const loaded = loadBuildCode(encodeBuildCode(app, idx, state), app, idx);

      expect(replaceText("Name: player_name", idx, loaded)).toBe(`Name: ${word}`);
      expect(loaded.uploadedImages.get(choice.id)).toBe(image);
      expect(choice.wordChangeSelect).toBe("Author's default");
      expect(choice.image).toBe("https://example.com/default.png");
    },
  );

  it("preserves old random-score build tokens", () => {
    const score = { id: "gold", value: 0, isRandom: true, minValue: 1, maxValue: 1 };
    const choice = makeChoice("random", { scores: [score as never] });
    const app = appWith({
      rows: [makeRow("row", [choice])],
      pointTypes: [{ id: "gold", startingSum: 100 } as never],
    });
    const idx = buildCyoaIndex(app);
    const loaded = loadBuildCode("random/RS#0:7", app, idx);
    const reloaded = loadBuildCode(encodeBuildCode(app, idx, loaded), app, idx);

    expect(computePointTotals(app, idx, reloaded).get("gold")?.total).toBe(93);
  });

  it("round-trips a selection through encode/load", () => {
    const row = makeRow("row_1");
    const choice = makeChoice("choice_a");
    const multi = makeChoice("choice_b", { isSelectableMultiple: true });
    row.objects = [choice, multi];
    const app = appWith({ rows: [row] });
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    state = selectChoice(choice, row, idx, state);
    state = selectOneMore(multi, row, state);
    state = selectOneMore(multi, row, state);
    const code = encodeBuildCode(app, idx, state);
    expect(code).toContain("choice_a");
    expect(code).toContain("choice_b/ON#2");
    const loaded = loadBuildCode(code, app, idx);
    expect(loaded.activated.has("choice_a")).toBe(true);
    expect(loaded.activated.get("choice_b")?.multiple).toBe(2);
  });

  it("clears a selection with an empty code", () => {
    const row = makeRow("row_1");
    const choice = makeChoice("choice_a");
    row.objects = [choice];
    const app = appWith({ rows: [row] });
    const idx = buildCyoaIndex(app);
    const state = createCyoaState(app);
    state.activated.set("choice_a", { multiple: 0 });
    const loaded = loadBuildCode("", app, idx);
    expect(loaded.activated.size).toBe(0);
  });
});

describe("cyoa-engine misc", () => {
  it("replaces words in text and point values in expressions", () => {
    const row = makeRow("row_1");
    const app = appWith({
      rows: [row],
      words: [{ id: "word_hero", replaceText: "Hercules" } as never],
      pointTypes: [
        {
          id: "pt_gold",
          name: "Gold",
          startingSum: 42,
          initValue: 0,
          beforeText: "",
          afterText: "",
        } as never,
      ],
    });
    const idx = buildCyoaIndex(app);
    const state = createCyoaState(app);
    expect(replaceText("Hello word_hero, welcome!", idx, state)).toBe("Hello Hercules, welcome!");
    expect(evalExpression("{pt_gold} * 2", idx, state)).toBe(84);
  });

  it("hides gated point types from the bar", () => {
    const app = appWith({
      pointTypes: [
        {
          id: "pt_secret",
          name: "Secret",
          startingSum: 0,
          initValue: 0,
          beforeText: "",
          afterText: "",
          isNotShownPointBar: true,
          activatedId: "choice_a",
        } as never,
        {
          id: "pt_public",
          name: "Public",
          startingSum: 0,
          initValue: 0,
          beforeText: "",
          afterText: "",
        } as never,
      ],
    });
    const idx = buildCyoaIndex(app);
    const state = createCyoaState(app);
    const secret = idx.pointTypeMap.get("pt_secret")!;
    const pub = idx.pointTypeMap.get("pt_public")!;
    expect(checkPointEnable(secret, idx, state)).toBe(false);
    expect(checkPointEnable(pub, idx, state)).toBe(true);
    state.activated.set("choice_a", { multiple: 0 });
    expect(checkPointEnable(secret, idx, state)).toBe(true);
  });

  it("preserves accumulated row button awards through a build roundtrip", () => {
    const row = makeRow("award", []);
    Object.assign(row, {
      btnPointAddon: true,
      buttonTypeRadio: "sumaddon",
      pointTypeRandom: "gold",
      randomMin: 3,
      randomMax: 3,
    });
    const app = appWith({
      rows: [row],
      pointTypes: [{ id: "gold", name: "Gold", startingSum: 10, initValue: 0 } as never],
    });
    const idx = buildCyoaIndex(app);
    let state = activateRowButton(row, idx, createCyoaState(app));
    state = activateRowButton(row, idx, state);
    expect(pointSum("gold", idx, state)).toBe(16);
    const loaded = loadBuildCode(encodeBuildCode(app, idx, state), app, idx);
    expect(pointSum("gold", idx, loaded)).toBe(16);
  });

  it("preserves earlier awards when a later roll would violate the point floor", () => {
    const row = makeRow("award", []);
    Object.assign(row, {
      btnPointAddon: true,
      buttonTypeRadio: "sumaddon",
      pointTypeRandom: "gold",
      randomMin: 3,
      randomMax: 3,
    });
    const app = appWith({
      rows: [row],
      pointTypes: [
        {
          id: "gold",
          name: "Gold",
          startingSum: 0,
          initValue: 0,
          belowZeroNotAllowed: true,
        } as never,
      ],
    });
    const idx = buildCyoaIndex(app);
    const state = activateRowButton(row, idx, createCyoaState(app));
    const next = activateRowButton({ ...row, randomMin: -4, randomMax: -4 }, idx, state);
    expect(next).toBe(state);
    const loaded = loadBuildCode(encodeBuildCode(app, idx, next), app, idx);
    expect(pointSum("gold", idx, loaded)).toBe(3);
  });

  it("row button adds a random sum to a point type", () => {
    const row = makeRow("row_1", []);
    row.btnPointAddon = true;
    row.buttonTypeRadio = "sumaddon";
    row.pointTypeRandom = "pt_gold";
    row.randomMin = 1;
    row.randomMax = 5;
    const app = appWith({
      rows: [row],
      pointTypes: [
        {
          id: "pt_gold",
          name: "Gold",
          startingSum: 10,
          initValue: 0,
          beforeText: "",
          afterText: "",
        } as never,
      ],
    });
    const idx = buildCyoaIndex(app);
    const state = createCyoaState(app);
    const next = activateRowButton(row, idx, state);
    expect(next.activated.has("row_1")).toBe(true);
    expect(pointSum("pt_gold", idx, next)).toBeGreaterThanOrEqual(11);
    expect(pointSum("pt_gold", idx, next)).toBeLessThanOrEqual(15);
  });
});

describe("cyoa-engine random row buttons", () => {
  it("does not turn a single selection into a counter on repeated clicks", () => {
    const choice = makeChoice("single");
    const row = { ...makeRow("row", [choice]), buttonRandom: true };
    const app = appWith({ rows: [row] });
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    state = activateRowButton(row, idx, state);
    state = activateRowButton(row, idx, state);
    expect(state.activated.get(choice.id)?.multiple).toBe(0);
    expect(state.currentChoices.get(row.id)).toBe(1);
  });

  it("respects a counter's maximum without counting its copies as separate choices", () => {
    const choice = makeChoice("counter", {
      isSelectableMultiple: true,
      allowSelectByClick: true,
      numMultipleTimesPluss: 2,
    });
    const row = { ...makeRow("row", [choice]), buttonRandom: true };
    const app = appWith({ rows: [row] });
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    for (let i = 0; i < 3; i++) state = activateRowButton(row, idx, state);
    expect(state.activated.get(choice.id)?.multiple).toBe(2);
    expect(state.currentChoices.get(row.id)).toBe(1);
  });

  it("honors the row's selection limit", () => {
    const row = {
      ...makeRow("row", [makeChoice("a"), makeChoice("b")]),
      buttonRandom: true,
      buttonRandomNumber: 2,
      allowedChoices: 1,
    };
    const app = appWith({ rows: [row] });
    const state = activateRowButton(row, buildCyoaIndex(app), createCyoaState(app));
    expect(state.activated.size).toBe(1);
    expect(state.currentChoices.get(row.id)).toBe(1);
  });

  it("ignores stored weights when weighted random is off", () => {
    const row = {
      ...makeRow("row", [
        makeChoice("a", { randomWeight: 100 }),
        makeChoice("b", { randomWeight: 1 }),
      ]),
      buttonRandom: true,
      isWeightedRandom: false,
    };
    const app = appWith({ rows: [row] });
    const random = vi.spyOn(Math, "random").mockReturnValue(0.75);
    try {
      const state = activateRowButton(row, buildCyoaIndex(app), createCyoaState(app));
      expect([...state.activated.keys()]).toEqual(["b"]);
    } finally {
      random.mockRestore();
    }
  });

  it("never selects a zero-weight choice, including at the random lower bound", () => {
    const row = {
      ...makeRow("row", [
        makeChoice("zero", { randomWeight: 0 }),
        makeChoice("eligible", { randomWeight: 1 }),
      ]),
      buttonRandom: true,
      isWeightedRandom: true,
    };
    const app = appWith({ rows: [row] });
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const state = activateRowButton(row, buildCyoaIndex(app), createCyoaState(app));
      expect([...state.activated.keys()]).toEqual(["eligible"]);
    } finally {
      random.mockRestore();
    }
  });

  it.each([false, true])(
    "applies variable effects for random selection (counter: %s)",
    (counter) => {
      const choice = makeChoice("switch", {
        isSelectableMultiple: counter,
        allowSelectByClick: true,
        isChangeVariables: true,
        changeType: "3",
        changedVariables: ["flag"],
      });
      const row = { ...makeRow("row", [choice]), buttonRandom: true };
      const app = appWith({ rows: [row], variables: [{ id: "flag", isTrue: false } as never] });
      const idx = buildCyoaIndex(app);
      let state = activateRowButton(row, idx, createCyoaState(app));
      expect(state.variables.get("flag")).toBe(true);
      state = activateRowButton(row, idx, state);
      expect(state.variables.get("flag")).toBe(!counter);
      expect(state.activated.has("flag")).toBe(!counter);
    },
  );

  it("does not execute a button restricted to an empty row when choices are selected", () => {
    const row = {
      ...makeRow("row", [makeChoice("a")]),
      buttonRandom: true,
      onlyIfNoChoices: true,
    };
    const app = appWith({ rows: [row], activated: ["a"] });
    const state = createCyoaState(app);
    expect(activateRowButton(row, buildCyoaIndex(app), state)).toBe(state);
  });
});

describe("cyoa-engine counter metadata", () => {
  it.each(["more", "less"])(
    "retains linked activation metadata when selecting one %s",
    (operation) => {
      const choice = makeChoice("counter", { isSelectableMultiple: true });
      const row = makeRow("row", [choice]);
      const state = createCyoaState(appWith({ rows: [row] }));
      state.activated.set(choice.id, { multiple: 2, forcedFrom: 1 });
      state.currentChoices.set(row.id, 1);
      const next =
        operation === "more"
          ? selectOneMore(choice, row, state)
          : selectOneLess(choice, row, state);
      expect(next.activated.get(choice.id)).toEqual({
        multiple: operation === "more" ? 3 : 1,
        forcedFrom: 1,
      });
      expect(state.activated.get(choice.id)).toEqual({ multiple: 2, forcedFrom: 1 });
    },
  );
});

describe("cyoa-engine point modifiers", () => {
  function appWithPoints(points: Array<{ id: string; startingSum: number }>) {
    return appWith({
      pointTypes: points.map((p) => ({
        id: p.id,
        name: p.id,
        startingSum: p.startingSum,
        initValue: p.startingSum,
        beforeText: "",
        afterText: "",
        allowFloat: false,
      })) as never,
    });
  }

  it("multiplies a point type while the modifier choice is active", () => {
    const row = makeRow("row_1");
    const mod = makeChoice("choice_mod", {
      multiplyPointtypeIsOn: true,
      pointTypeToMultiply: ["pt_a"],
      multiplyWithThis: 3,
    });
    row.objects = [mod];
    const app = appWithPoints([{ id: "pt_a", startingSum: 10 }]);
    app.rows = [row];
    const idx = buildCyoaIndex(app);
    const state = createCyoaState(app);
    expect(computePointTotals(app, idx, state).get("pt_a")?.total).toBe(10);
    const next = selectChoice(mod, row, idx, state);
    expect(computePointTotals(app, idx, next).get("pt_a")?.total).toBe(30);
  });

  it("multiplies by another point's current total when multiplyPointtypeIsId", () => {
    const row = makeRow("row_1");
    const mod = makeChoice("choice_mod", {
      multiplyPointtypeIsOn: true,
      pointTypeToMultiply: ["pt_a"],
      multiplyPointtypeIsId: true,
      multiplyWithThis: "pt_b",
    });
    row.objects = [mod];
    const app = appWithPoints([
      { id: "pt_a", startingSum: 10 },
      { id: "pt_b", startingSum: 4 },
    ]);
    app.rows = [row];
    const idx = buildCyoaIndex(app);
    const next = selectChoice(mod, row, idx, createCyoaState(app));
    expect(computePointTotals(app, idx, next).get("pt_a")?.total).toBe(40);
  });

  it("divides and sets point totals", () => {
    const row = makeRow("row_1");
    const div = makeChoice("choice_div", {
      dividePointtypeIsOn: true,
      pointTypeToDivide: ["pt_a"],
      divideWithThis: 2,
    });
    const set = makeChoice("choice_set", {
      setPointtypeIsOn: true,
      pointTypeToSet: ["pt_a"],
      setWithThis: "{pt_b} + 1",
    });
    row.objects = [div, set];
    const app = appWithPoints([
      { id: "pt_a", startingSum: 10 },
      { id: "pt_b", startingSum: 5 },
    ]);
    app.rows = [row];
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    state = selectChoice(div, row, idx, state);
    expect(computePointTotals(app, idx, state).get("pt_a")?.total).toBe(5);
    state = selectChoice(set, row, idx, state);
    expect(computePointTotals(app, idx, state).get("pt_a")?.total).toBe(6); // {pt_b}+1
  });
});

describe("cyoa-engine allowed-choices and counts", () => {
  it("ignores repeated single-select and deselect requests without changing counts", () => {
    const choice = makeChoice("a");
    const row = makeRow("row", [choice]);
    const app = appWith({ rows: [row] });
    const idx = buildCyoaIndex(app);
    const empty = createCyoaState(app);
    const selected = selectChoice(choice, row, idx, empty);

    expect(selectChoice(choice, row, idx, selected)).toBe(selected);
    expect(deselectChoice(choice, row, empty)).toBe(empty);
    expect(selected.currentChoices.get(row.id)).toBe(1);
    expect(empty.currentChoices.get(row.id)).toBe(0);
  });

  it("addToAllowChoice raises the target row's effective limit", () => {
    const row = makeRow("row_1");
    const grant = makeChoice("choice_grant", {
      addToAllowChoice: true,
      idOfAllowChoice: ["row_1"],
      numbAddToAllowChoice: 1,
    });
    const a = makeChoice("choice_a");
    const b = makeChoice("choice_b");
    row.allowedChoices = 1;
    row.objects = [grant, a, b];
    const app = appWith({ rows: [row] });
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    state = selectChoice(grant, row, idx, state);
    expect(rowAllowedChoices(row, idx, state)).toBe(2);
    // With the grant active, two normal choices fit.
    state = selectChoice(a, row, idx, state);
    state = selectChoice(b, row, idx, state);
    expect(state.activated.has("choice_a")).toBe(true);
    expect(state.activated.has("choice_b")).toBe(true);
  });

  it("isCountDisabled choices don't count toward the row limit", () => {
    const row = makeRow("row_1");
    const free = makeChoice("choice_free", { isCountDisabled: true });
    const a = makeChoice("choice_a");
    row.allowedChoices = 1;
    row.objects = [free, a];
    const app = appWith({ rows: [row] });
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    state = selectChoice(free, row, idx, state);
    state = selectChoice(a, row, idx, state);
    expect(state.activated.has("choice_free")).toBe(true);
    expect(state.activated.has("choice_a")).toBe(true);
  });

  it("does not displace a full row when selecting a choice excluded from its limit", () => {
    const a = makeChoice("choice_a");
    const free = makeChoice("choice_free", { isCountDisabled: true });
    const row = makeRow("row_1", [a, free]);
    row.allowedChoices = 1;
    const app = appWith({ rows: [row] });
    const idx = buildCyoaIndex(app);
    const selected = selectChoice(a, row, idx, createCyoaState(app));
    const next = selectChoice(free, row, idx, selected);

    expect([...next.activated.keys()]).toEqual([a.id, free.id]);
  });

  it("counts a multi-select's row-limit increase only once", () => {
    const a = makeChoice("choice_a");
    const b = makeChoice("choice_b");
    const grant = makeChoice("choice_grant", {
      isSelectableMultiple: true,
      addToAllowChoice: true,
      idOfAllowChoice: ["row_1"],
      numbAddToAllowChoice: 1,
    });
    const row = makeRow("row_1", [a, b, grant]);
    row.allowedChoices = 2;
    const app = appWith({ rows: [row] });
    const idx = buildCyoaIndex(app);
    let state = selectChoice(a, row, idx, createCyoaState(app));
    state = selectChoice(b, row, idx, state);
    // The author reduces the base allowance; the grant makes room for two,
    // not three, choices when it is selected.
    row.allowedChoices = 1;
    state = selectOneMore(grant, row, state, idx);

    expect(rowAllowedChoices(row, idx, state, grant)).toBe(2);
    expect([...state.activated.keys()]).toEqual([b.id, grant.id]);
  });
});

describe("cyoa-engine groups are namespaces (parity with ICCPlus)", () => {
  it("does NOT auto-deselect same-group choices (exclusivity comes from not-requirements)", () => {
    // The original ICCPlus viewer has no automatic group exclusivity — groups
    // tag choices for requirements/effects, and legacy documents use them as
    // namespaces that span rows (e.g. the SleepersDream "Dream1" group).
    const a = makeChoice("choice_a", { groups: ["group_1"] });
    const b = makeChoice("choice_b", { groups: ["group_1"] });
    const row = makeRow("row_1", [a, b]);
    const app = appWith({
      rows: [row],
      groups: [
        { id: "group_1", name: "G", elements: ["choice_a", "choice_b"], rowElements: [] } as never,
      ],
    });
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    state = selectChoice(a, row, idx, state);
    state = selectChoice(b, row, idx, state);
    // Both stay selected; a real "not selected" requirement would exclude
    // them instead (enforced by the viewer's missing-requirement cascade).
    expect(state.activated.has("choice_a")).toBe(true);
    expect(state.activated.has("choice_b")).toBe(true);
  });

  it("keeps chained choices active across rows (no chain collapse)", () => {
    // A row-gated dream chain: each stage is a choice in a group that spans
    // many rows; selecting a later stage must not deselect earlier ones.
    const sleep = makeChoice("choice_sleep", { groups: ["dream1"] });
    const stage1 = makeChoice("choice_stage1", { groups: ["dream1"] });
    const stage2 = makeChoice("choice_stage2", { groups: ["dream1"] });
    const row0 = makeRow("row_0", [sleep]);
    const row1 = makeRow("row_1", [stage1]);
    const row2 = makeRow("row_2", [stage2]);
    const app = appWith({
      rows: [row0, row1, row2],
      groups: [{ id: "dream1", name: "Dream1", elements: [], rowElements: [] } as never],
    });
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    state = selectChoice(sleep, row0, idx, state);
    state = selectChoice(stage1, row1, idx, state);
    state = selectChoice(stage2, row2, idx, state);
    expect(state.activated.has("choice_sleep")).toBe(true);
    expect(state.activated.has("choice_stage1")).toBe(true);
    expect(state.activated.has("choice_stage2")).toBe(true);
    expect(state.currentChoices.get("row_0")).toBe(1);
    expect(state.currentChoices.get("row_1")).toBe(1);
    expect(state.currentChoices.get("row_2")).toBe(1);
  });

  it("keeps chained exclusive choices active instead of deselecting both (softlock)", () => {
    const base = makeChoice("choice_base", { groups: ["group_1"] });
    const upgrade = makeChoice("choice_upgrade", {
      groups: ["group_1"],
      requireds: [idReq("choice_base")],
    });
    const row = makeRow("row_1", [base, upgrade]);
    const app = appWith({ rows: [row] });
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    state = selectChoice(base, row, idx, state);
    state = selectChoice(upgrade, row, idx, state);
    expect(state.activated.has("choice_base")).toBe(true);
    expect(state.activated.has("choice_upgrade")).toBe(true);
  });

  it("keeps deep chains active (C requires B requires A)", () => {
    const a = makeChoice("choice_a", { groups: ["group_1"] });
    const b = makeChoice("choice_b", {
      groups: ["group_1"],
      requireds: [idReq("choice_a")],
    });
    const c = makeChoice("choice_c", {
      groups: ["group_1"],
      requireds: [idReq("choice_b")],
    });
    const row = makeRow("row_1", [a, b, c]);
    const app = appWith({ rows: [row] });
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    state = selectChoice(a, row, idx, state);
    state = selectChoice(b, row, idx, state);
    state = selectChoice(c, row, idx, state);
    expect(state.activated.has("choice_a")).toBe(true);
    expect(state.activated.has("choice_b")).toBe(true);
    expect(state.activated.has("choice_c")).toBe(true);
  });
});

describe("cyoa-engine cascading variable effects", () => {
  it.each([1, 2, 3])("undoes toggle effects for %s removed counter copies", (count) => {
    const choice = makeChoice("toggle", {
      isSelectableMultiple: true,
      isChangeVariables: true,
      changeType: "3",
      changedVariables: ["flag"],
      requireds: [idReq("missing")],
    });
    const row = makeRow("row", [choice]);
    const app = appWith({ rows: [row], variables: [{ id: "flag", isTrue: false } as never] });
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    for (let i = 0; i < count; i++) {
      state = applyChoiceVariables(selectOneMore(choice, row, state, idx), choice, idx, true);
    }
    const next = applyMissingReqCascade(state, idx);
    expect(next.variables.get("flag")).toBe(false);
    expect(next.activated.has("flag")).toBe(false);
    expect(next.activated.has(choice.id)).toBe(false);
    expect(next.currentChoices.get(row.id)).toBe(0);
  });

  it("restores a variable switched off by a removed choice", () => {
    const choice = makeChoice("switch-off", {
      isChangeVariables: true,
      changeType: "2",
      changedVariables: ["flag"],
      requireds: [idReq("missing")],
    });
    const row = makeRow("row", [choice]);
    const app = appWith({ rows: [row], variables: [{ id: "flag", isTrue: true } as never] });
    const idx = buildCyoaIndex(app);
    const state = selectChoice(choice, row, idx, createCyoaState(app));
    expect(state.variables.get("flag")).toBe(false);
    const next = applyMissingReqCascade(state, idx);
    expect(next.variables.get("flag")).toBe(true);
    expect(next.activated.has("flag")).toBe(true);
  });
});

describe("cyoa-engine linked activation", () => {
  it("releases the recorded random target count rather than the current configured count", () => {
    const target = makeChoice("target", {
      isSelectableMultiple: true,
      isMultipleUseVariable: true,
    });
    const activator = makeChoice("activator", {
      activateOtherChoice: true,
      activateThisChoice: "target/ON#1",
      isActivateRandom: true,
      numActivateRandom: 1,
    });
    const row = makeRow("row", [target, activator]);
    const app = appWith({ rows: [row] });
    const idx = buildCyoaIndex(app);
    const state = applyActivateOther(createCyoaState(app), activator, idx, ["target/ON#3"]);
    expect(state.activated.get(target.id)?.multiple).toBe(3);
    const released = applyDeselectActivateOther(state, activator, idx);
    expect(released.activated.has(target.id)).toBe(false);
    expect(released.currentChoices.get(row.id)).toBe(0);
  });

  it("does not release unrelated targets when the recorded random selection is empty", () => {
    const target = makeChoice("target");
    const activator = makeChoice("activator", {
      activateOtherChoice: true,
      activateThisChoice: target.id,
      isActivateRandom: true,
      numActivateRandom: 0,
    });
    const row = makeRow("row", [target, activator]);
    const app = appWith({ rows: [row] });
    const idx = buildCyoaIndex(app);
    let state = selectChoice(target, row, idx, createCyoaState(app));
    state = applyActivateOther(state, activator, idx);
    const released = applyDeselectActivateOther(state, activator, idx);
    expect(released.activated.has(target.id)).toBe(true);
  });

  it.each([false, true])(
    "releases chained activations while preserving a previously selected middle choice (%s)",
    (middleWasSelected) => {
      const c = makeChoice("c");
      const b = makeChoice("b", { activateOtherChoice: true, activateThisChoice: c.id });
      const a = makeChoice("a", { activateOtherChoice: true, activateThisChoice: b.id });
      const row = makeRow("row", [a, b, c]);
      const app = appWith({ rows: [row] });
      const idx = buildCyoaIndex(app);
      let state = createCyoaState(app);
      if (middleWasSelected) {
        state = selectChoice(b, row, idx, state);
        state = applyActivateOther(state, b, idx);
      }
      state = selectChoice(a, row, idx, state);
      state = applyActivateOther(state, a, idx);
      state = deselectChoice(a, row, state);
      const released = applyDeselectActivateOther(state, a, idx);

      expect(released.activated.has(b.id)).toBe(middleWasSelected);
      expect(released.activated.has(c.id)).toBe(middleWasSelected);
      expect(released.activated.get(c.id)?.forcedFrom ?? 0).toBe(middleWasSelected ? 1 : 0);
      expect(released.currentChoices.get(row.id)).toBe(middleWasSelected ? 2 : 0);
    },
  );

  it("releases recorded random targets in a linked chain", () => {
    const c = makeChoice("c");
    const d = makeChoice("d");
    const b = makeChoice("b", {
      activateOtherChoice: true,
      activateThisChoice: "c,d",
      isActivateRandom: true,
      numActivateRandom: 1,
    });
    const a = makeChoice("a", { activateOtherChoice: true, activateThisChoice: b.id });
    const row = makeRow("row", [a, b, c, d]);
    const app = appWith({ rows: [row] });
    const idx = buildCyoaIndex(app);
    let state = selectChoice(a, row, idx, createCyoaState(app));
    state = applyActivateOther(state, a, idx);
    state = deselectChoice(a, row, state);
    const released = applyDeselectActivateOther(state, a, idx);

    expect(released.activated.size).toBe(0);
    expect(released.activatedRandom.size).toBe(0);
    expect(state.activatedRandom.get(b.id)?.[0]).toHaveLength(1);
  });

  it("releases a cyclic chain without recursing back into its starting choice", () => {
    const a = makeChoice("a", { activateOtherChoice: true, activateThisChoice: "b" });
    const b = makeChoice("b", { activateOtherChoice: true, activateThisChoice: "a" });
    const row = makeRow("row", [a, b]);
    const app = appWith({ rows: [row] });
    const idx = buildCyoaIndex(app);
    let state = selectChoice(a, row, idx, createCyoaState(app));
    state = applyActivateOther(state, a, idx);
    state = deselectChoice(a, row, state);

    expect(applyDeselectActivateOther(state, a, idx).activated.size).toBe(0);
  });

  it("keeps a manual selection's snapshot when an unrelated activation runs", () => {
    const target = makeChoice("target");
    const other = makeChoice("other");
    const a = makeChoice("a", { activateOtherChoice: true, activateThisChoice: target.id });
    const b = makeChoice("b", { activateOtherChoice: true, activateThisChoice: other.id });
    const row = makeRow("row", [target, other, a, b]);
    const app = appWith({ rows: [row] });
    const idx = buildCyoaIndex(app);
    let state = selectChoice(target, row, idx, createCyoaState(app));
    state = applyActivateOther(state, a, idx);
    state = applyActivateOther(state, b, idx);
    state = applyDeselectActivateOther(state, a, idx);

    expect(state.activated.get(target.id)).toEqual({ multiple: 0 });
    expect(state.activated.has(other.id)).toBe(true);
  });

  it.each([false, true])(
    "releases a shared target correctly (initially selected: %s)",
    (initiallySelected) => {
      const target = makeChoice("target");
      const a = makeChoice("a", { activateOtherChoice: true, activateThisChoice: target.id });
      const b = makeChoice("b", { activateOtherChoice: true, activateThisChoice: target.id });
      const row = makeRow("row", [target, a, b]);
      const app = appWith({ rows: [row] });
      const idx = buildCyoaIndex(app);
      let state = createCyoaState(app);
      if (initiallySelected) state = selectChoice(target, row, idx, state);
      state = applyActivateOther(state, a, idx);
      state = applyActivateOther(state, b, idx);
      const oneReleased = applyDeselectActivateOther(state, a, idx);
      expect(state.activated.get(target.id)?.forcedFrom).toBe(2);
      expect(oneReleased.activated.get(target.id)?.forcedFrom).toBe(1);
      const allReleased = applyDeselectActivateOther(oneReleased, b, idx);

      expect(allReleased.activated.has(target.id)).toBe(initiallySelected);
      expect(allReleased.activated.get(target.id)?.forcedFrom ?? 0).toBe(0);
      expect(allReleased.tmpActivated.size).toBe(0);
    },
  );

  it("does not deselect targets when the activator opted out of forcing them", () => {
    const target = makeChoice("target");
    const a = makeChoice("a", {
      activateOtherChoice: true,
      activateThisChoice: target.id,
      isAllowDeselect: true,
    });
    const row = makeRow("row", [target, a]);
    const app = appWith({ rows: [row] });
    const idx = buildCyoaIndex(app);
    let state = selectChoice(target, row, idx, createCyoaState(app));
    state = applyActivateOther(state, a, idx);
    const released = applyDeselectActivateOther(state, a, idx);

    expect(released.activated.has(target.id)).toBe(true);
  });

  it("clears a multi-select target's force lock after releasing its last activator", () => {
    const target = makeChoice("target", {
      isSelectableMultiple: true,
      isMultipleUseVariable: true,
    });
    const a = makeChoice("a", { activateOtherChoice: true, activateThisChoice: target.id });
    const row = makeRow("row", [target, a]);
    const app = appWith({ rows: [row] });
    const idx = buildCyoaIndex(app);
    let state = selectOneMore(target, row, createCyoaState(app), idx);
    state = applyActivateOther(state, a, idx);
    state = applyDeselectActivateOther(state, a, idx);

    expect(state.activated.get(target.id)?.multiple).toBe(1);
    expect(state.activated.get(target.id)?.forcedFrom ?? 0).toBe(0);
    const remover = makeChoice("remove", {
      deactivateOtherChoice: true,
      deactivateThisChoice: target.id,
    });
    expect(applyDeactivateOther(state, remover, idx).activated.has(target.id)).toBe(false);
  });

  it("activateOtherChoice force-selects targets and releases them on deselect", () => {
    const rowA = makeRow("row_a");
    const a = makeChoice("choice_a", {
      activateOtherChoice: true,
      activateThisChoice: "choice_b",
    });
    rowA.objects = [a];
    const rowB = makeRow("row_b");
    const b = makeChoice("choice_b");
    rowB.objects = [b];
    const app = appWith({ rows: [rowA, rowB] });
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    state = selectChoice(a, rowA, idx, state);
    state = applyActivateOther(state, a, idx);
    expect(state.activated.has("choice_b")).toBe(true);
    // Deselecting A releases B.
    state = applyDeselectActivateOther(state, a, idx);
    expect(state.activated.has("choice_b")).toBe(false);
  });

  it("restores a target that was already active before the activator", () => {
    const rowA = makeRow("row_a");
    const a = makeChoice("choice_a", {
      activateOtherChoice: true,
      activateThisChoice: "choice_b",
    });
    rowA.objects = [a];
    const rowB = makeRow("row_b");
    const b = makeChoice("choice_b");
    rowB.objects = [b];
    const app = appWith({ rows: [rowA, rowB] });
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    state = selectChoice(b, rowB, idx, state);
    state = selectChoice(a, rowA, idx, state);
    state = applyActivateOther(state, a, idx);
    expect(state.activated.has("choice_b")).toBe(true);
    state = applyDeselectActivateOther(state, a, idx);
    // B stays selected: it was active before A activated it.
    expect(state.activated.has("choice_b")).toBe(true);
  });

  it("activateThisChoice supports group ids and /ON# counts for multi targets", () => {
    const rowA = makeRow("row_a");
    const a = makeChoice("choice_a", {
      activateOtherChoice: true,
      activateThisChoice: "group_1/ON#2",
    });
    rowA.objects = [a];
    const rowB = makeRow("row_b");
    const b = makeChoice("choice_b", {
      isSelectableMultiple: true,
      isMultipleUseVariable: true,
      numMultipleTimesPluss: 5,
    });
    rowB.objects = [b];
    const app = appWith({
      rows: [rowA, rowB],
      groups: [{ id: "group_1", name: "G", elements: ["choice_b"], rowElements: [] } as never],
    });
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    state = selectChoice(a, rowA, idx, state);
    state = applyActivateOther(state, a, idx);
    expect(state.activated.get("choice_b")?.multiple).toBe(2);
    state = applyDeselectActivateOther(state, a, idx);
    expect(state.activated.has("choice_b")).toBe(false);
  });

  it("deactivateOtherChoice deselects the listed targets", () => {
    const rowA = makeRow("row_a");
    const a = makeChoice("choice_a", {
      deactivateOtherChoice: true,
      deactivateThisChoice: "choice_b",
    });
    rowA.objects = [a];
    const rowB = makeRow("row_b");
    const b = makeChoice("choice_b");
    rowB.objects = [b];
    const app = appWith({ rows: [rowA, rowB] });
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    state = selectChoice(b, rowB, idx, state);
    state = selectChoice(a, rowA, idx, state);
    state = applyDeactivateOther(state, a, idx);
    expect(state.activated.has("choice_b")).toBe(false);
  });

  it("random activation picks round-trip through encode/load with /RND#", () => {
    const rowA = makeRow("row_a");
    const a = makeChoice("choice_a", {
      activateOtherChoice: true,
      activateThisChoice: "choice_b,choice_c",
      isActivateRandom: true,
      numActivateRandom: 1,
    });
    rowA.objects = [a];
    const rowB = makeRow("row_b");
    const b = makeChoice("choice_b");
    const c = makeChoice("choice_c");
    rowB.objects = [b, c];
    const app = appWith({ rows: [rowA, rowB] });
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    state = selectChoice(a, rowA, idx, state);
    state = applyActivateOther(state, a, idx);
    const picked = state.activatedRandom.get("choice_a")?.[0];
    expect(picked?.length).toBe(1);
    expect(state.activated.has(picked![0])).toBe(true);

    const code = encodeBuildCode(app, idx, state);
    expect(code).toContain("/RND#");
    const loaded = loadBuildCode(code, app, idx);
    // The recorded pick is restored and its target re-activated.
    const restored = loaded.activatedRandom.get("choice_a")?.[0];
    expect(restored).toEqual(picked);
    expect(loaded.activated.has(picked![0])).toBe(true);
    // Deselecting the loaded session releases exactly the picked target.
    const released = applyDeselectActivateOther(loaded, a, idx);
    expect(released.activated.has(picked![0])).toBe(false);
    const other = picked![0] === "choice_b" ? "choice_c" : "choice_b";
    expect(released.activated.has(other)).toBe(false);
  });

  it("multi random activators keep per-count picks (activatedRandomMul)", () => {
    const rowA = makeRow("row_a");
    const a = makeChoice("choice_a", {
      activateOtherChoice: true,
      activateThisChoice: "choice_b,choice_c",
      isActivateRandom: true,
      numActivateRandom: 1,
      isSelectableMultiple: true,
      isMultipleUseVariable: true,
      numMultipleTimesPluss: 5,
    });
    rowA.objects = [a];
    const rowB = makeRow("row_b");
    const b = makeChoice("choice_b", {
      isSelectableMultiple: true,
      isMultipleUseVariable: true,
      numMultipleTimesPluss: 5,
    });
    const c = makeChoice("choice_c", {
      isSelectableMultiple: true,
      isMultipleUseVariable: true,
      numMultipleTimesPluss: 5,
    });
    rowB.objects = [b, c];
    const app = appWith({ rows: [rowA, rowB] });
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    // Count 1
    state = selectOneMore(a, rowA, state, idx);
    state = applyActivateOther(state, a, idx);
    // Count 2
    state = selectOneMore(a, rowA, state, idx);
    state = applyActivateOther(state, a, idx);
    const perCount = state.activatedRandom.get("choice_a");
    expect(perCount?.length).toBe(2);
    expect(perCount![0]?.length).toBe(1);
    expect(perCount![1]?.length).toBe(1);
    // Deselecting count 2 releases only count-2's pick. When the RNG picked
    // the same target for both counts, releasing count 2 leaves one pick
    // (the target stays at multiple 1) — the release is per count, not per
    // target.
    const released = applyDeselectActivateOther(state, a, idx, 2);
    const pick2 = perCount![1][0];
    const pick1 = perCount![0][0];
    if (pick1 !== pick2) {
      expect(released.activated.has(pick2)).toBe(false);
      expect(released.activated.has(pick1)).toBe(true);
    } else {
      expect(released.activated.get(pick1)?.multiple).toBe(1);
    }
  });

  it("picksOverride replays recorded picks without re-randomizing", () => {
    const rowA = makeRow("row_a");
    const a = makeChoice("choice_a", {
      activateOtherChoice: true,
      activateThisChoice: "choice_b,choice_c",
      isActivateRandom: true,
      numActivateRandom: 1,
    });
    rowA.objects = [a];
    const rowB = makeRow("row_b");
    const b = makeChoice("choice_b");
    const c = makeChoice("choice_c");
    rowB.objects = [b, c];
    const app = appWith({ rows: [rowA, rowB] });
    const idx = buildCyoaIndex(app);
    const state = selectChoice(a, rowA, idx, createCyoaState(app));
    const next = applyActivateOther(state, a, idx, ["choice_c"]);
    expect(next.activated.has("choice_c")).toBe(true);
    expect(next.activated.has("choice_b")).toBe(false);
    expect(next.activatedRandom.get("choice_a")?.[0]).toEqual(["choice_c"]);
  });
});

describe("cyoa-engine per-score discounts", () => {
  function discountedApp(): {
    app: ReturnType<typeof appWith>;
    row: Row;
    discount: Choice;
    target: Choice;
  } {
    const row = makeRow("row_main");
    const discount = makeChoice("choice_dis", {
      discountOther: true,
      discountOperator: "-",
      discountValue: 2,
      discountShow: true,
      discountBeforeText: "Was",
      discountAfterText: "now",
    });
    const target = makeChoice("choice_target", {
      scores: [
        {
          idx: "s0",
          id: "pt_a",
          type: "pt_a",
          value: 10,
          requireds: [],
          beforeText: "Cost:",
          afterText: "gold",
          showScore: true,
          // Stale runtime record from a saved ICCPlus session:
          discounts: [
            {
              id: "choice_dis",
              state: 1, // ACTIVE
              stackable: false,
              stack: 1,
              operator: "-",
              value: 2,
              count: -1,
              useLowLimit: false,
              lowLimit: -1,
              showDiscount: true,
              beforeText: "Was",
              afterText: "now",
              replaceText: false,
              consolidate: false,
              hideValue: false,
              hideIcon: false,
            } as never,
          ],
        },
      ],
    });
    row.objects = [discount, target];
    const app = appWith({
      rows: [row],
      pointTypes: [
        {
          id: "pt_a",
          name: "A",
          startingSum: 0,
          initValue: 0,
          beforeText: "Cost:",
          afterText: "gold",
        } as never,
      ],
    });
    return { app, row, discount, target };
  }

  it("stale per-score discounts are not double-applied when the choice-level path covers them", () => {
    const { app, row, discount, target } = discountedApp();
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    state = selectChoice(discount, row, idx, state);
    state = selectChoice(target, row, idx, state);
    // 10 - 2 = 8 once (not 10 - 2 - 2 = 6).
    expect(computeScoreNet(target, 0, target.scores[0], idx, state, 0)).toBe(8);
  });

  it("per-score discounts apply only while their discounting choice is active", () => {
    const { app, row, discount, target } = discountedApp();
    // Remove the choice-level flag so only the per-score record matters.
    (discount as unknown as Record<string, unknown>).discountOther = undefined;
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    state = selectChoice(target, row, idx, state);
    // Discounting choice not selected -> no discount.
    expect(computeScoreNet(target, 0, target.scores[0], idx, state, 0)).toBe(10);
    state = selectChoice(discount, row, idx, state);
    expect(computeScoreNet(target, 0, target.scores[0], idx, state, 0)).toBe(8);
  });

  it("INACTIVE per-score entries are ignored", () => {
    const { app, row, discount, target } = discountedApp();
    (discount as unknown as Record<string, unknown>).discountOther = undefined;
    target.scores[0].discounts![0].state = 0; // INACTIVE
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    state = selectChoice(target, row, idx, state);
    state = selectChoice(discount, row, idx, state);
    expect(computeScoreNet(target, 0, target.scores[0], idx, state, 0)).toBe(10);
  });
});

describe("cyoa-engine hidden contents", () => {
  it("hiddenContentsFor reports active hide flags per row", () => {
    const rowA = makeRow("row_a");
    const a = makeChoice("choice_a", {
      isContentHidden: true,
      hiddenContentsRow: ["row_b"],
      hiddenContentsType: ["1", "3"],
    });
    rowA.objects = [a];
    const rowB = makeRow("row_b");
    const b = makeChoice("choice_b");
    rowB.objects = [b];
    const app = appWith({ rows: [rowA, rowB] });
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    expect(hiddenContentsFor(rowB, idx, state).size).toBe(0);
    state = selectChoice(a, rowA, idx, state);
    const flags = hiddenContentsFor(rowB, idx, state);
    expect(flags.has("1")).toBe(true);
    expect(flags.has("3")).toBe(true);
    expect(flags.has("2")).toBe(false);
  });
});

describe("cyoa-engine duplicate rows", () => {
  it("assigns unique ids to duplications before the lookup index is rebuilt", () => {
    const row = makeRow("source", [makeChoice("choice")]);
    const trigger = makeChoice("duplicate", {
      duplicateRow: true,
      duplicateRowId: row.id,
      duplicateRowPlace: row.id,
    });
    const app = appWith({ rows: [row, makeRow("controls", [trigger])] });
    const idx = buildCyoaIndex(app);
    let state = applyDuplicateRow(createCyoaState(app), trigger, idx);
    state = applyDuplicateRow(state, trigger, idx);
    expect(state.dupRows.map((copy) => copy.id)).toEqual(["source/D#1", "source/D#2"]);
  });

  it.each([false, true])(
    "copies addon effects and image requirements with the configured references (keep originals: %s)",
    (keepOriginals) => {
      const app = appWith({});
      const addon: SelectableAddon = {
        ...createDefaultAddon(app),
        isSelectable: true,
        groups: [],
        multipleUseVariable: 0,
        isActive: false,
        activateOtherChoice: true,
        activateThisChoice: "target",
        scores: [{ ...createDefaultScore("gold"), value: 1, requireds: [idReq("target")] }],
      };
      const choice = makeChoice("parent", {
        addons: [addon],
        imageVariants: [
          { id: "variant", image: "portrait", priority: 0, requireds: [idReq(addon.id)] },
        ],
      });
      const row = makeRow("source", [choice, makeChoice("target")]);
      const trigger = makeChoice("duplicate", {
        duplicateRow: true,
        duplicateRowId: row.id,
        duplicateRowPlace: row.id,
        dRowAddSufReq: keepOriginals,
        dRowAddSufFunc: keepOriginals,
      });
      app.rows = [row, makeRow("controls", [trigger])];
      const next = applyDuplicateRow(createCyoaState(app), trigger, buildCyoaIndex(app));
      const copy = next.dupRows[0].objects[0];
      const suffix = keepOriginals ? "" : "/D#1";
      expect(copy.imageVariants?.[0].requireds[0].reqId).toBe(`${addon.id}${suffix}`);
      expect(copy.addons[0].scores[0].requireds[0].reqId).toBe(`target${suffix}`);
      expect(copy.addons[0].activateThisChoice).toBe(`target${suffix}`);
      expect(addon.activateThisChoice).toBe("target");
    },
  );

  it("gives duplicated addons their own ids and preserves original parent lookups", () => {
    const app = appWith({});
    const addon: SelectableAddon = {
      ...createDefaultAddon(app),
      isSelectable: true,
      scores: [],
      groups: [],
      multipleUseVariable: 0,
      isActive: false,
    };
    const choice = makeChoice("parent", { addons: [addon] });
    const row = makeRow("source", [choice]);
    const trigger = makeChoice("duplicate", {
      duplicateRow: true,
      duplicateRowId: row.id,
      duplicateRowPlace: row.id,
    });
    app.rows = [row, makeRow("controls", [trigger])];
    const next = applyDuplicateRow(createCyoaState(app), trigger, buildCyoaIndex(app));
    const duplicate = next.dupRows[0].objects[0].addons[0];
    expect(duplicate.id).toBe(`${addon.id}/D#1`);
    expect(duplicate.parentId).toBe("parent/D#1");
    const idx = buildCyoaIndex(app, next.dupRows);
    expect(idx.addonParentMap.get(addon.id)?.id).toBe("parent");
    expect(idx.addonParentMap.get(duplicate.id)?.id).toBe("parent/D#1");
  });

  it("duplicates a row with /D# ids and rewrites requirement refs", () => {
    const target = makeRow("row_dup_me");
    const c = makeChoice("choice_x", {
      requireds: [
        {
          required: true,
          requireds: [],
          orRequired: [],
          id: "1",
          type: "id",
          reqId: "choice_y",
          reqId1: "",
          reqId2: "",
          reqId3: "",
          reqPoints: 0,
          showRequired: true,
          afterText: "",
          beforeText: "",
        } as Requireds,
      ],
    });
    target.objects = [c];
    const place = makeRow("row_place");
    const rowA = makeRow("row_a");
    const trigger = makeChoice("choice_trig", {
      duplicateRow: true,
      duplicateRowId: "row_dup_me",
      duplicateRowPlace: "row_place",
    });
    rowA.objects = [trigger];
    const app = appWith({ rows: [rowA, place, target] });
    const idx = buildCyoaIndex(app);
    const state = createCyoaState(app);
    const next = applyDuplicateRow(state, trigger, idx);
    expect(next.dupRows.length).toBe(1);
    const dup = next.dupRows[0];
    // The original counts the source row itself, so the first dup is /D#1.
    expect(dup.id).toBe("row_dup_me/D#1");
    expect(dup.objects[0].id).toBe("choice_x/D#1");
    expect(dup.objects[0].requireds[0].reqId).toBe("choice_y/D#1");
    // The dup participates in lookups through the rebuilt index.
    const idx2 = buildCyoaIndex(app, next.dupRows);
    expect(idx2.choiceMap.has("choice_x/D#1")).toBe(true);
    expect(idx2.rowById.has("row_dup_me/D#1")).toBe(true);
    // `makeRow` gives every row index 0, so the stable sort appends the dup.
    expect(idx2.rows.map((r) => r.id)).toEqual([
      "row_a",
      "row_place",
      "row_dup_me",
      "row_dup_me/D#1",
    ]);
  });

  it("dRowAddSufReq=false keeps original requirement refs", () => {
    const target = makeRow("row_dup_me");
    const c = makeChoice("choice_x", {
      requireds: [
        {
          required: true,
          requireds: [],
          orRequired: [],
          id: "1",
          type: "id",
          reqId: "choice_y",
          reqId1: "",
          reqId2: "",
          reqId3: "",
          reqPoints: 0,
          showRequired: true,
          afterText: "",
          beforeText: "",
        } as Requireds,
      ],
    });
    target.objects = [c];
    const rowA = makeRow("row_a");
    const trigger = makeChoice("choice_trig", {
      duplicateRow: true,
      duplicateRowId: "row_dup_me",
      duplicateRowPlace: "row_dup_me",
      dRowAddSufReq: true,
      dRowAddSufFunc: true,
    });
    rowA.objects = [trigger];
    const app = appWith({ rows: [rowA, target] });
    const idx = buildCyoaIndex(app);
    const next = applyDuplicateRow(createCyoaState(app), trigger, idx);
    expect(next.dupRows[0].objects[0].requireds[0].reqId).toBe("choice_y");
  });

  it("second duplication gets /D#1 and stacked rows are counted", () => {
    const target = makeRow("row_dup_me");
    const rowA = makeRow("row_a");
    const trigger = makeChoice("choice_trig", {
      duplicateRow: true,
      duplicateRowId: "row_dup_me",
      duplicateRowPlace: "row_dup_me",
    });
    rowA.objects = [trigger];
    const app = appWith({ rows: [rowA, target] });
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    state = applyDuplicateRow(state, trigger, idx);
    const idx2 = buildCyoaIndex(app, state.dupRows);
    const next = applyDuplicateRow(state, trigger, idx2);
    expect(next.dupRows.length).toBe(2);
    expect(next.dupRows[1].id).toBe("row_dup_me/D#2");
  });
});

describe("cyoa-engine template/width/chrome overrides", () => {
  it("changeTemplates overrides the target's template (last selected wins)", () => {
    const rowB = makeRow("row_b");
    const b = makeChoice("choice_b", { template: 1 });
    rowB.objects = [b];
    const rowA = makeRow("row_a");
    const a1 = makeChoice("choice_a1", {
      changeTemplates: true,
      changeTemplatesList: "choice_b",
      changeToThisTemplate: 2,
    });
    const a2 = makeChoice("choice_a2", {
      changeTemplates: true,
      changeTemplatesList: "choice_b",
      changeToThisTemplate: 3,
    });
    rowA.objects = [a1, a2];
    const app = appWith({ rows: [rowA, rowB] });
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    state = selectChoice(a1, rowA, idx, state);
    expect(effectiveTemplate(b, false, idx, state)).toBe(2);
    state = selectChoice(a2, rowA, idx, state);
    expect(effectiveTemplate(b, false, idx, state)).toBe(3);
    // Deselecting the newest reverts to the previous override.
    state = deselectChoice(a2, rowA, state);
    expect(effectiveTemplate(b, false, idx, state)).toBe(2);
    state = deselectChoice(a1, rowA, state);
    expect(effectiveTemplate(b, false, idx, state)).toBe(1);
  });

  it("changeWidth supports group targets and rows", () => {
    const rowB = makeRow("row_b");
    const b = makeChoice("choice_b", { objectWidth: "col-12" });
    rowB.objects = [b];
    const rowA = makeRow("row_a");
    const a = makeChoice("choice_a", {
      changeWidth: true,
      changeWidthList: "group_1",
      changeToThisWidth: "col-sm-6",
    });
    rowA.objects = [a];
    const app = appWith({
      rows: [rowA, rowB],
      groups: [{ id: "group_1", name: "G", elements: ["choice_b"], rowElements: [] } as never],
    });
    const idx = buildCyoaIndex(app);
    const state = selectChoice(a, rowA, idx, createCyoaState(app));
    expect(effectiveWidth(b, false, idx, state)).toBe("col-sm-6");
    expect(widthOverrideFor(rowB, true, idx, state)).toBeUndefined();
  });

  it("pointBarOverrides and backgroundOverrides follow selection order", () => {
    const rowA = makeRow("row_a");
    const bg = makeChoice("choice_bg", {
      changeBackground: true,
      changeBgImage: false,
      changedBgColorCode: "#112233",
    });
    const bar = makeChoice("choice_bar", {
      changePointBar: true,
      changeBarBgColorIsOn: true,
      changedBarBgColor: "#445566",
      changeBarTextColorIsOn: true,
      changedBarTextColor: "#ffffff",
    });
    rowA.objects = [bg, bar];
    const app = appWith({ rows: [rowA] });
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    state = selectChoice(bg, rowA, idx, state);
    state = selectChoice(bar, rowA, idx, state);
    expect(backgroundOverrides(idx, state).color).toBe("#112233");
    expect(pointBarOverrides(idx, state).bgColor).toBe("#445566");
    expect(pointBarOverrides(idx, state).textColor).toBe("#ffffff");
  });
});

describe("cyoa-engine discount scope", () => {
  function appWithDiscount(): {
    app: ReturnType<typeof appWith>;
    row: Row;
    discount: Choice;
    target: Choice;
  } {
    const row = makeRow("row_main");
    const discount = makeChoice("choice_dis", {
      discountOther: true,
      discountOperator: "-",
      discountValue: 2,
      isDisChoices: true,
      discountChoices: ["choice_target"],
      discountLowLimitIsOn: true,
      discountLowLimit: 3,
    });
    const target = makeChoice("choice_target", {
      scores: [
        {
          idx: "s0",
          id: "pt_a",
          type: "pt_a",
          value: 10,
          requireds: [],
          beforeText: "",
          afterText: "",
          showScore: true,
        },
      ],
    });
    row.objects = [discount, target];
    const app = appWith({
      rows: [row],
      pointTypes: [
        {
          id: "pt_a",
          name: "A",
          startingSum: 0,
          initValue: 0,
          beforeText: "",
          afterText: "",
        } as never,
      ],
    });
    return { app, row, discount, target };
  }

  it("discountLowLimit clamps the discounted score", () => {
    const { app, row, discount, target } = appWithDiscount();
    // A large discount would drive the score below the floor.
    (discount as unknown as Record<string, unknown>).discountValue = 20;
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    state = selectChoice(discount, row, idx, state);
    state = selectChoice(target, row, idx, state);
    // 10 - 20 = -10, clamped to the low limit of 3.
    expect(computeScoreNet(target, 0, target.scores[0], idx, state, 0)).toBe(3);
  });

  it("discountRows scopes the discount to choices in the listed rows", () => {
    const rowOther = makeRow("row_other");
    const other = makeChoice("choice_other", {
      scores: [
        {
          idx: "s1",
          id: "pt_a",
          type: "pt_a",
          value: 10,
          requireds: [],
          beforeText: "",
          afterText: "",
          showScore: true,
        },
      ],
    });
    rowOther.objects = [other];
    const { app, row, discount } = appWithDiscount();
    (discount as unknown as Record<string, unknown>).discountRows = ["row_other"];
    (discount as unknown as Record<string, unknown>).discountChoices = undefined;
    app.rows = [row, rowOther];
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    state = selectChoice(discount, row, idx, state);
    // The target in row_main is NOT in the scoped row -> no discount.
    state = selectChoice(row.objects[1], row, idx, state);
    expect(computeScoreNet(row.objects[1], 0, row.objects[1].scores[0], idx, state, 0)).toBe(10);
    // The choice in row_other IS in scope.
    state = selectChoice(other, rowOther, idx, state);
    expect(computeScoreNet(other, 0, other.scores[0], idx, state, 0)).toBe(8);
  });

  it("useDiscountCount gates the discount until enough targets are selected", () => {
    const { app, row, discount } = appWithDiscount();
    const extra = makeChoice("choice_extra", {
      scores: [
        {
          idx: "s2",
          id: "pt_a",
          type: "pt_a",
          value: 10,
          requireds: [],
          beforeText: "",
          afterText: "",
          showScore: true,
        },
      ],
    });
    row.objects.push(extra);
    (discount as unknown as Record<string, unknown>).useDiscountCount = true;
    (discount as unknown as Record<string, unknown>).discountCount = 2;
    (discount as unknown as Record<string, unknown>).discountChoices = [
      "choice_target",
      "choice_extra",
    ];
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    state = selectChoice(discount, row, idx, state);
    // Only one target selected -> discount not yet active.
    state = selectChoice(row.objects[1], row, idx, state);
    expect(computeScoreNet(row.objects[1], 0, row.objects[1].scores[0], idx, state, 0)).toBe(10);
    // Second target selected -> discount now applies.
    state = selectChoice(extra, row, idx, state);
    expect(computeScoreNet(row.objects[1], 0, row.objects[1].scores[0], idx, state, 0)).toBe(8);
  });
});

describe("cyoa-engine missing-req cascade (deselectMissingReq parity)", () => {
  it("fully removes a dependency chain loaded in reverse order", () => {
    const gate = makeChoice("gate");
    const mid = makeChoice("mid", { requireds: [idReq(gate.id)] });
    const leaf = makeChoice("leaf", { requireds: [idReq(mid.id)] });
    const row = makeRow("row", [gate, mid, leaf]);
    const app = appWith({ rows: [row] });
    const idx = buildCyoaIndex(app);
    const loaded = loadBuildCode("leaf,mid,gate", app, idx);
    const state = deselectChoice(gate, row, loaded);

    const next = applyMissingReqCascade(state, idx);

    expect([...next.activated.keys()]).toEqual([]);
    expect(next.currentChoices.get(row.id)).toBe(0);
    expect([...state.activated.keys()]).toEqual([leaf.id, mid.id]);
  });

  it("releases linked targets when a single-select activator loses its requirement", () => {
    const gate = makeChoice("gate");
    const target = makeChoice("target");
    const activator = makeChoice("activator", {
      requireds: [idReq(gate.id)],
      activateOtherChoice: true,
      activateThisChoice: target.id,
    });
    const row = makeRow("row", [gate, activator, target]);
    const app = appWith({ rows: [row] });
    const idx = buildCyoaIndex(app);
    let state = selectChoice(gate, row, idx, createCyoaState(app));
    state = selectChoice(activator, row, idx, state);
    state = applyActivateOther(state, activator, idx);
    state = deselectChoice(gate, row, state);

    const next = applyMissingReqCascade(state, idx);

    expect([...next.activated.keys()]).toEqual([]);
    expect(next.currentChoices.get(row.id)).toBe(0);
  });

  it("removes choices whose prerequisites were deselected, cascading across rows", () => {
    const gate = makeChoice("choice_gate");
    const mid = makeChoice("choice_mid", { requireds: [idReq("choice_gate")] });
    const leaf = makeChoice("choice_leaf", { requireds: [idReq("choice_mid")] });
    const row0 = makeRow("row_0", [gate]);
    const row1 = makeRow("row_1", [mid]);
    const row2 = makeRow("row_2", [leaf]);
    const app = appWith({ rows: [row0, row1, row2] });
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    state = selectChoice(gate, row0, idx, state);
    state = selectChoice(mid, row1, idx, state);
    state = selectChoice(leaf, row2, idx, state);
    expect(state.activated.has("choice_leaf")).toBe(true);
    // Removing the gate un-mets mid's requirement, which in turn un-mets
    // leaf's — the cascade propagates through the chain.
    state = deselectChoice(gate, row0, state);
    state = applyMissingReqCascade(state, idx);
    expect(state.activated.has("choice_mid")).toBe(false);
    expect(state.activated.has("choice_leaf")).toBe(false);
    expect(state.currentChoices.get("row_1")).toBe(0);
    expect(state.currentChoices.get("row_2")).toBe(0);
  });

  it("skips the local choice during the pass; the caller's self-check pass removes it", () => {
    const gate = makeChoice("choice_gate");
    const self = makeChoice("choice_self", { requireds: [idReq("choice_gate")] });
    const row = makeRow("row_0", [gate, self]);
    const app = appWith({ rows: [row] });
    const idx = buildCyoaIndex(app);
    const state = createCyoaState(app);
    state.activated.set("choice_self", { multiple: 0 });
    state.currentChoices.set("row_0", 1);
    // The local (just-selected) choice is skipped by the pass itself...
    const skipped = applyMissingReqCascade(state, idx, "choice_self");
    expect(skipped.activated.has("choice_self")).toBe(true);
    // ...and the second, no-skip pass (end-of-selectObject self-check) removes
    // it when the selection un-met its own requirements.
    const final = applyMissingReqCascade(skipped, idx);
    expect(final.activated.has("choice_self")).toBe(false);
    expect(final.currentChoices.get("row_0")).toBe(0);
  });

  it("releases linked activations per count when a multi-select entry cascades out", () => {
    const gate = makeChoice("choice_gate");
    const multi = makeChoice("choice_multi", {
      isSelectableMultiple: true,
      isMultipleUseVariable: true,
      numMultipleTimesPluss: 5,
      requireds: [idReq("choice_gate")],
      activateOtherChoice: true,
      activateThisChoice: "choice_target",
    });
    const target = makeChoice("choice_target", {
      // The target's own requirements are unmet, so it is only ever active
      // through the activator's forced activation.
      requireds: [idReq("choice_never")],
    });
    const rowA = makeRow("row_a", [gate, multi]);
    const rowB = makeRow("row_b", [target]);
    const app = appWith({ rows: [rowA, rowB] });
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    state = selectChoice(gate, rowA, idx, state);
    // Two counts of the activator, each forcing the target (forcedFrom 2).
    state = selectOneMore(multi, rowA, state, idx);
    state = applyActivateOther(state, multi, idx);
    state = selectOneMore(multi, rowA, state, idx);
    state = applyActivateOther(state, multi, idx);
    expect(state.activated.get("choice_target")?.forcedFrom).toBe(2);
    // Removing the gate cascades the activator out count-by-count; both
    // forced links are released, so the unmet-requirement target goes too.
    state = deselectChoice(gate, rowA, state);
    state = applyMissingReqCascade(state, idx);
    expect(state.activated.has("choice_multi")).toBe(false);
    expect(state.activated.has("choice_target")).toBe(false);
  });

  it("removes choices whose point requirements are no longer met", () => {
    const gainer = makeChoice("choice_gain", {
      scores: [
        {
          idx: "0",
          id: "pt_gold",
          type: "pt_gold",
          value: -20, // gain of 20 (ICCPlus convention)
          beforeText: "",
          afterText: "",
          requireds: [],
          showScore: true,
        },
      ],
    });
    const spender = makeChoice("choice_spend", {
      requireds: [
        {
          required: true,
          requireds: [],
          orRequired: [],
          id: "2",
          type: "points",
          reqId: "pt_gold",
          operator: "2", // >=
          reqPoints: 10,
          reqId1: "",
          reqId2: "",
          reqId3: "",
          showRequired: true,
          afterText: "",
          beforeText: "",
        },
      ],
    });
    const row = makeRow("row_0", [gainer, spender]);
    const app = appWith({
      rows: [row],
      pointTypes: [
        {
          id: "pt_gold",
          name: "Gold",
          startingSum: 0,
          initValue: 0,
          beforeText: "",
          afterText: "",
        } as never,
      ],
    });
    const idx = buildCyoaIndex(app);
    let state = createCyoaState(app);
    state = selectChoice(gainer, row, idx, state);
    state = selectChoice(spender, row, idx, state);
    expect(state.activated.has("choice_spend")).toBe(true);
    // Without the gainer, the total drops back below the requirement.
    state = deselectChoice(gainer, row, state);
    state = applyMissingReqCascade(state, idx);
    expect(state.activated.has("choice_spend")).toBe(false);
  });

  it("leaves row-button and variable entries alone", () => {
    const gate = makeChoice("choice_gate");
    const row = makeRow("row_0", [gate]);
    const app = appWith({
      rows: [row],
      variables: [{ id: "var_1", isTrue: false } as never],
    });
    const idx = buildCyoaIndex(app);
    const state = createCyoaState(app);
    state.activated.set("row_0", { multiple: 0, isRowButton: true });
    state.activated.set("var_1", { multiple: 0, isVariable: true });
    state.activated.set("choice_gate", { multiple: 0 });
    const next = applyMissingReqCascade(state, idx);
    expect(next.activated.has("row_0")).toBe(true);
    expect(next.activated.has("var_1")).toBe(true);
  });
});
