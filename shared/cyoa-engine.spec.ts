import { describe, expect, it } from "vitest";

import { createDefaultApp } from "./cyoa.js";
import {
  activateRowButton,
  applyActivateOther,
  applyDeactivateOther,
  applyDeselectActivateOther,
  applyDuplicateRow,
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
  replaceText,
  rowAllowedChoices,
  selectChoice,
  selectOneMore,
  templateOverrideFor,
  widthOverrideFor,
} from "./cyoa-engine.js";
import type { Choice, Requireds, Row } from "./types.js";

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
  it("computes totals from starting sum and scores", () => {
    const row = makeRow("row_1");
    const choice = makeChoice("choice_a", {
      scores: [
        { idx: "0", id: "pt_gold", type: "pt_gold", value: 5, beforeText: "", afterText: "", requireds: [], showScore: true },
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
    expect(totals2.get("pt_gold")?.total).toBe(15);
  });

  it("scales scores by multiple count", () => {
    const row = makeRow("row_1");
    const choice = makeChoice("choice_a", {
      isSelectableMultiple: true,
      scores: [
        { idx: "0", id: "pt_gold", type: "pt_gold", value: 5, beforeText: "", afterText: "", requireds: [], showScore: true, multiplyByTimes: true },
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
    const totals = computePointTotals(app, idx, twice);
    expect(totals.get("pt_gold")?.total).toBe(15); // 5 * (|2| + 1)
  });
});

describe("cyoa-engine build codes", () => {
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
    expect(replaceText("Hello word_hero, welcome!", idx, state)).toBe(
      "Hello Hercules, welcome!",
    );
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
});

describe("cyoa-engine linked activation", () => {
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
    const b = makeChoice("choice_b", { isSelectableMultiple: true, isMultipleUseVariable: true, numMultipleTimesPluss: 5 });
    rowB.objects = [b];
    const app = appWith({ rows: [rowA, rowB], groups: [{ id: "group_1", name: "G", elements: ["choice_b"], rowElements: [] } as never] });
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
    const b = makeChoice("choice_b", { isSelectableMultiple: true, isMultipleUseVariable: true, numMultipleTimesPluss: 5 });
    const c = makeChoice("choice_c", { isSelectableMultiple: true, isMultipleUseVariable: true, numMultipleTimesPluss: 5 });
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
    // Deselecting count 2 releases only count-2's pick.
    const released = applyDeselectActivateOther(state, a, idx, 2);
    const pick2 = perCount![1][0];
    expect(released.activated.has(pick2)).toBe(false);
    const pick1 = perCount![0][0];
    if (pick1 !== pick2) expect(released.activated.has(pick1)).toBe(true);
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
  function discountedApp(): { app: ReturnType<typeof appWith>; row: Row; discount: Choice; target: Choice } {
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
      pointTypes: [{ id: "pt_a", name: "A", startingSum: 0, initValue: 0, beforeText: "Cost:", afterText: "gold" } as never],
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
    expect(idx2.rows.map((r) => r.id)).toEqual(["row_a", "row_place", "row_dup_me", "row_dup_me/D#1"]);
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
  function appWithDiscount(): { app: ReturnType<typeof appWith>; row: Row; discount: Choice; target: Choice } {
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
      scores: [{ idx: "s0", id: "pt_a", type: "pt_a", value: 10, requireds: [], beforeText: "", afterText: "", showScore: true }],
    });
    row.objects = [discount, target];
    const app = appWith({
      rows: [row],
      pointTypes: [{ id: "pt_a", name: "A", startingSum: 0, initValue: 0, beforeText: "", afterText: "" } as never],
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
      scores: [{ idx: "s1", id: "pt_a", type: "pt_a", value: 10, requireds: [], beforeText: "", afterText: "", showScore: true }],
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
      scores: [{ idx: "s2", id: "pt_a", type: "pt_a", value: 10, requireds: [], beforeText: "", afterText: "", showScore: true }],
    });
    row.objects.push(extra);
    (discount as unknown as Record<string, unknown>).useDiscountCount = true;
    (discount as unknown as Record<string, unknown>).discountCount = 2;
    (discount as unknown as Record<string, unknown>).discountChoices = ["choice_target", "choice_extra"];
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
