/**
 * CYOA runtime engine — a framework-agnostic port of the ICCPlus store's
 * core evaluation logic (store.svelte.ts). Pure functions over the App
 * document + a runtime state, so both the React viewer and the editor's
 * previews share one implementation.
 *
 * Runtime state (`CyoaState`) is deliberately separate from the App
 * document: the document is what authors edit; the state is what a player
 * session accumulates (selected choices, multiple counts, variables, rolled
 * score values, row-button state).
 */
import type {
  Addon,
  App,
  Choice,
  Group,
  PointType,
  Requireds,
  Row,
  Score,
  SelectableAddon,
  Variable,
  Word,
} from "./types.js";

// ---------------------------------------------------------------------------
// Runtime state
// ---------------------------------------------------------------------------

export interface ActivatedValue {
  /** Selection count for multi-select choices; 0 = single selection. */
  multiple: number;
  /** True when the entry was produced by a row button ("Point Type Sum Addon"). */
  isRowButton?: boolean;
  /** Point type id the row button rolled a random sum for. */
  rndPoint?: string;
  /** Rolled sum recorded by the row button. */
  pointNum?: number;
  /** True when the entry is a variable toggle rather than a choice. */
  isVariable?: boolean;
  /**
   * Linked-activation count: how many active choices (`activateOtherChoice`)
   * are keeping this entry activated. Drops to 0 when its activator is
   * deselected, restoring the pre-activation snapshot.
   */
  forcedFrom?: number;
}

export interface CyoaState {
  activated: Map<string, ActivatedValue>;
  variables: Map<string, boolean>;
  /** rowId -> number of currently selected choices in that row. */
  currentChoices: Map<string, number>;
  /** Rolled scores keyed by `${choiceId}:${scoreIdx}:${count}` (1-based).
   * Legacy `${choiceId}:${scoreIdx}` entries provide a fallback for all counts.
   */
  rolledScores: Map<string, number>;
  /** Whether each selected copy paid a requirement-gated score. */
  scoreActivations?: Map<string, boolean>;
  /** Text entered into word/textfield choices, keyed by word id. */
  wordValues: Map<string, string>;
  /** Uploaded image for image-upload choices, keyed by choice id. */
  uploadedImages: Map<string, string>;
  /** Point totals adjusted by row buttons (point id -> delta). */
  pointAdjustments: Map<string, number>;
  /**
   * Snapshot of the activated map taken before a linked activation ran, so a
   * target that was already active is restored (not removed) when its
   * activator is deselected.
   */
  tmpActivated: Map<string, ActivatedValue>;
  /**
   * For `isActivateRandom` activators: the exact target ids that were picked
   * (activator id -> picks per selection count, index = count - 1; single
   * activators use index 0). Mirrors the original `activatedRandom` /
   * `activatedRandomMul` runtime fields, so builds round-trip the picks.
   */
  activatedRandom: Map<string, string[][]>;
  /**
   * Rows created at runtime by `duplicateRow` choices. Cloned from the
   * document with `/D#n`-suffixed ids; the viewer renders them merged with
   * the document rows by `index`.
   */
  dupRows: Row[];
}

export function createCyoaState(app: App): CyoaState {
  const activated = new Map<string, ActivatedValue>();
  for (const id of app.activated ?? []) {
    if (typeof id === "string" && id) activated.set(id, { multiple: 0 });
  }
  const variables = new Map<string, boolean>();
  for (const variable of app.variables ?? []) {
    const value = variable.isTrue === true || activated.has(variable.id);
    variables.set(variable.id, value);
    if (value) activated.set(variable.id, { multiple: 0, isVariable: true });
  }
  const currentChoices = new Map<string, number>();
  for (const row of [...(app.rows ?? []), ...(app.backpack ?? [])]) {
    let count = 0;
    for (const choice of row.objects ?? []) {
      if (activated.has(choice.id) && countsTowardLimit(choice)) count++;
      for (const addon of choice.addons ?? []) {
        if (addon.isSelectable && activated.has(addon.id) && countsTowardLimit(addon)) count++;
      }
    }
    currentChoices.set(row.id, count);
  }
  return {
    activated,
    variables,
    currentChoices,
    rolledScores: new Map(),
    scoreActivations: new Map(),
    wordValues: new Map(),
    uploadedImages: new Map(),
    pointAdjustments: new Map(),
    tmpActivated: new Map(),
    activatedRandom: new Map(),
    dupRows: [],
  };
}

export interface CyoaIndex {
  app: App;
  /** All playable rows (document rows + runtime duplicate rows) by id. */
  rowById: Map<string, Row>;
  /** All playable rows ordered by `index` (document rows first, then dups). */
  rows: Row[];
  choiceMap: Map<string, { choice: Choice; row: Row }>;
  /** Containing choice for each selectable addon, including legacy addons without parentId. */
  addonParentMap: Map<string, Choice>;
  pointTypeMap: Map<string, PointType>;
  groupMap: Map<string, Group>;
  variableMap: Map<string, Variable>;
  wordMap: Map<string, Word>;
  globalReqMap: Map<string, Requireds[]>;
  /** id -> styling-carrying row design group */
  rowDesignMap: Map<
    string,
    { styling: Record<string, unknown>; activatedId?: string; [key: string]: unknown }
  >;
  objectDesignMap: Map<
    string,
    { styling: Record<string, unknown>; activatedId?: string; [key: string]: unknown }
  >;
}

export function buildCyoaIndex(app: App, dupRows: Row[] = []): CyoaIndex {
  const choiceMap = new Map<string, { choice: Choice; row: Row }>();
  const addonParentMap = new Map<string, Choice>();
  const pointTypeMap = new Map<string, PointType>();
  const groupMap = new Map<string, Group>();
  const variableMap = new Map<string, Variable>();
  const wordMap = new Map<string, Word>();
  const globalReqMap = new Map<string, Requireds[]>();
  const rowById = new Map<string, Row>();

  const indexRows = (row: Row) => {
    rowById.set(row.id, row);
    for (const choice of row.objects ?? []) {
      choiceMap.set(choice.id, { choice, row });
      for (const addon of choice.addons ?? []) {
        if (addon.isSelectable) {
          choiceMap.set(addon.id, { choice: addon as unknown as Choice, row });
          addonParentMap.set(addon.id, choice);
        }
      }
    }
  };

  for (const row of app.rows ?? []) indexRows(row);
  for (const row of dupRows) indexRows(row);
  // Backpack rows also participate in lookups (result rows reference them).
  for (const row of app.backpack ?? []) indexRows(row);
  for (const pointType of app.pointTypes ?? []) {
    pointTypeMap.set(pointType.id, pointType);
  }
  for (const group of app.groups ?? []) {
    groupMap.set(group.id, {
      ...group,
      // Runtime duplicate choices join their group's element lists so group
      // targeting/exclusivity sees them (mirrors the original mutating
      // `group.elements` when a row is duplicated).
      elements: [...(group.elements ?? [])],
      rowElements: [...(group.rowElements ?? [])],
    });
  }
  for (const row of dupRows) {
    for (const choice of row.objects ?? []) {
      for (const groupId of choice.groups ?? []) {
        const group = groupMap.get(groupId);
        if (group && !group.elements.includes(choice.id)) group.elements.push(choice.id);
      }
      for (const groupId of row.groups ?? []) {
        const group = groupMap.get(groupId);
        if (group && !group.rowElements.includes(row.id)) group.rowElements.push(row.id);
      }
    }
  }
  for (const variable of app.variables ?? []) {
    variableMap.set(variable.id, variable);
  }
  for (const word of app.words ?? []) {
    wordMap.set(word.id, word);
  }
  for (const req of app.globalRequirements ?? []) {
    globalReqMap.set(req.id, req.requireds ?? []);
  }
  const rowDesignMap = new Map();
  for (const group of app.rowDesignGroups ?? []) {
    rowDesignMap.set(group.id, group);
  }
  const objectDesignMap = new Map();
  for (const group of app.objectDesignGroups ?? []) {
    objectDesignMap.set(group.id, group);
  }
  // Merged, ordered rows: document rows (indices 0..n-1) first, then runtime
  // dups, sorted by their insertion `index` (stable for ties).
  const rows = [...(app.rows ?? []), ...dupRows].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return {
    app,
    rowById,
    rows,
    choiceMap,
    addonParentMap,
    pointTypeMap,
    groupMap,
    variableMap,
    wordMap,
    globalReqMap,
    rowDesignMap,
    objectDesignMap,
  };
}

// ---------------------------------------------------------------------------
// Activation helpers
// ---------------------------------------------------------------------------

/** Number of times a choice has been selected (multi-choice count). */
export function multipleOf(id: string, state: CyoaState): number {
  return state.activated.get(id)?.multiple ?? 0;
}

/** True when the id is activated (or its multiple count reaches a `/ON#n` threshold). */
export function checkActivated(str: string, state: CyoaState): boolean {
  const [key, val = "0"] = str.split("/ON#");
  const num = parseInt(val, 10);
  if (Number.isFinite(num) && num > 0) {
    return multipleOf(key, state) >= num;
  }
  return state.activated.has(key);
}

/** Base of a point type: starting sum + row-button adjustments (no scores). */
function pointSumBase(pointId: string, idx: CyoaIndex, state: CyoaState): number {
  const pointType = idx.pointTypeMap.get(pointId);
  if (!pointType) return 0;
  return Number(pointType.startingSum ?? 0) + (state.pointAdjustments.get(pointId) ?? 0);
}

/**
 * Live sum of a point type — the same value the point bar displays: base +
 * active choices' scores + point modifiers (the original viewer's mutated
 * `startingSum`). Point requirements (`points` / `pointCompare`) evaluate
 * against this, matching ICCPlus where a requirement like "Dream > 5"
 * reflects what the player has actually accumulated.
 */
export function pointSum(pointId: string, idx: CyoaIndex, state: CyoaState): number {
  const pointType = idx.pointTypeMap.get(pointId);
  if (!pointType) return 0;
  return computePointTotals(idx.app, idx, state).get(pointId)?.total ?? 0;
}

// ---------------------------------------------------------------------------
// Requirement engine — mirrors store.svelte.ts `checkReq` / `checkRequirements`
// ---------------------------------------------------------------------------

function getPriority(operator: string, priority = 1): number {
  switch (operator) {
    case "5":
    case "4":
    case "3":
      return priority * 10 + 1;
    case "2":
    case "1":
    default:
      return priority * 10 + 2;
  }
}

interface ExprNode {
  left: number | string | ExprNode;
  right: number | string | ExprNode;
  operator: string;
  priority: number;
}

function evaluateNode(node: number | string | ExprNode): number {
  if (typeof node === "number") return node;
  if (typeof node === "string") return Number(node) || 0;
  const left = evaluateNode(node.left);
  const right = evaluateNode(node.right);
  switch (node.operator) {
    case "1":
      return left + right;
    case "2":
      return left - right;
    case "3":
      return left * right;
    case "4":
      return right !== 0 ? left / right : left;
    case "5":
      return right !== 0 ? left % right : left;
    default:
      return left;
  }
}

function comparePoint(actual: number, operator: string | undefined, req: number): boolean {
  switch (operator) {
    case undefined:
    case "1":
      return actual > req;
    case "2":
      return actual >= req;
    case "3":
      return actual === req;
    case "4":
      return actual <= req;
    case "5":
      return actual < req;
    case "6":
      return actual !== req;
    default:
      return false;
  }
}

function countFromOperators(
  count: number,
  selFromOperators: string | undefined,
  selNum: number,
): boolean {
  const op = selFromOperators ?? "1";
  switch (op) {
    case "1":
      return !(selNum > count || (selNum === 0 && count > 0));
    case "2":
      return selNum === count;
    case "3":
      return !(selNum < count || (selNum === 0 && count > 0));
    case "4":
      return selNum !== count;
    default:
      return false;
  }
}

export function checkReq(req: Requireds, idx: CyoaIndex, state: CyoaState): boolean {
  if (!req) return false;
  if (req.required) {
    switch (req.type) {
      case "id":
        return checkActivated(req.reqId, state);
      case "points": {
        const pointData = idx.pointTypeMap.get(req.reqId);
        if (!pointData) return false;
        return comparePoint(pointSum(req.reqId, idx, state), req.operator, req.reqPoints);
      }
      case "or": {
        const orNum = req.orNum ?? 1;
        let orCount = 0;
        for (const orReq of req.orRequireds ?? []) {
          if (checkReq(orReq, idx, state)) orCount++;
        }
        return orCount >= orNum;
      }
      case "pointCompare": {
        const point1 = idx.pointTypeMap.get(req.reqId);
        const point2 = idx.pointTypeMap.get(req.reqId1);
        if (!point1 || !point2) return false;
        let current: number | ExprNode = pointSum(req.reqId1, idx, state);
        if (req.more) {
          for (const item of req.more) {
            const operator = item.operator || "1";
            const priority = getPriority(operator, item.priority);
            let temp = 0;
            if (item.id) {
              const moreData = idx.pointTypeMap.get(item.id);
              if (moreData) temp = pointSum(item.id, idx, state);
            } else if (typeof item.points !== "undefined") {
              temp = item.points;
            }
            const node: ExprNode = { left: current, operator, right: temp, priority };
            if (typeof current !== "number" && priority < current.priority) {
              current = {
                left: current.left,
                operator: current.operator,
                right: { left: current.right, operator, right: temp, priority },
                priority: current.priority,
              };
            } else {
              current = node;
            }
          }
        }
        const result = evaluateNode(current);
        return comparePoint(pointSum(req.reqId, idx, state), req.operator, result);
      }
      case "selFromGroups": {
        if (!req.selGroups) return false;
        let count = 0;
        for (const groupId of req.selGroups) {
          const data = idx.groupMap.get(groupId);
          if (!data) continue;
          for (const elementId of data.elements ?? []) {
            if (state.activated.has(elementId)) count++;
          }
        }
        return countFromOperators(count, req.selFromOperators, req.selNum ?? 1);
      }
      case "selFromRows": {
        if (!req.selRows) return false;
        let count = 0;
        for (const rowId of req.selRows) {
          count += state.currentChoices.get(rowId) ?? 0;
        }
        return countFromOperators(count, req.selFromOperators, req.selNum ?? 1);
      }
      case "selFromWhole": {
        let count = 0;
        for (const row of idx.rows ?? []) {
          count += state.currentChoices.get(row.id) ?? 0;
        }
        return countFromOperators(count, req.selFromOperators, req.selNum ?? 1);
      }
      case "gid": {
        const requireds = idx.globalReqMap.get(req.reqId);
        if (!requireds) return false;
        return checkRequirements(requireds, idx, state);
      }
      case "word": {
        const word = idx.wordMap.get(req.reqId);
        if (!word) return false;
        let orCount = 0;
        for (const orReq of req.orRequired ?? []) {
          if (
            typeof orReq.req !== "undefined" &&
            (state.wordValues.get(word.id) ?? word.replaceText) === orReq.req
          )
            orCount++;
        }
        return orCount >= 1;
      }
      default:
        return false;
    }
  }
  // `required: false` — negated forms.
  switch (req.type) {
    case "id":
      return !checkActivated(req.reqId, state);
    case "or": {
      const orNum = req.orNum ?? 1;
      let orCount = 0;
      for (const orReq of req.orRequireds ?? []) {
        if (checkReq(orReq, idx, state)) orCount++;
      }
      const total = req.orRequireds?.length ?? 0;
      return orCount < total - orNum + 1;
    }
    case "gid": {
      const requireds = idx.globalReqMap.get(req.reqId);
      if (!requireds) return false;
      return !checkRequirements(requireds, idx, state);
    }
    default:
      return false;
  }
}

export function checkRequirements(
  requireds: Requireds[] | undefined,
  idx: CyoaIndex,
  state: CyoaState,
): boolean {
  if (!requireds || requireds.length === 0) return true;
  let result = true;
  for (const req of requireds) {
    let subResult = true;
    for (const sub of req.requireds ?? []) {
      subResult = subResult && checkReq(sub, idx, state);
    }
    if (subResult) result = result && checkReq(req, idx, state);
  }
  return result;
}

/** True when an entity's requirements are all met. */
export function isEnabled(
  requireds: Requireds[] | undefined,
  idx: CyoaIndex,
  state: CyoaState,
): boolean {
  return checkRequirements(requireds, idx, state);
}

// ---------------------------------------------------------------------------
// Point bar visibility
// ---------------------------------------------------------------------------

export function checkPointEnable(point: PointType, idx: CyoaIndex, state: CyoaState): boolean {
  if (!point.isNotShownPointBar) return true;
  if (point.activatedId !== undefined && point.activatedId !== "") {
    const globalReq = idx.globalReqMap.get(point.activatedId);
    const variable = idx.variableMap.get(point.activatedId);
    if (globalReq) return checkRequirements(globalReq, idx, state);
    if (variable) return state.variables.get(variable.id) === true;
    return checkActivated(point.activatedId, state);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Text replacement — words, point values, choice counters
// ---------------------------------------------------------------------------

export function replaceText(str: string, idx: CyoaIndex, state: CyoaState): string {
  if (!str) return str;
  const { app } = idx;
  if (!app.words || app.words.length === 0) return str;
  const ids = [...app.words]
    .map((w) => w.id)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((id) => id.replace(/[-[\]{}()*+?.\\^$|]/g, "\\$&"));
  const regex = new RegExp(ids.join("|"), "g");
  return str.replace(regex, (match) => {
    const word = idx.wordMap.get(match);
    if (!word) return match;
    const override = state.wordValues.get(word.id);
    return override !== undefined ? override : word.replaceText;
  });
}

// ---------------------------------------------------------------------------
// Score evaluation
// ---------------------------------------------------------------------------

/** Minimal safe expression evaluator for `expValue` strings ("{pointId} * 2"). */
export function evalExpression(expr: string, idx: CyoaIndex, state: CyoaState): number {
  let text = expr;
  const tokenRegex = /\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = tokenRegex.exec(text)) !== null) {
    const value = pointSumBase(m[1], idx, state);
    text = text.replace(m[0], String(value));
  }
  const sanitized = text.replace(/[^0-9+\-*/().\s]/g, "");
  if (!sanitized.trim()) return 0;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(`"use strict"; return (${sanitized});`);
    const result = fn();
    return typeof result === "number" && Number.isFinite(result) ? result : 0;
  } catch {
    return 0;
  }
}

function randomBetween(min: number, max: number, allowFloat: boolean): number {
  const raw = min + Math.random() * (max - min);
  return allowFloat ? raw : Math.round(raw);
}

/**
 * Roll a fresh value for a random/expression score (ignores stored rolls).
 * Used at select time so totals stay stable across renders.
 */
export function rollScoreValue(
  choiceId: string,
  scoreIndex: number,
  score: Score,
  idx: CyoaIndex,
  state: CyoaState,
): number {
  const pointType = idx.pointTypeMap.get(score.id ?? score.type);
  const allowFloat = pointType?.allowFloat === true;
  let value = Number(score.value ?? 0);
  if (score.isRandom) {
    if (score.useExpression && score.expMinValue && score.expMaxValue) {
      const min = evalExpression(score.expMinValue, idx, state);
      const max = evalExpression(score.expMaxValue, idx, state);
      value = randomBetween(min, max, allowFloat);
    } else {
      const min = Number(score.minValue ?? 0);
      const max = Number(score.maxValue ?? 0);
      value = randomBetween(min, max, allowFloat);
    }
    if (!allowFloat) value = Math.floor(value);
  } else if (score.useExpression) {
    value = evalExpression(score.expValue ?? "", idx, state);
    if (!allowFloat) value = Math.floor(value);
  }
  void choiceId;
  void scoreIndex;
  return value;
}

/**
 * Current numeric value of a score for a selected choice. Uses stored rolled
 * values when present so recomputation is stable across renders.
 */
export function scoreValue(
  choiceId: string,
  scoreIndex: number,
  score: Score,
  idx: CyoaIndex,
  state: CyoaState,
): number {
  const rolledKey = `${choiceId}:${scoreIndex}`;
  const rolled = state.rolledScores.get(`${rolledKey}:1`) ?? state.rolledScores.get(rolledKey);
  if (rolled !== undefined) return rolled;
  return rollScoreValue(choiceId, scoreIndex, score, idx, state);
}

function applyDiscountOp(value: number, operator: string, discount: number): number {
  switch (operator) {
    case "+":
      return value + discount;
    case "-":
      return value - discount;
    case "×":
      return value * discount;
    case "÷":
      return discount !== 0 ? value / discount : value;
    case "=":
      return discount;
    default:
      return value;
  }
}

/**
 * True when an active `discountOther` choice's discount applies to `choice`'s
 * `score` right now (point-type scope + choice/row/group scope + the
 * `useDiscountCount` count gate). Shared by the value computation and the
 * discount display.
 */
function discountAppliesTo(
  other: Choice | SelectableAddon,
  choice: Choice | SelectableAddon,
  score: Score,
  targetRow: Row | undefined,
  idx: CyoaIndex,
  state: CyoaState,
): boolean {
  const inPointTypes =
    !other.discountPointTypes ||
    other.discountPointTypes.length === 0 ||
    other.discountPointTypes.includes(score.id ?? score.type);
  const inChoices = !other.isDisChoices || (other.discountChoices ?? []).includes(choice.id);
  const inGroups = (other.discountGroups ?? []).some((gid) => (choice.groups ?? []).includes(gid));
  const inRows =
    (other.discountRows ?? []).length === 0 ||
    (targetRow !== undefined && (other.discountRows ?? []).includes(targetRow.id));
  if (!inPointTypes) return false;
  if (other.isDisChoices && !inChoices && !inGroups && !inRows) return false;
  if (other.useDiscountCount && other.discountCount) {
    const baseCount = Number(other.discountCount ?? 0);
    const count =
      baseCount *
      (other.isSelectableMultiple && other.isMultipleUseVariable
        ? Math.max(1, Number(other.multipleUseVariable ?? 1))
        : 1);
    if (count > 0) {
      let applied = 0;
      for (const [oid, oentry] of state.activated) {
        if (oentry.isRowButton || oentry.isVariable || oid === other.id) continue;
        const oMap = idx.choiceMap.get(oid);
        if (!oMap) continue;
        const oChoice = oMap.choice;
        if (oChoice.isNotSelectable) continue;
        const oInChoices =
          !other.isDisChoices || (other.discountChoices ?? []).includes(oChoice.id);
        const oInGroups = (other.discountGroups ?? []).some((gid) =>
          (oChoice.groups ?? []).includes(gid),
        );
        const oInRows =
          (other.discountRows ?? []).length === 0 ||
          (other.discountRows ?? []).includes(oMap.row.id);
        if (other.isDisChoices && !oInChoices && !oInGroups && !oInRows) continue;
        applied +=
          other.countPerSelection && oChoice.isSelectableMultiple && oChoice.isMultipleUseVariable
            ? Math.max(0, oentry.multiple ?? 0)
            : 1;
      }
      if (applied < count) return false;
    }
  }
  return true;
}

export interface ScoreDiscountDisplay {
  show: boolean;
  before: string;
  after: string;
  replace: boolean;
  hideValue: boolean;
  hideIcon: boolean;
}

/**
 * How an active discount should display on a score (port of the original
 * ObjectScore `discountTexts`): the applicable discounting choices' custom
 * before/after text, replace/hide flags.
 */
export function scoreDiscountDisplay(
  choice: Choice | SelectableAddon,
  score: Score,
  idx: CyoaIndex,
  state: CyoaState,
): ScoreDiscountDisplay {
  const out: ScoreDiscountDisplay = {
    show: false,
    before: "",
    after: "",
    replace: false,
    hideValue: false,
    hideIcon: false,
  };
  const targetRow = idx.choiceMap.get(choice.id)?.row;
  const beforeTexts: string[] = [];
  const afterTexts: string[] = [];
  for (const [otherId, otherVal] of state.activated) {
    if (otherId === choice.id || otherVal.isRowButton || otherVal.isVariable) continue;
    const other = idx.choiceMap.get(otherId)?.choice as (Choice | SelectableAddon) | undefined;
    if (!other?.discountOther || !other.discountShow) continue;
    if (!discountAppliesTo(other, choice, score, targetRow, idx, state)) continue;
    out.show = true;
    if (other.discountBeforeText) beforeTexts.push(other.discountBeforeText);
    if (other.discountAfterText) afterTexts.push(other.discountAfterText);
    if (other.replaceScoreText) out.replace = true;
    if (other.hideScoreValue) out.hideValue = true;
    if (other.hideScoreIcon) out.hideIcon = true;
  }
  out.before = beforeTexts.join(" ");
  out.after = afterTexts.join(" ");
  return out;
}

/**
 * Compute the net value of one score for an activated choice, applying
 * multiple-count scaling (`multiplyByTimes`) and the discount engine.
 */
const evaluatingScores = new WeakMap<CyoaState, Set<string>>();

function scoreRequirementsMet(
  choiceId: string,
  scoreIndex: number,
  score: Score,
  idx: CyoaIndex,
  state: CyoaState,
): boolean {
  if (!score.requireds?.length) return true;
  const active = evaluatingScores.get(state) ?? new Set<string>();
  const key = `${choiceId}:${scoreIndex}`;
  // A price can depend on the currency it spends. During that recursive
  // lookup, evaluate the balance without applying the pending price again.
  if (active.has(key)) return false;
  evaluatingScores.set(state, active);
  active.add(key);
  try {
    return checkRequirements(score.requireds, idx, state);
  } finally {
    active.delete(key);
  }
}

export function recordScoreActivations(
  state: CyoaState,
  choice: Choice | SelectableAddon,
  idx: CyoaIndex,
  count: number,
  before = state,
): CyoaState {
  const next = { ...state, scoreActivations: new Map(state.scoreActivations) };
  for (let copy = 1; copy <= Math.max(1, Math.abs(count)); copy++) {
    (choice.scores ?? []).forEach((score, index) => {
      const key = `${choice.id}:${index}:${copy}`;
      if (score.requireds?.length && !next.scoreActivations.has(key)) {
        next.scoreActivations.set(key, scoreRequirementsMet(choice.id, index, score, idx, before));
      }
    });
  }
  return next;
}

/** Reconsider automatic choices after their requirements become available. */
export function activateAutomaticChoices(
  state: CyoaState,
  idx: CyoaIndex,
  initialize = false,
): CyoaState {
  let next = state;
  if (initialize) {
    for (const { choice, row } of idx.choiceMap.values()) {
      if (choice.isAutoActive && next.activated.has(choice.id))
        next = deselectChoice(choice, row, next);
    }
  }
  const attempted = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const { choice, row } of idx.choiceMap.values()) {
      if (
        !choice.isAutoActive ||
        next.activated.has(choice.id) ||
        attempted.has(choice.id) ||
        choice.isNotSelectable ||
        row.isInfoRow
      )
        continue;
      if (!isEnabled(choice.requireds, idx, next) || !isEnabled(row.requireds, idx, next)) continue;
      const parent = idx.addonParentMap.get(choice.id);
      if (parent && !next.activated.has(parent.id)) continue;
      attempted.add(choice.id);
      const before = next;
      let candidate = choice.isSelectableMultiple
        ? selectOneMore(choice, row, next, idx)
        : selectChoice(choice, row, idx, next);
      if (candidate === next) continue;
      candidate = recordScoreActivations(candidate, choice, idx, 1, before);
      if (choice.isSelectableMultiple)
        candidate = applyChoiceVariables(candidate, choice, idx, true);
      (choice.scores ?? []).forEach((score, index) => {
        if (score.isRandom || score.useExpression)
          candidate.rolledScores.set(
            `${choice.id}:${index}:1`,
            rollScoreValue(choice.id, index, score, idx, before),
          );
      });
      if (choice.textfieldIsOn && !choice.customTextfieldIsOn && choice.idOfTheTextfieldWord)
        candidate.wordValues.set(choice.idOfTheTextfieldWord, choice.wordChangeSelect ?? "");
      candidate = applyDuplicateRow(candidate, choice, idx);
      candidate = applyActivateOther(candidate, choice, idx);
      candidate = applyDeactivateOther(candidate, choice, idx);
      candidate = applyMissingReqCascade(candidate, idx);
      const previous = computePointTotals(idx.app, idx, before);
      if (
        [...computePointTotals(idx.app, idx, candidate).values()].some(
          ({ pointType, total }) =>
            pointType.belowZeroNotAllowed &&
            total < 0 &&
            total < (previous.get(pointType.id)?.total ?? 0),
        )
      )
        continue;
      next = candidate;
      changed = true;
    }
  }
  return next;
}

export function computeScoreNet(
  choice: Choice | SelectableAddon,
  scoreIndex: number,
  score: Score,
  idx: CyoaIndex,
  state: CyoaState,
  multiple: number,
): number {
  const copies = Math.max(1, Math.abs(multiple));
  let value = 0;
  let applied = false;
  for (let copy = 1; copy <= copies; copy++) {
    const key = `${choice.id}:${scoreIndex}:${copy}`;
    const enabled =
      state.scoreActivations?.get(key) ??
      scoreRequirementsMet(choice.id, scoreIndex, score, idx, state);
    if (!enabled) continue;
    applied = true;
    const rolled =
      state.rolledScores.get(key) ?? scoreValue(choice.id, scoreIndex, score, idx, state);
    value += rolled * (score.multiplyByTimes ? copy : 1);
  }
  if (!applied) return 0;

  // Discount engine: choices with `discountOther` modify other choices'
  // matching scores; per-score `discounts[]` stacks apply on top.
  if (!score.isNotDiscountable) {
    const matchingDiscounts: Array<{
      operator: string;
      value: number;
      stackable: boolean;
      lowLimit?: number;
    }> = [];
    const targetRow = idx.choiceMap.get(choice.id)?.row;
    for (const [otherId, otherVal] of state.activated) {
      if (otherId === choice.id || otherVal.isRowButton || otherVal.isVariable) continue;
      const other = idx.choiceMap.get(otherId)?.choice as (Choice | SelectableAddon) | undefined;
      if (!other?.discountOther) continue;
      if (!discountAppliesTo(other, choice, score, targetRow, idx, state)) continue;
      matchingDiscounts.push({
        operator: other.discountOperator ?? "+",
        value: Number(other.discountValue ?? 0),
        stackable: other.stackableDiscount === true,
        lowLimit: other.discountLowLimitIsOn ? Number(other.discountLowLimit ?? 0) : undefined,
      });
    }
    for (const discount of score.discounts ?? []) {
      // `score.discounts` is the original's *runtime* discount record: entries
      // are materialized from a discounting choice while it is selected. Only
      // apply live entries (state ACTIVE=1 / FULL=2) whose discounting choice
      // is currently selected, and skip when the choice-level `discountOther`
      // path already covers the same discount (prevents double-application
      // for documents saved mid-session).
      const discounting = idx.choiceMap.get(discount.id)?.choice;
      const active = discounting !== undefined && state.activated.has(discount.id);
      if (!active || discounting.discountOther) continue;
      if (discount.state === 0) continue; // INACTIVE
      if (!discount.showDiscount) continue;
      const times = discount.stackable ? Math.max(1, Number(discount.stack ?? 1)) : 1;
      for (let s = 0; s < times; s++) {
        matchingDiscounts.push({
          operator: discount.operator,
          value: discount.value,
          stackable: discount.stackable,
          lowLimit: discount.useLowLimit ? discount.lowLimit : undefined,
        });
      }
    }
    if (matchingDiscounts.length > 0) {
      const first = matchingDiscounts[0];
      let discounted = applyDiscountOp(value, first.operator, first.value);
      if (first.lowLimit !== undefined) discounted = Math.max(discounted, first.lowLimit);
      let stacked = first.stackable;
      for (let i = 1; i < matchingDiscounts.length; i++) {
        const d = matchingDiscounts[i];
        if (!d.stackable && stacked) break;
        discounted = applyDiscountOp(discounted, d.operator, d.value);
        if (d.lowLimit !== undefined) discounted = Math.max(discounted, d.lowLimit);
        stacked = d.stackable;
      }
      value = discounted;
    }
  }
  return multiple < 0 ? -value : value;
}

// ---------------------------------------------------------------------------
// Point totals
// ---------------------------------------------------------------------------

export interface PointTotal {
  pointType: PointType;
  total: number;
  /** True when the point would go below zero under belowZeroNotAllowed. */
  belowZero: boolean;
}

/**
 * Full point totals: starting sum + every activated choice's scores for the
 * point, scaled by multiple counts and discounts, then point modifiers
 * (multiply/divide/set) applied by active choices.
 */
export function computePointTotals(
  app: App,
  idx: CyoaIndex,
  state: CyoaState,
): Map<string, PointTotal> {
  const totals = new Map<string, PointTotal>();
  const base = new Map<string, number>();
  for (const pointType of app.pointTypes ?? []) {
    base.set(pointType.id, pointSumBase(pointType.id, idx, state));
  }
  applyPointModifiers(base, idx, state);
  for (const pointType of app.pointTypes ?? []) {
    totals.set(pointType.id, {
      pointType,
      total: base.get(pointType.id) ?? 0,
      belowZero: false,
    });
  }
  for (const [choiceId, entry] of state.activated) {
    if (entry.isRowButton || entry.isVariable) continue;
    const cMap = idx.choiceMap.get(choiceId);
    if (!cMap) continue;
    const { choice } = cMap;
    (choice.scores ?? []).forEach((score, scoreIndex) => {
      const pointTypeId = score.id ?? score.type;
      const total = totals.get(pointTypeId);
      if (!total) return;
      const net = computeScoreNet(choice, scoreIndex, score, idx, state, entry.multiple);
      // ICCPlus applies scores as `startingSum -= score.value` (select) and
      // `startingSum += score.value` (deselect): a POSITIVE value is a cost,
      // a NEGATIVE value is a gain — the document stores the negated change.
      // Mirror that so imported documents match the original viewer.
      total.total -= net;
    });
  }
  for (const total of totals.values()) {
    const { pointType } = total;
    if (pointType.belowZeroNotAllowed && total.total < 0) total.belowZero = true;
  }
  return totals;
}

/**
 * Point modifiers: active choices that multiply, divide, or set point totals
 * (port of the original `selectModifyPoint`). Applied in selection order on
 * the base (starting sum + row-button adjustments) before scores are added,
 * matching the original's live `startingSum` mutation semantics.
 */
function applyPointModifiers(base: Map<string, number>, idx: CyoaIndex, state: CyoaState): void {
  for (const [choiceId, entry] of state.activated) {
    if (entry.isRowButton || entry.isVariable) continue;
    const cMap = idx.choiceMap.get(choiceId);
    if (!cMap) continue;
    const choice = cMap.choice as Choice & {
      multiplyPointtypeIsOn?: boolean;
      pointTypeToMultiply?: string[];
      multiplyWithThis?: number | string;
      multiplyPointtypeIsId?: boolean;
      dividePointtypeIsOn?: boolean;
      pointTypeToDivide?: string[];
      divideWithThis?: number;
      setPointtypeIsOn?: boolean;
      pointTypeToSet?: string[];
      setWithThis?: string;
    };

    if (choice.multiplyPointtypeIsOn && Array.isArray(choice.pointTypeToMultiply)) {
      const multiplier =
        choice.multiplyPointtypeIsId && typeof choice.multiplyWithThis === "string"
          ? (base.get(choice.multiplyWithThis) ?? 0)
          : Number(choice.multiplyWithThis ?? 1);
      for (const pointId of choice.pointTypeToMultiply) {
        const current = base.get(pointId);
        if (current === undefined) continue;
        const point = idx.pointTypeMap.get(pointId);
        const value = current * multiplier;
        base.set(pointId, point?.allowFloat ? value : Math.floor(value));
      }
    }
    if (choice.dividePointtypeIsOn && Array.isArray(choice.pointTypeToDivide)) {
      const divisor = Number(choice.divideWithThis ?? 1);
      if (divisor !== 0) {
        for (const pointId of choice.pointTypeToDivide) {
          const current = base.get(pointId);
          if (current === undefined) continue;
          const point = idx.pointTypeMap.get(pointId);
          const value = current / divisor;
          base.set(pointId, point?.allowFloat ? value : Math.floor(value));
        }
      }
    }
    if (choice.setPointtypeIsOn && Array.isArray(choice.pointTypeToSet)) {
      const raw = String(choice.setWithThis ?? "");
      let value = Number.NaN;
      const replaced = raw.replace(/\{([^{}]+)\}/g, (_, id: string) => String(base.get(id) ?? 0));
      const sanitized = replaced.replace(/[^0-9+\-*/().\s]/g, "");
      if (sanitized.trim()) {
        try {
          // eslint-disable-next-line no-new-func
          const fn = new Function(`"use strict"; return (${sanitized});`);
          const result = fn();
          if (typeof result === "number" && Number.isFinite(result)) value = result;
        } catch {
          // invalid expression -> leave the point unchanged
        }
      }
      if (Number.isFinite(value)) {
        for (const pointId of choice.pointTypeToSet) {
          const point = idx.pointTypeMap.get(pointId);
          if (point) base.set(pointId, point.allowFloat ? value : Math.floor(value));
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Row buttons
// ---------------------------------------------------------------------------

export interface RowButtonAction {
  kind: "sumaddon" | "random" | "variable";
  /** For sumaddon: point type id + rolled sum. */
  pointTypeId?: string;
  pointNum?: number;
  /** For random: the choices that were activated. */
  activatedChoices?: string[];
  /** For variable: variable id + new state. */
  variableId?: string;
  variableValue?: boolean;
}

/** True when a row button should be disabled (already used / onlyIfNoChoices). */
export function isRowButtonDisabled(row: Row, state: CyoaState): boolean {
  if (row.onlyIfNoChoices && (state.currentChoices.get(row.id) ?? 0) !== 0) return true;
  if (row.buttonId && state.activated.has(row.buttonId) && row.buttonType) return true;
  return false;
}

/**
 * Execute a row button's activation in a new state snapshot. The viewer can
 * supply its selection pipeline to handle prompts, rolls, and linked effects.
 */
export function activateRowButton(
  row: Row,
  idx: CyoaIndex,
  state: CyoaState,
  selectRandomChoice?: (choice: Choice, state: CyoaState) => CyoaState,
): CyoaState {
  if (isRowButtonDisabled(row, state)) return state;
  let next = cloneState(state);
  const isSumAddon = row.btnPointAddon === true && row.buttonTypeRadio === "sumaddon";
  if (isSumAddon) {
    const pointType = idx.pointTypeMap.get(row.pointTypeRandom ?? "");
    if (pointType) {
      const min = Number(row.randomMin ?? 0);
      const max = Number(row.randomMax ?? 0);
      const sum = randomBetween(min, max, pointType.allowFloat === true);
      const current = pointSum(pointType.id, idx, state);
      // Reject without erasing an earlier successful award from the build.
      if (pointType.belowZeroNotAllowed && current + sum < 0) return state;
      next.pointAdjustments.set(
        pointType.id,
        (state.pointAdjustments.get(pointType.id) ?? 0) + sum,
      );
      const previous = state.activated.get(row.id);
      const previousAward =
        previous?.isRowButton && previous.rndPoint === pointType.id ? (previous.pointNum ?? 0) : 0;
      next.activated.set(row.id, {
        multiple: 0,
        isRowButton: true,
        rndPoint: pointType.id,
        pointNum: previousAward + sum,
      });
    }
  } else if (row.buttonRandom) {
    const count = Number(row.buttonRandomNumber ?? 1);
    const candidates: Choice[] = [];
    for (const choice of row.objects ?? []) {
      const selectable = choice.isSelectableMultiple !== true || choice.allowSelectByClick;
      if (row.onlyUnselectedChoices && state.activated.has(choice.id)) continue;
      if (choice.isNotSelectable) continue;
      if (!selectable && (state.activated.get(choice.id)?.multiple ?? 0) === 0) continue;
      if (!row.allowActivateUnselectable && !isEnabled(choice.requireds, idx, state)) continue;
      candidates.push(choice);
    }
    const picked = pickWeighted(candidates, count, row.isWeightedRandom === true);
    for (const choice of picked) {
      if (!row.allowActivateUnselectable && !isEnabled(choice.requireds, idx, next)) continue;
      if (selectRandomChoice) {
        next = selectRandomChoice(choice, next);
      } else if (choice.isSelectableMultiple) {
        const selected = selectOneMore(choice, row, next, idx);
        if (selected !== next) next = applyChoiceVariables(selected, choice, idx, true);
      } else {
        next = selectChoice(choice, row, idx, next);
      }
    }
  } else if (row.buttonId) {
    const variable = idx.variableMap.get(row.buttonId);
    if (variable) {
      const current = state.variables.get(variable.id) === true;
      const nextValue = row.buttonType ? !current : true;
      next.variables.set(variable.id, nextValue);
      if (row.buttonType || nextValue) {
        next.activated.set(variable.id, { multiple: 0, isVariable: true });
      } else {
        next.activated.delete(variable.id);
      }
    }
  }
  return next;
}

function pickWeighted(choices: Choice[], count: number, weighted: boolean): Choice[] {
  const picked: Choice[] = [];
  const pool = choices
    .map((choice) => {
      const weight = weighted ? Number(choice.randomWeight ?? 1) : 1;
      return { choice, weight: Number.isFinite(weight) ? Math.max(0, weight) : 0 };
    })
    .filter(({ weight }) => weight > 0);
  for (let i = 0; i < count && pool.length > 0; i++) {
    const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
    if (totalWeight <= 0) break;
    let roll = Math.random() * totalWeight;
    let index = 0;
    for (let j = 0; j < pool.length; j++) {
      roll -= pool[j].weight;
      if (roll < 0) {
        index = j;
        break;
      }
    }
    picked.push(pool.splice(index, 1)[0].choice);
  }
  return picked;
}

// ---------------------------------------------------------------------------
// State mutation helpers (immutable-ish, used by the viewer)
// ---------------------------------------------------------------------------

export function cloneState(state: CyoaState): CyoaState {
  return {
    activated: new Map(state.activated),
    variables: new Map(state.variables),
    currentChoices: new Map(state.currentChoices),
    rolledScores: new Map(state.rolledScores),
    scoreActivations: new Map(state.scoreActivations),
    wordValues: new Map(state.wordValues),
    uploadedImages: new Map(state.uploadedImages),
    pointAdjustments: new Map(state.pointAdjustments),
    tmpActivated: new Map(state.tmpActivated),
    // Copy the inner pick arrays so per-count splices never mutate a
    // previous state's record.
    activatedRandom: new Map([...state.activatedRandom].map(([key, value]) => [key, [...value]])),
    dupRows: [...state.dupRows],
  };
}

function bumpRowCount(state: CyoaState, rowId: string, delta: number): void {
  state.currentChoices.set(rowId, (state.currentChoices.get(rowId) ?? 0) + delta);
}

export function isChoiceSelectable(choice: Choice | SelectableAddon, state: CyoaState): boolean {
  if (choice.isNotSelectable) return false;
  if (choice.selectOnce && state.activated.has(choice.id)) return false;
  return true;
}

export function isRowEnabled(row: Row, idx: CyoaIndex, state: CyoaState): boolean {
  return checkRequirements(row.requireds, idx, state);
}

/** Apply a choice's set-true, set-false, or toggle effect to both variable maps. */
export function applyChoiceVariables(
  state: CyoaState,
  choice: Choice | SelectableAddon,
  idx: CyoaIndex,
  isSelect: boolean,
): CyoaState {
  if (!choice.isChangeVariables) return state;
  const ids = (choice.changedVariables ?? []).filter((id) => idx.variableMap.has(id));
  if (ids.length === 0) return state;
  const next = {
    ...state,
    activated: new Map(state.activated),
    variables: new Map(state.variables),
  };
  const changeType = choice.changeType ?? "1";
  for (const id of ids) {
    const value =
      changeType === "3"
        ? !next.variables.get(id)
        : isSelect
          ? changeType !== "2"
          : changeType === "2";
    next.variables.set(id, value);
    if (value) next.activated.set(id, { multiple: 0, isVariable: true });
    else next.activated.delete(id);
  }
  return next;
}

/**
 * Effective selection limit for a row: the row's own `allowedChoices` plus
 * the increments granted by currently-active choices with `addToAllowChoice`
 * that target this row. `localChoice` contributes its own increment even
 * before it is committed (matching the original's select-time check).
 */
export function rowAllowedChoices(
  row: Row,
  idx: CyoaIndex,
  state: CyoaState,
  localChoice?: Choice | SelectableAddon,
): number {
  let limit = Number(row.allowedChoices ?? 0);
  if (
    localChoice?.addToAllowChoice &&
    !state.activated.has(localChoice.id) &&
    (localChoice.idOfAllowChoice ?? []).includes(row.id)
  ) {
    limit += Number(localChoice.numbAddToAllowChoice ?? 0);
  }
  for (const [id, entry] of state.activated) {
    if (entry.isRowButton || entry.isVariable) continue;
    const cMap = idx.choiceMap.get(id);
    const choice = cMap?.choice as
      | (Choice & {
          addToAllowChoice?: boolean;
          idOfAllowChoice?: string[];
          numbAddToAllowChoice?: number;
        })
      | undefined;
    if (choice?.addToAllowChoice && (choice.idOfAllowChoice ?? []).includes(row.id)) {
      limit += Number(choice.numbAddToAllowChoice ?? 0);
    }
  }
  return limit;
}

/**
 * True when an activated entry counts toward its row's `allowedChoices`
 * limit: regular choices always count unless `isCountDisabled`; selectable
 * addons count only when `countAsChoice` is set (original `countCheck`).
 */
export function countsTowardLimit(choice: Choice | SelectableAddon): boolean {
  const record = choice as unknown as Record<string, unknown>;
  return record.isSelectable === true || typeof record.parentId !== "undefined"
    ? record.countAsChoice === true
    : record.isCountDisabled !== true;
}

/** Row-limit displacement runs the outgoing choice's deselection effects. */
function releaseDisplacedChoice(
  state: CyoaState,
  choice: Choice | SelectableAddon,
  idx: CyoaIndex,
): CyoaState {
  const count = Math.max(1, Math.abs(state.activated.get(choice.id)?.multiple ?? 0));
  let next = state;
  for (let copy = count; copy >= 1; copy--)
    next = applyDeselectActivateOther(next, choice, idx, copy);
  if (choice.changeType !== "3" || count % 2 === 1)
    next = applyChoiceVariables(next, choice, idx, false);
  next = cloneState(next);
  const prefix = `${choice.id}:`;
  for (const key of next.rolledScores.keys())
    if (key.startsWith(prefix)) next.rolledScores.delete(key);
  for (const key of next.scoreActivations?.keys() ?? [])
    if (key.startsWith(prefix)) next.scoreActivations!.delete(key);
  if (choice.textfieldIsOn && choice.idOfTheTextfieldWord)
    next.wordValues.set(choice.idOfTheTextfieldWord, choice.wordChangeDeselect ?? "");
  next.uploadedImages.delete(choice.id);
  return next;
}

/**
 * Select a choice (single-selection semantics with allowed-choices
 * displacement and clean-on-select). Returns a new state.
 *
 * NOTE: the original ICCPlus viewer has NO automatic group exclusivity —
 * groups are namespaces for `selFromGroups` requirements, discounts, and
 * activate/deactivate-other targets. Exclusivity between choices comes from
 * "not selected" (`required: false`) requirements, enforced by the
 * missing-requirement cascade in the viewer. Auto-deselecting same-group
 * members here breaks legacy documents whose groups span rows (the whole
 * chain collapses), so we deliberately do not do it.
 */
export function selectChoice(
  choice: Choice | SelectableAddon,
  row: Row,
  idx: CyoaIndex,
  state: CyoaState,
): CyoaState {
  if (state.activated.has(choice.id) || !isChoiceSelectable(choice, state)) return state;
  let next = cloneState(state);

  if (choice.cleanACtivatedOnSelect) {
    next.activated.clear();
    for (const r of idx.rows ?? []) next.currentChoices.set(r.id, 0);
  }

  // allowedChoices limit: drop the earliest selection to make room.
  const limit = rowAllowedChoices(row, idx, state, choice);
  if (limit > 0 && countsTowardLimit(choice)) {
    const selectedInRow = [...next.activated.entries()].filter(([id, entry]) => {
      if (entry.isRowButton || entry.isVariable) return false;
      const cMap = idx.choiceMap.get(id);
      if (!cMap || cMap.row.id !== row.id) return false;
      return countsTowardLimit(cMap.choice);
    });
    while (selectedInRow.length >= limit) {
      const position = selectedInRow.findIndex(([id, entry]) => {
        const other = idx.choiceMap.get(id)!.choice;
        return (
          !other.selectOnce &&
          !other.forcedActivated &&
          !entry.forcedFrom &&
          id !== idx.addonParentMap.get(choice.id)?.id
        );
      });
      if (position < 0) return state;
      const [displaced] = selectedInRow.splice(position, 1);
      if (displaced) {
        const removedChoice = idx.choiceMap.get(displaced[0])!.choice;
        next = releaseDisplacedChoice(next, removedChoice, idx);
        next.activated.delete(displaced[0]);
        bumpRowCount(next, row.id, -1);
      }
    }
  }

  next.activated.set(choice.id, { multiple: 0 });
  if (countsTowardLimit(choice)) bumpRowCount(next, row.id, 1);

  return applyChoiceVariables(next, choice, idx, true);
}

/** Deselect a choice (or selectable addon). */
export function deselectChoice(
  choice: Choice | SelectableAddon,
  row: Row,
  state: CyoaState,
): CyoaState {
  if (!state.activated.has(choice.id)) return state;
  const next = cloneState(state);
  next.activated.delete(choice.id);
  if (countsTowardLimit(choice)) bumpRowCount(next, row.id, -1);
  return next;
}

/** Increment a multi-select choice's count (min/max respected). */
export function selectOneMore(
  choice: Choice | SelectableAddon,
  row: Row,
  state: CyoaState,
  idx?: CyoaIndex,
): CyoaState {
  if (choice.isNotSelectable) return state;
  const max = Number(choice.numMultipleTimesPluss ?? 0);
  const current = state.activated.get(choice.id)?.multiple ?? 0;
  if (max > 0 && current >= max) return state;

  if (current < 0) {
    let next = cloneState(state);
    if (current === -1) {
      next.activated.delete(choice.id);
      if (countsTowardLimit(choice)) bumpRowCount(next, row.id, -1);
    } else
      next.activated.set(choice.id, { ...next.activated.get(choice.id), multiple: current + 1 });
    return next;
  }

  let next = cloneState(state);
  const wasZero = current === 0;
  const multiple = current + 1;
  next.activated.set(choice.id, { ...state.activated.get(choice.id), multiple });
  if (wasZero) {
    if (countsTowardLimit(choice)) bumpRowCount(next, row.id, 1);
    // First activation of a multi-select also respects the row limit.
    if (idx && countsTowardLimit(choice)) {
      const limit = rowAllowedChoices(row, idx, next, choice);
      if (limit > 0) {
        const selectedInRow = [...next.activated.entries()].filter(([id, entry]) => {
          if (entry.isRowButton || entry.isVariable) return false;
          const cMap = idx.choiceMap.get(id);
          if (!cMap || cMap.row.id !== row.id) return false;
          return countsTowardLimit(cMap.choice);
        });
        while (selectedInRow.length > limit) {
          const position = selectedInRow.findIndex(([id, entry]) => {
            const other = idx.choiceMap.get(id)!.choice;
            return (
              id !== choice.id &&
              id !== idx.addonParentMap.get(choice.id)?.id &&
              !other.selectOnce &&
              !other.forcedActivated &&
              !entry.forcedFrom
            );
          });
          if (position < 0) return state;
          const [displaced] = selectedInRow.splice(position, 1);
          if (displaced && displaced[0] !== choice.id) {
            next = releaseDisplacedChoice(next, idx.choiceMap.get(displaced[0])!.choice, idx);
            next.activated.delete(displaced[0]);
            bumpRowCount(next, row.id, -1);
          } else if (displaced && displaced[0] === choice.id) {
            // The row is full and this is the newest entry: revert the bump.
            next.activated.delete(choice.id);
            bumpRowCount(next, row.id, -1);
            break;
          }
        }
      }
    }
  }
  return next;
}

/** Decrement a multi-select choice's count. */
export function selectOneLess(
  choice: Choice | SelectableAddon,
  row: Row,
  state: CyoaState,
  idx?: CyoaIndex,
): CyoaState {
  const min = Number(choice.numMultipleTimesMinus ?? 0);
  const current = state.activated.get(choice.id)?.multiple ?? 0;
  if (current <= min) return state;
  if (current <= 0) {
    const mirrored = cloneState(state);
    if (current < 0)
      mirrored.activated.set(choice.id, {
        ...mirrored.activated.get(choice.id),
        multiple: -current,
      });
    const next = selectOneMore({ ...choice, numMultipleTimesPluss: -min }, row, mirrored, idx);
    if (next === mirrored) return state;
    const entry = next.activated.get(choice.id);
    if (entry) next.activated.set(choice.id, { ...entry, multiple: -entry.multiple });
    return next;
  }
  const next = cloneState(state);
  const multiple = current - 1;
  if (multiple <= 0) {
    next.activated.delete(choice.id);
  } else {
    next.activated.set(choice.id, { ...state.activated.get(choice.id), multiple });
  }
  if (current === 1 && countsTowardLimit(choice)) bumpRowCount(next, row.id, -1);
  return next;
}

/** Toggle a selectable addon (with parent choice auto-selection). */
export function toggleSelectableAddon(
  addon: SelectableAddon,
  parentChoice: Choice,
  parentRow: Row,
  idx: CyoaIndex,
  state: CyoaState,
): CyoaState {
  let next = state;
  if (state.activated.has(addon.id)) {
    next = cloneState(state);
    next.activated.delete(addon.id);
    if (countsTowardLimit(addon)) bumpRowCount(next, parentRow.id, -1);
    // Auto-deselect parent when no selectable addons remain.
    if (addon.deselectParent || addon.deselectWhenNoAddon) {
      const remaining = (parentChoice.addons ?? []).some(
        (a) => a.isSelectable && next.activated.has(a.id),
      );
      if (!remaining && next.activated.has(parentChoice.id)) {
        next = deselectChoice(parentChoice, parentRow, next);
      }
    }
    return next;
  }
  // Select parent first (addons cannot be active without their parent).
  if (!state.activated.has(parentChoice.id)) {
    next = selectChoice(parentChoice, parentRow, idx, state);
  } else {
    next = cloneState(state);
  }
  next.activated.set(addon.id, { multiple: 0 });
  if (countsTowardLimit(addon)) bumpRowCount(next, parentRow.id, 1);
  return next;
}

// ---------------------------------------------------------------------------
// Linked activation (activateOtherChoice / deactivateOtherChoice)
// ---------------------------------------------------------------------------

interface ActivationTarget {
  id: string;
  /** `/ON#n` count from the target list; 0 when absent. */
  num: number;
  choice: Choice | SelectableAddon;
  row: Row;
}

/** Resolve a comma-separated target list (choice ids and/or group ids). */
function parseTargetList(list: string | undefined, idx: CyoaIndex): ActivationTarget[] {
  const out: ActivationTarget[] = [];
  if (!list) return out;
  for (const item of list.split(",")) {
    if (!item.trim()) continue;
    const [key, rawNum = "0"] = item.split("/ON#");
    const parsed = parseInt(rawNum, 10);
    const num = Number.isFinite(parsed) ? parsed : 0;
    const cMap = idx.choiceMap.get(key);
    if (cMap) {
      out.push({ id: cMap.choice.id, num, choice: cMap.choice, row: cMap.row });
      continue;
    }
    const group = idx.groupMap.get(key);
    if (group) {
      for (const elementId of group.elements ?? []) {
        const gMap = idx.choiceMap.get(elementId);
        if (gMap) out.push({ id: gMap.choice.id, num, choice: gMap.choice, row: gMap.row });
      }
    }
  }
  return out;
}

/** Resolve recorded random picks (`id` / `id/ON#n` — groups already expanded). */
function parsePicks(picks: string[], idx: CyoaIndex): ActivationTarget[] {
  const out: ActivationTarget[] = [];
  for (const item of picks) {
    if (!item) continue;
    const [key, rawNum = "0"] = item.replace(/\/RON#/g, "/ON#").split("/ON#");
    const parsed = parseInt(rawNum, 10);
    const num = Number.isFinite(parsed) ? parsed : 0;
    const cMap = idx.choiceMap.get(key);
    if (cMap) out.push({ id: cMap.choice.id, num, choice: cMap.choice, row: cMap.row });
  }
  return out;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Remove an entry from `activated` and fix its row's choice count. */
function removeActivated(state: CyoaState, idx: CyoaIndex, id: string): void {
  const entry = state.activated.get(id);
  if (!entry) return;
  state.activated.delete(id);
  if (entry.isRowButton || entry.isVariable) return;
  const cMap = idx.choiceMap.get(id);
  if (cMap && countsTowardLimit(cMap.choice)) bumpRowCount(state, cMap.row.id, -1);
}

/** Set an activated entry, bumping the row count only for fresh entries. */
function setActivated(state: CyoaState, idx: CyoaIndex, id: string, value: ActivatedValue): void {
  const had = state.activated.has(id);
  state.activated.set(id, value);
  if (!had && !value.isRowButton && !value.isVariable) {
    const cMap = idx.choiceMap.get(id);
    if (cMap && countsTowardLimit(cMap.choice)) bumpRowCount(state, cMap.row.id, 1);
  }
}

/**
 * Run the `activateOtherChoice` chain after a selection commits: the local
 * choice force-selects its targets (choice ids and group ids, `id/ON#n`
 * counts for multi-select targets). Targets already active get a `forcedFrom`
 * count and a `tmpActivated` snapshot so they are restored (not removed) when
 * the activator is deselected. `isActivateRandom` + `numActivateRandom` picks
 * a random subset; `isNotActiveUnselectable` skips non-selectable targets;
 * `isAllowDeselect` opts out of force-activation entirely. Chained activators
 * propagate with cycle protection.
 */
export function applyActivateOther(
  state: CyoaState,
  local: Choice | SelectableAddon,
  idx: CyoaIndex,
  picksOverride?: string[],
): CyoaState {
  if (!local.activateOtherChoice || typeof local.activateThisChoice === "undefined") {
    return state;
  }
  const next = cloneState(state);
  next.activatedRandom = new Map(next.activatedRandom);
  const queue: ActivationTarget[] = [];
  const pushTargets = (activator: Choice | SelectableAddon) => {
    if (!activator.activateOtherChoice || typeof activator.activateThisChoice === "undefined")
      return;
    // `picksOverride` replays a recorded random pick set (build load / reset);
    // otherwise targets come from the activator's list (random subset if set).
    let targets =
      activator === local && picksOverride
        ? parsePicks(picksOverride, idx)
        : parseTargetList(activator.activateThisChoice, idx);
    if (activator === local && picksOverride) {
      // Recorded picks are stored per selection count, mirroring the original
      // `activatedRandomMul[count - 1]`.
      const normalized = picksOverride.map((pick) => pick.replace(/\/RON#/g, "/ON#"));
      if (activator.isSelectableMultiple) {
        const chunk = Math.max(1, Number(activator.numActivateRandom ?? 0) || normalized.length);
        const perCount: string[][] = [];
        for (let i = 0; i < normalized.length; i += chunk) {
          perCount.push(normalized.slice(i, i + chunk));
        }
        next.activatedRandom.set(activator.id, perCount);
      } else {
        next.activatedRandom.set(activator.id, [normalized]);
      }
    } else if (activator.isActivateRandom) {
      const num = Math.max(0, Number(activator.numActivateRandom ?? 0));
      if (num < targets.length) targets = shuffle(targets).slice(0, num);
      const picks = targets.map((t) => (t.num > 0 ? `${t.id}/ON#${t.num}` : t.id));
      const count = activator.isSelectableMultiple
        ? Math.max(1, next.activated.get(activator.id)?.multiple ?? 1)
        : 1;
      const existing = next.activatedRandom.get(activator.id) ?? [];
      const perCount = [...existing];
      perCount[count - 1] = picks;
      next.activatedRandom.set(activator.id, perCount);
    } else {
      next.activatedRandom.delete(activator.id);
    }
    queue.push(...targets);
  };
  pushTargets(local);
  const visited = new Set<string>([local.id]);
  while (queue.length > 0) {
    const { id, num, choice: target } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    if (target.isNotSelectable && local.isNotActiveUnselectable) continue;
    if (local.isAllowDeselect) continue;
    const existing = next.activated.get(id);
    // Preserve only the selection that existed before the first forced link.
    // Later activators must not overwrite it with another forced entry.
    if (existing && !existing.forcedFrom && !next.tmpActivated.has(id)) {
      next.tmpActivated.set(id, { ...existing });
    }
    if (target.isSelectableMultiple && target.isMultipleUseVariable) {
      // A linked target without an explicit `/ON#` count activates once — the
      // original's non-random path force-selects each target (selectedOneMore),
      // and random picks record the bare id. Skipping num === 0 left recorded
      // random picks permanently unactivated.
      const linkedNum = num === 0 ? 1 : num;
      if (linkedNum !== 0) {
        const current = existing?.multiple ?? 0;
        const nextMultiple = Math.max(0, current + linkedNum);
        if (nextMultiple === 0) {
          removeActivated(next, idx, id);
        } else {
          setActivated(next, idx, id, {
            multiple: nextMultiple,
            forcedFrom: (next.activated.get(id)?.forcedFrom ?? 0) + 1,
          });
        }
      }
    } else {
      setActivated(next, idx, id, {
        multiple: 0,
        forcedFrom: (existing?.forcedFrom ?? 0) + 1,
      });
    }
    const cMap = idx.choiceMap.get(id);
    if (cMap) pushTargets(cMap.choice);
  }
  return next;
}

/**
 * Reverse of `applyActivateOther`: when an activator is deselected, decrement
 * its targets' `forcedFrom` counts and restore (or remove) them at zero.
 * `isNotDeactivate` keeps linked targets active instead. For random
 * activators, `count` is the selection count being removed (1 for single).
 */
export function applyDeselectActivateOther(
  state: CyoaState,
  local: Choice | SelectableAddon,
  idx: CyoaIndex,
  count = 1,
): CyoaState {
  if (
    !local.activateOtherChoice ||
    typeof local.activateThisChoice === "undefined" ||
    local.isAllowDeselect
  ) {
    return state;
  }
  const next = cloneState(state);
  const releaseTargets = (activator: Choice | SelectableAddon, selectionCount: number) => {
    if (!activator.activateOtherChoice) return [];
    let targets = parseTargetList(activator.activateThisChoice, idx);
    if (activator.isActivateRandom) {
      const perCount = next.activatedRandom.get(activator.id);
      const picked = perCount?.[selectionCount - 1];
      if (picked) {
        // Picks include the counts that were actually applied. The current
        // target list may have changed since this selection/build was saved.
        targets = parsePicks(picked, idx);
        // Drop only this activation's recorded picks.
        if (perCount.length <= 1) {
          next.activatedRandom.delete(activator.id);
        } else {
          perCount.splice(selectionCount - 1, 1);
          next.activatedRandom.set(activator.id, perCount);
        }
      }
    }
    return targets;
  };
  const targets = releaseTargets(local, count);
  const visited = new Set([local.id]);
  for (const t of targets) {
    if (visited.has(t.id)) continue;
    visited.add(t.id);
    const target = t.choice;
    const entry = next.activated.get(t.id);
    if (!entry) continue;
    if (target.isNotSelectable && local.isNotActiveUnselectable) continue;
    // Activation traverses each target once, including targets already
    // active. Release the same chain, retaining links held by other sources.
    targets.push(
      ...releaseTargets(target, target.isSelectableMultiple ? Math.max(1, entry.multiple) : 1),
    );
    if (target.isSelectableMultiple && target.isMultipleUseVariable) {
      // Mirror the activation default: a linked target without an explicit
      // `/ON#` count was activated once, so release one count.
      const linkedNum = t.num === 0 ? 1 : t.num;
      if (linkedNum !== 0) {
        const nextMultiple = local.isNotDeactivate
          ? entry.multiple
          : Math.max(0, (entry.multiple ?? 0) - Math.abs(linkedNum));
        const forcedFrom = Math.max(0, (entry.forcedFrom ?? 0) - 1);
        if (forcedFrom === 0) next.tmpActivated.delete(t.id);
        if (nextMultiple === 0) removeActivated(next, idx, t.id);
        else next.activated.set(t.id, { ...entry, multiple: nextMultiple, forcedFrom });
      }
      continue;
    }
    const forcedFrom = entry.forcedFrom ?? 0;
    if (forcedFrom > 1) {
      next.activated.set(t.id, { ...entry, forcedFrom: forcedFrom - 1 });
    } else if (forcedFrom === 1) {
      const snapshot = next.tmpActivated.get(t.id);
      if (snapshot) {
        next.tmpActivated.delete(t.id);
        next.activated.set(t.id, snapshot);
      } else if (!local.isNotDeactivate) {
        removeActivated(next, idx, t.id);
      } else {
        next.activated.set(t.id, { ...entry, forcedFrom: 0 });
      }
    } else if (!local.isNotDeactivate) {
      removeActivated(next, idx, t.id);
    }
  }
  return next;
}

/**
 * `deactivateOtherChoice`: on select, deselect the listed targets (choice or
 * group ids; `/ON#n` limits the count removed for multi-select targets, and
 * an absent count removes the whole `multipleUseVariable` stack). Targets held
 * active by linked activation (`forcedFrom`) are left alone.
 */
export function applyDeactivateOther(
  state: CyoaState,
  local: Choice | SelectableAddon,
  idx: CyoaIndex,
): CyoaState {
  if (!local.deactivateOtherChoice || typeof local.deactivateThisChoice === "undefined") {
    return state;
  }
  const next = cloneState(state);
  for (const t of parseTargetList(local.deactivateThisChoice, idx)) {
    const target = t.choice;
    const entry = next.activated.get(t.id);
    if (!entry || (entry.forcedFrom ?? 0) > 0) continue;
    if (target.isSelectableMultiple && target.isMultipleUseVariable) {
      const num = t.num > 0 ? t.num : Number(target.multipleUseVariable ?? 1);
      const nextMultiple = Math.max(0, (entry.multiple ?? 0) - num);
      if (nextMultiple === 0) removeActivated(next, idx, t.id);
      else next.activated.set(t.id, { ...entry, multiple: nextMultiple });
    } else {
      removeActivated(next, idx, t.id);
    }
  }
  return next;
}

/**
 * Port of the original ICCPlus viewer's `deselectMissingReq`: after a select
 * or deselect commits, remove every activated entry whose requirements are no
 * longer met, so a removal can cascade into further removals (the
 * missing-requirement cascade that enforces exclusivity and gating).
 *
 * Follows the original selection rules:
 * - `localId` (the choice that triggered the operation) is skipped during the
 *   pass — the caller re-checks it once afterwards, matching the original's
 *   end-of-`selectObject` self-check.
 * - Multi-select entries are removed count-by-count, releasing their linked
 *   activations once per count (`applyDeselectActivateOther` per count), the
 *   same as the original's `selectedOneLess` loop.
 * - Row-button and variable entries never take part.
 *
 * Evaluate against the latest state and repeat until no more entries are
 * removed. Imported builds can list dependents before their prerequisites,
 * so one pass is insufficient to settle every dependency chain.
 */
export function applyMissingReqCascade(
  state: CyoaState,
  idx: CyoaIndex,
  localId?: string,
): CyoaState {
  let next = state;
  let removed: boolean;
  do {
    removed = false;
    for (const id of next.activated.keys()) {
      // A linked release earlier in the pass may already have removed this
      // entry. Always inspect its current value rather than the old snapshot.
      const entry = next.activated.get(id);
      if (!entry || entry.isRowButton || entry.isVariable || id === localId) continue;
      const cMap = idx.choiceMap.get(id);
      if (!cMap) continue;
      const { choice, row } = cMap;
      const parent = idx.addonParentMap.get(id);
      if ((!parent || next.activated.has(parent.id)) && isEnabled(choice.requireds, idx, next))
        continue;

      next = releaseDisplacedChoice(next, choice, idx);
      removed = true;
      if (!next.activated.has(id)) continue;
      next = cloneState(next);
      next.activated.delete(id);
      if (countsTowardLimit(choice)) bumpRowCount(next, row.id, -1);
    }
  } while (removed);
  return next;
}

// ---------------------------------------------------------------------------
// Runtime row duplication (duplicateRow)
// ---------------------------------------------------------------------------

/** Rewrite `/D#`-suffixed id references inside a requirement tree. */
function suffixReqIds(req: Requireds, suffix: string): void {
  const rewrite = (raw: string): string => {
    const [base, num] = raw.split("/ON#");
    const suffixed = `${base.split("/D#")[0]}${suffix}`;
    return num ? `${suffixed}/ON#${num}` : suffixed;
  };
  if (req.type === "id" && req.reqId) req.reqId = rewrite(req.reqId);
  if (req.type === "or") {
    for (const or of req.orRequired) {
      if (typeof or.req === "string" && or.req) or.req = rewrite(or.req);
    }
  }
  for (const inner of req.requireds ?? []) suffixReqIds(inner, suffix);
  for (const inner of req.orRequireds ?? []) suffixReqIds(inner, suffix);
}

/** Rewrite `/D#`-suffixed ids in a comma-separated target list. */
function suffixTargetList(list: string, suffix: string): string {
  return list
    .split(",")
    .map((item) => {
      if (!item) return item;
      const [id, num] = item.split("/ON#");
      const suffixed = `${id.split("/D#")[0]}${suffix}`;
      return num ? `${suffixed}/ON#${num}` : suffixed;
    })
    .join(",");
}

/** Deep-clone a row with `/D#n`-suffixed ids (port of the original `duplicateRow`). */
function cloneRowWithSuffix(source: Row, suffix: string, local: Choice | SelectableAddon): Row {
  const clone = structuredClone(source) as Row;
  clone.id = `${source.id.split("/D#")[0]}${suffix}`;
  clone.currentChoices = 0;
  delete (clone as unknown as Record<string, unknown>).templateStack;
  delete (clone as unknown as Record<string, unknown>).widthStack;
  delete (clone as unknown as Record<string, unknown>).isEditModeOn;

  for (let i = 0; i < (clone.objects ?? []).length; i++) {
    const choice = clone.objects[i];
    choice.id = `${choice.id.split("/D#")[0]}${suffix}`;
    choice.index = i;
    choice.isActive = false;
    delete choice.forcedActivated;
    delete choice.appliedDisChoices;
    delete (choice as unknown as Record<string, unknown>).templateStack;
    delete (choice as unknown as Record<string, unknown>).widthStack;
    for (const score of choice.scores ?? []) {
      score.idx = `s-${Date.now().toString(36)}${i}${Math.floor(Math.random() * 1e6)}`;
      delete score.isActive;
      delete score.isActiveMul;
      delete score.isActiveMulMinus;
      delete score.setValue;
      delete score.discounts;
      delete (score as unknown as Record<string, unknown>).tmpDisScore;
    }
    for (const addon of choice.addons ?? []) {
      addon.id = `${addon.id.split("/D#")[0]}${suffix}`;
      addon.parentId = choice.id;
    }

    if (!local.dRowAddSufReq) {
      for (const req of choice.requireds ?? []) suffixReqIds(req, suffix);
      for (const score of choice.scores ?? []) {
        for (const req of score.requireds ?? []) suffixReqIds(req, suffix);
      }
      for (const variant of choice.imageVariants ?? []) {
        for (const req of variant.requireds ?? []) suffixReqIds(req, suffix);
      }
      for (const addon of choice.addons ?? []) {
        for (const req of addon.requireds ?? []) suffixReqIds(req, suffix);
        if (addon.isSelectable) {
          for (const score of addon.scores ?? []) {
            for (const req of score.requireds ?? []) suffixReqIds(req, suffix);
          }
        }
      }
    }
    if (!local.dRowAddSufFunc) {
      for (const entity of [choice, ...(choice.addons ?? [])]) {
        const record = entity as unknown as Record<string, unknown>;
        if (record.activateOtherChoice && typeof record.activateThisChoice === "string") {
          record.activateThisChoice = suffixTargetList(record.activateThisChoice as string, suffix);
        }
        if (record.deactivateOtherChoice && typeof record.deactivateThisChoice === "string") {
          record.deactivateThisChoice = suffixTargetList(
            record.deactivateThisChoice as string,
            suffix,
          );
        }
        if (
          record.duplicateRow &&
          typeof record.duplicateRowId === "string" &&
          typeof record.duplicateRowPlace === "string"
        ) {
          record.duplicateRowId = `${(record.duplicateRowId as string).split("/D#")[0]}${suffix}`;
          record.duplicateRowPlace = `${(record.duplicateRowPlace as string).split("/D#")[0]}${suffix}`;
        }
      }
    }
  }
  return clone;
}

/**
 * `duplicateRow`: when selected, clone the source row (`duplicateRowId`) and
 * append the clone after the placement row (`duplicateRowPlace`) as a runtime
 * duplicate with `/D#n`-suffixed ids. Mirrors the original `duplicateRow`,
 * including requirement/function id rewriting (`dRowAddSufReq`,
 * `dRowAddSufFunc`).
 */
export function applyDuplicateRow(
  state: CyoaState,
  local: Choice | SelectableAddon,
  idx: CyoaIndex,
): CyoaState {
  const record = local as unknown as Record<string, unknown>;
  if (
    !record.duplicateRow ||
    typeof record.duplicateRowId !== "string" ||
    typeof record.duplicateRowPlace !== "string"
  ) {
    return state;
  }
  const sourceId = record.duplicateRowId as string;
  const placeId = record.duplicateRowPlace as string;
  const baseId = sourceId.split("/D#")[0];
  // Several activations can share an index before React renders again. Include
  // rows already added to this state when resolving sources and allocating ids.
  const rowsById = new Map(idx.rowById);
  for (const row of state.dupRows) rowsById.set(row.id, row);
  let num = 1;
  while (rowsById.has(`${baseId}/D#${num}`)) num++;
  const suffix = `/D#${num}`;
  const source = rowsById.get(sourceId);
  const place = rowsById.get(placeId);
  if (!source || !place) return state;
  const clone = cloneRowWithSuffix(source, suffix, local);
  clone.index = (place.index ?? 0) + 1;
  const next = cloneState(state);
  next.dupRows = [...state.dupRows, clone];
  return next;
}

// ---------------------------------------------------------------------------
// Template / width / chrome overrides
// (changeTemplates, changeWidth, changePointBar, changeBackground)
// ---------------------------------------------------------------------------

interface Targetish {
  id: string;
  groups?: string[];
}

/** True when `entity` is a target of a comma list (choice/row/group ids). */
function listContains(
  list: string | undefined,
  entity: Targetish,
  isRow: boolean,
  idx: CyoaIndex,
): boolean {
  if (!list) return false;
  const items = list
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (items.includes(entity.id)) return true;
  for (const item of items) {
    const group = idx.groupMap.get(item);
    if (!group) continue;
    if (isRow) {
      if ((group.rowElements ?? []).includes(entity.id)) return true;
    } else if ((group.elements ?? []).includes(entity.id)) {
      return true;
    }
  }
  return false;
}

/**
 * Template override from the last-selected active `changeTemplates` choice
 * that targets `entity` (LIFO semantics of the original templateStack).
 */
export function templateOverrideFor(
  entity: Targetish,
  isRow: boolean,
  idx: CyoaIndex,
  state: CyoaState,
): number | undefined {
  let override: number | undefined;
  for (const [id, entry] of state.activated) {
    if (entry.isRowButton || entry.isVariable) continue;
    const choice = idx.choiceMap.get(id)?.choice as
      | (Choice & {
          changeTemplates?: boolean;
          changeTemplatesList?: string;
          changeToThisTemplate?: number;
        })
      | undefined;
    if (!choice?.changeTemplates) continue;
    if (!listContains(choice.changeTemplatesList, entity, isRow, idx)) continue;
    override = Number(choice.changeToThisTemplate ?? 1);
  }
  return override;
}

/** Effective template of a row/choice/addon (base unless overridden). */
export function effectiveTemplate(
  entity: { template?: number; id: string; groups?: string[] },
  isRow: boolean,
  idx: CyoaIndex,
  state: CyoaState,
): number {
  return templateOverrideFor(entity, isRow, idx, state) ?? Number(entity.template ?? 1);
}

/** Width override from the last-selected active `changeWidth` choice. */
export function widthOverrideFor(
  entity: Targetish,
  isRow: boolean,
  idx: CyoaIndex,
  state: CyoaState,
): string | undefined {
  let override: string | undefined;
  for (const [id, entry] of state.activated) {
    if (entry.isRowButton || entry.isVariable) continue;
    const choice = idx.choiceMap.get(id)?.choice as
      | (Choice & { changeWidth?: boolean; changeWidthList?: string; changeToThisWidth?: string })
      | undefined;
    if (!choice?.changeWidth) continue;
    if (!listContains(choice.changeWidthList, entity, isRow, idx)) continue;
    override = choice.changeToThisWidth;
  }
  return override;
}

/** Effective width of a row/choice (base unless overridden). */
export function effectiveWidth(
  entity: { objectWidth?: string; id: string; groups?: string[] },
  isRow: boolean,
  idx: CyoaIndex,
  state: CyoaState,
): string {
  return widthOverrideFor(entity, isRow, idx, state) ?? entity.objectWidth ?? "";
}

export interface PointBarOverrides {
  bgColor?: string;
  textColor?: string;
  iconColor?: string;
}

/** Point-bar color overrides from active `changePointBar` choices. */
export function pointBarOverrides(idx: CyoaIndex, state: CyoaState): PointBarOverrides {
  const out: PointBarOverrides = {};
  for (const [id, entry] of state.activated) {
    if (entry.isRowButton || entry.isVariable) continue;
    const choice = idx.choiceMap.get(id)?.choice as
      | (Choice & {
          changePointBar?: boolean;
          changeBarBgColorIsOn?: boolean;
          changedBarBgColor?: string;
          changeBarTextColorIsOn?: boolean;
          changedBarTextColor?: string;
          changeBarIconColorIsOn?: boolean;
          changedBarIconColor?: string;
        })
      | undefined;
    if (!choice?.changePointBar) continue;
    if (choice.changeBarBgColorIsOn && choice.changedBarBgColor) {
      out.bgColor = choice.changedBarBgColor;
    }
    if (choice.changeBarTextColorIsOn && choice.changedBarTextColor) {
      out.textColor = choice.changedBarTextColor;
    }
    if (choice.changeBarIconColorIsOn && choice.changedBarIconColor) {
      out.iconColor = choice.changedBarIconColor;
    }
  }
  return out;
}

export interface BackgroundOverrides {
  color?: string;
  image?: string;
}

/** Background overrides from active `changeBackground` choices. */
export function backgroundOverrides(idx: CyoaIndex, state: CyoaState): BackgroundOverrides {
  const out: BackgroundOverrides = {};
  for (const [id, entry] of state.activated) {
    if (entry.isRowButton || entry.isVariable) continue;
    const choice = idx.choiceMap.get(id)?.choice as
      | (Choice & {
          changeBackground?: boolean;
          changeBgImage?: boolean;
          bgImage?: string;
          changedBgColorCode?: string;
        })
      | undefined;
    if (!choice?.changeBackground) continue;
    if (choice.changeBgImage) {
      if (choice.bgImage) out.image = choice.bgImage;
    } else if (choice.changedBgColorCode) {
      out.color = choice.changedBgColorCode;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Build codes — `getSelectedObjectId` / `loadActivated` equivalents
// ---------------------------------------------------------------------------

/** Encode the current session as a comma-joined build code. */
export function encodeBuildCode(app: App, idx: CyoaIndex, state: CyoaState): string {
  const result: string[] = [];
  for (const [id, val] of state.activated) {
    if (val.isRowButton) {
      const rMap = idx.choiceMap.get(id);
      void rMap;
      result.push(`${id}/RP#${val.rndPoint ?? ""}/NUM#${val.pointNum ?? 0}`);
    } else if (val.isVariable) {
      // Variables are serialized below, including false overrides.
    } else {
      const cMap = idx.choiceMap.get(id);
      if (!cMap) continue;
      const aChoice = cMap.choice;
      let text = id;
      const rnd: string[] = [];
      if (val.multiple !== 0) text += `/ON#${val.multiple}`;
      (aChoice.scores ?? []).forEach((score, i) => {
        if (!score.isRandom && !score.useExpression) return;
        const sharedRoll =
          state.rolledScores.get(`${id}:${i}`) ??
          (score.isRandom && score.setValue ? Number(score.value) : undefined);
        if (sharedRoll !== undefined) rnd.push(`${i}:${sharedRoll}`);
        const rollPrefix = `${id}:${i}:`;
        for (const [key, roll] of state.rolledScores) {
          if (!key.startsWith(rollPrefix)) continue;
          const count = Number(key.slice(rollPrefix.length));
          if (
            Number.isInteger(count) &&
            count >= 1 &&
            count <= Math.max(1, Math.abs(val.multiple))
          ) {
            // The optional third field records the selection count; old
            // index:value tokens remain valid for a shared roll.
            rnd.push(`${i}:${roll}:${count}`);
          }
        }
      });
      if (rnd.length > 0) text += `/RS#${rnd.join("/AND#")}`;
      const paid: string[] = [];
      for (const [key, active] of state.scoreActivations ?? []) {
        if (!key.startsWith(`${id}:`)) continue;
        const [index, count] = key
          .slice(id.length + 1)
          .split(":")
          .map(Number);
        if (count >= 1 && count <= Math.max(1, Math.abs(val.multiple)))
          paid.push(`${index}:${active ? 1 : 0}:${count}`);
      }
      // Optional C-CAN extension: preserve prices paid when gates changed
      // between copies. Legacy ICCPlus build codes remain accepted.
      if (paid.length) text += `/SA#${paid.join("/AND#")}`;
      // Random linked activations round-trip through state (the original
      // stores them on the choice as `activatedRandom[Mul]`).
      if (aChoice.isActivateRandom) {
        const perCount = state.activatedRandom.get(id);
        const flattened = perCount ? perCount.flat() : [];
        if (flattened.length > 0) {
          text += `/RND#${flattened.join("/AND#").replace(/\/ON#/g, "/RON#")}`;
        }
      }
      if (aChoice.textfieldIsOn && aChoice.customTextfieldIsOn) {
        const word =
          state.wordValues.get(aChoice.idOfTheTextfieldWord ?? "") ?? aChoice.wordChangeSelect;
        if (word !== undefined) text += `/WORD2#${encodeURIComponent(JSON.stringify(word))}`;
      }
      if (aChoice.isImageUpload) {
        const image =
          state.uploadedImages.get(id) ??
          (aChoice.image !== aChoice.defaultImage ? aChoice.image : undefined);
        if (image !== undefined) text += `/IMG2#${encodeURIComponent(JSON.stringify(image))}`;
      }
      result.push(text);
    }
  }
  for (const variable of app.variables ?? []) {
    const value = state.variables.get(variable.id) ?? variable.isTrue === true;
    result.push(`${variable.id}/VAR#${value ? 1 : 0}`);
  }
  return result.join(",");
}

export interface ParsedBuildEntry {
  id: string;
  multiple: number;
  variable?: boolean;
  rowButton?: { pointId: string; num: number };
  word?: string;
  image?: string;
  randomRolls?: Array<{ index: number; value: number; count?: number }>;
  randomActivations?: string[];
  scoreActivations?: Array<{ index: number; active: boolean; count: number }>;
}

/** Version 2 text fields contain URI-encoded JSON strings, so all build markers
 * and whitespace remain literal. JSON also preserves unpaired surrogates. */
function decodeBuildText(value: string, version: string): string | undefined {
  if (!version) return value.replace(/\/CHAR#/g, ",");
  try {
    const decoded: unknown = JSON.parse(decodeURIComponent(value));
    return typeof decoded === "string" ? decoded : undefined;
  } catch {
    return undefined;
  }
}

/** Parse a build code into structured entries (does not touch state). */
export function parseBuildCode(code: string): ParsedBuildEntry[] {
  if (!code) return [];
  return code
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      // Legacy text/URLs may contain token-looking strings. Structural fields
      // end at the first text field and must never be read from its payload.
      const textStart = part.search(/\/(?:WORD2?|IMG2?)#/);
      const metadata = textStart < 0 ? part : part.slice(0, textStart);
      // Base id: everything before the first token marker.
      const idCut = metadata.match(/^(.*?)(?=\/ON#|\/RP#|\/RS#|\/SA#|\/RND#|\/VAR#|$)/);
      const entry: ParsedBuildEntry = { id: idCut ? idCut[1] : metadata, multiple: 0 };
      const variableMatch = metadata.match(/\/VAR#([01])$/);
      if (variableMatch) entry.variable = variableMatch[1] === "1";
      const onMatch = metadata.match(/^(.*?)\/ON#(-?\d+)/);
      if (onMatch) {
        entry.multiple = parseInt(onMatch[2], 10) || 0;
      }
      const rpMatch = metadata.match(
        /^(.*)\/RP#([^/]*)\/NUM#(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)(?=\/|$)/i,
      );
      if (rpMatch) {
        entry.id = rpMatch[1];
        entry.rowButton = { pointId: rpMatch[2], num: Number(rpMatch[3]) || 0 };
      }
      const fields = textStart < 0 ? "" : part.slice(textStart);
      const wordMatch = fields.match(/^\/WORD(2?)#(.*?)(?:\/IMG2?#|$)/s);
      if (wordMatch) entry.word = decodeBuildText(wordMatch[2], wordMatch[1]);
      const imgMatch = part.match(/\/IMG(2?)#(.*)$/s);
      if (imgMatch) entry.image = decodeBuildText(imgMatch[2], imgMatch[1]);
      const rsMatch = metadata.match(/\/RS#(.+?)(?:\/RND#|\/SA#|$)/);
      if (rsMatch) {
        entry.randomRolls = rsMatch[1].split("/AND#").map((pair) => {
          const [index, value, count] = pair.split(":");
          return {
            index: parseInt(index, 10) || 0,
            value: Number(value) || 0,
            ...(count === undefined ? {} : { count: parseInt(count, 10) || 1 }),
          };
        });
      }
      const saMatch = metadata.match(/\/SA#(.+?)(?:\/RND#|\/RS#|$)/);
      if (saMatch) {
        entry.scoreActivations = saMatch[1].split("/AND#").flatMap((item) => {
          const match = item.match(/^(\d+):([01]):([1-9]\d*)$/);
          return match
            ? [{ index: Number(match[1]), active: match[2] === "1", count: Number(match[3]) }]
            : [];
        });
      }
      const rndMatch = metadata.match(/\/RND#(.+?)(?:\/RS#|\/SA#|$)/);
      if (rndMatch) {
        entry.randomActivations = rndMatch[1]
          .split("/AND#")
          .map((id) => id.replace(/\/RON#/g, "/ON#"));
      }
      return entry;
    });
}

/** Apply a build code to a fresh state (equivalent of `loadActivated`). */
export function loadBuildCode(code: string, app: App, idx: CyoaIndex): CyoaState {
  let state = createCyoaState({ ...app, activated: [] });
  // A build replaces the document's initial selection state. Persisted row
  // counts may be stale and must be rebuilt from the entries actually loaded.
  state.currentChoices = new Map([...idx.rowById.keys()].map((id) => [id, 0]));
  // One entry per id, with the last occurrence winning. Repeated tokens must
  // not award row-button points twice or inflate a row's selected count.
  const entries = new Map(parseBuildCode(code).map((entry) => [entry.id, entry])).values();
  const variableOverrides = new Map<string, boolean>();
  for (const entry of entries) {
    if (entry.rowButton) {
      state.activated.set(entry.id, {
        multiple: 0,
        isRowButton: true,
        rndPoint: entry.rowButton.pointId,
        pointNum: entry.rowButton.num,
      });
      if (idx.pointTypeMap.has(entry.rowButton.pointId)) {
        state.pointAdjustments.set(
          entry.rowButton.pointId,
          (state.pointAdjustments.get(entry.rowButton.pointId) ?? 0) + entry.rowButton.num,
        );
      }
      continue;
    }
    if (idx.variableMap.has(entry.id)) {
      // Bare variable ids in old builds mean true. Explicit snapshots win
      // over replayed choice effects, regardless of token order.
      variableOverrides.set(entry.id, entry.variable ?? true);
      continue;
    }
    const cMap = idx.choiceMap.get(entry.id);
    if (!cMap) continue;
    const { choice } = cMap;
    state = recordScoreActivations(state, choice, idx, entry.multiple);
    for (const activation of entry.scoreActivations ?? []) {
      if (
        choice.scores[activation.index] &&
        activation.count <= Math.max(1, Math.abs(entry.multiple))
      ) {
        state.scoreActivations!.set(
          `${entry.id}:${activation.index}:${activation.count}`,
          activation.active,
        );
      }
    }
    setActivated(state, idx, entry.id, {
      ...state.activated.get(entry.id),
      multiple: entry.multiple,
    });
    if (choice.textfieldIsOn && choice.idOfTheTextfieldWord) {
      state.wordValues.set(
        choice.idOfTheTextfieldWord,
        entry.word ?? choice.wordChangeSelect ?? "",
      );
    }
    if (entry.image !== undefined) state.uploadedImages.set(entry.id, entry.image);
    if (entry.randomRolls) {
      for (const roll of entry.randomRolls) {
        const key = `${entry.id}:${roll.index}`;
        state.rolledScores.set(roll.count === undefined ? key : `${key}:${roll.count}`, roll.value);
      }
    }
    if (choice.changeType !== "3" || Math.max(1, entry.multiple) % 2 === 1) {
      state = applyChoiceVariables(state, choice, idx, true);
    }
    if (entry.randomActivations && entry.randomActivations.length > 0) {
      // Replay the recorded random linked activations (mirrors
      // `activatedRandomMul` / `activatedRandom`); the override branch of
      // `applyActivateOther` chunks them per selection count.
      state = applyActivateOther(state, choice, idx, entry.randomActivations);
    }
  }
  for (const [id, value] of variableOverrides) {
    state.variables.set(id, value);
    if (value) state.activated.set(id, { multiple: 0, isVariable: true });
    else state.activated.delete(id);
  }
  return state;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchableEntry {
  id: string;
  label: string;
  choice: Choice;
  row: Row;
}

export function getSearchables(app: App): SearchableEntry[] {
  const entries: SearchableEntry[] = [];
  for (const row of app.rows ?? []) {
    for (const choice of row.objects ?? []) {
      if (choice.isNotSelectable || choice.isNotSearchable) continue;
      entries.push({ id: choice.id, label: choice.title || choice.id, choice, row });
      for (const addon of choice.addons ?? []) {
        if (!addon.isSelectable || addon.isNotSelectable || addon.isNotSearchable) continue;
        entries.push({
          id: addon.id,
          label: addon.title || addon.id,
          choice: addon as unknown as Choice,
          row,
        });
      }
    }
  }
  return entries;
}

/** Entity kinds covered by the project-wide search bar. */
export type ProjectSearchType =
  | "choice"
  | "addon"
  | "row"
  | "point"
  | "group"
  | "globalRequirement"
  | "word";

export interface ProjectSearchEntry {
  type: ProjectSearchType;
  id: string;
  /** Human-readable label shown in the result list. */
  label: string;
  /** Short kind label, e.g. "Choice" / "Point". */
  kindLabel: string;
  /** For choice/addon entries: the object to select and the row it lives in. */
  choice?: Choice;
  row?: Row;
  /** For addon entries: the parent choice id (scroll + toggle target). */
  parentId?: string;
}

/**
 * Every jumpable/searchable entity in the document: rows, selectable
 * choices, selectable addons, point types, groups, global requirements and
 * words. The viewer's search bar filters these by kind and jumps to them.
 */
export function getProjectSearchEntries(app: App): ProjectSearchEntry[] {
  const entries: ProjectSearchEntry[] = [];
  for (const row of app.rows ?? []) {
    entries.push({ type: "row", id: row.id, label: row.title || row.id, kindLabel: "Row", row });
    for (const choice of row.objects ?? []) {
      if (!choice.isNotSelectable && !choice.isNotSearchable) {
        entries.push({
          type: "choice",
          id: choice.id,
          label: choice.title || choice.id,
          kindLabel: "Choice",
          choice,
          row,
        });
      }
      for (const addon of choice.addons ?? []) {
        if (!addon.isSelectable || addon.isNotSelectable || addon.isNotSearchable) continue;
        entries.push({
          type: "addon",
          id: addon.id,
          label: addon.title || addon.id,
          kindLabel: "Addon",
          choice: addon as unknown as Choice,
          row,
          parentId: choice.id,
        });
      }
    }
  }
  for (const point of app.pointTypes ?? []) {
    entries.push({
      type: "point",
      id: point.id,
      label: point.name || point.id,
      kindLabel: "Point",
    });
  }
  for (const group of app.groups ?? []) {
    entries.push({
      type: "group",
      id: group.id,
      label: group.name || group.id,
      kindLabel: "Group",
    });
  }
  for (const globalReq of app.globalRequirements ?? []) {
    entries.push({
      type: "globalRequirement",
      id: globalReq.id,
      label: globalReq.name || globalReq.id,
      kindLabel: "Requirement",
    });
  }
  for (const word of app.words ?? []) {
    entries.push({
      type: "word",
      id: word.id,
      label: word.replaceText || word.id,
      kindLabel: "Word",
    });
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Result / group rows
// ---------------------------------------------------------------------------

/** Choices shown by a result row, following the original result-row rules. */
export function resultRowChoices(
  row: Row,
  idx: CyoaIndex,
  state: CyoaState,
): Array<{ choice: Choice; row: Row }> {
  const out: Array<{ choice: Choice; row: Row }> = [];
  const activatedIds = new Set<string>();
  for (const id of state.activated.keys()) {
    const entry = state.activated.get(id);
    if (entry?.isRowButton || entry?.isVariable) continue;
    const cMap = idx.choiceMap.get(id);
    if (!cMap) continue;
    const { choice } = cMap;
    if (choice.parentId) continue;
    if (choice.isNotResult) continue;
    if (row.resultGroupId) {
      const group = idx.groupMap.get(row.resultGroupId);
      const inGroup = (choice.groups ?? []).includes(row.resultGroupId);
      const matchesResultGroup = choice.resultGroupId === row.resultGroupId || inGroup;
      if (group) {
        if (!matchesResultGroup && !(group.elements ?? []).includes(choice.id)) continue;
      } else if (!matchesResultGroup) {
        continue;
      }
    }
    activatedIds.add(id);
  }
  for (const [id, cMap] of idx.choiceMap) {
    void id;
    if (!activatedIds.has(cMap.choice.id)) continue;
    out.push({ choice: cMap.choice, row: cMap.row });
  }
  out.sort((a, b) => {
    const ra = a.row.index ?? 0;
    const rb = b.row.index ?? 0;
    if (ra !== rb) return ra - rb;
    return (a.choice.index ?? 0) - (b.choice.index ?? 0);
  });
  return out;
}

/** Choices shown by a group row (all choices of the referenced group). */
export function groupRowChoices(row: Row, idx: CyoaIndex): Array<{ choice: Choice; row: Row }> {
  const out: Array<{ choice: Choice; row: Row }> = [];
  const group = idx.groupMap.get(row.resultGroupId ?? "");
  if (!group) return out;
  for (const elementId of group.elements ?? []) {
    const cMap = idx.choiceMap.get(elementId);
    if (!cMap) continue;
    if (cMap.choice.parentId) continue;
    out.push({ choice: cMap.choice, row: cMap.row });
  }
  return out;
}

/**
 * Hide flags applied to a row by currently-active `isContentHidden` choices
 * (port of the original `selectHideContent`). Flag keys match
 * `hiddenContentsType` values: 1 title, 2 image, 3 text, 4 scores,
 * 5 requirements, 6 addon title, 7 addon image, 8 addon text,
 * 9 unselected addons, 10 addons with unmet requirements.
 */
export function hiddenContentsFor(row: Row, idx: CyoaIndex, state: CyoaState): Set<string> {
  const flags = new Set<string>();
  for (const [id, entry] of state.activated) {
    if (entry.isRowButton || entry.isVariable) continue;
    const cMap = idx.choiceMap.get(id);
    const choice = cMap?.choice as
      | (Choice & {
          isContentHidden?: boolean;
          hiddenContentsRow?: string[];
          hiddenContentsType?: string[];
        })
      | undefined;
    if (!choice?.isContentHidden) continue;
    if (!(choice.hiddenContentsRow ?? []).includes(row.id)) continue;
    for (const type of choice.hiddenContentsType ?? []) flags.add(type);
  }
  return flags;
}

// ---------------------------------------------------------------------------
// Misc helpers shared by editor + viewer
// ---------------------------------------------------------------------------

export function hexToRgba(hex: string, opacity: number): string {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6 && cleaned.length !== 3) return hex;
  const full =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
