/**
 * CYOA styling cascade — resolves a styling key for rows/choices through the
 * cascade (private styling -> object design groups -> groups' design groups ->
 * app defaults) and builds the CSS `filter` string for a choice state.
 *
 * Extracted from cyoa-engine.ts so the styling layer has a single home and a
 * single dependency direction (styling -> engine); the engine never imports
 * back here.
 */
import {
  checkActivated,
  checkRequirements,
  type CyoaIndex,
  type CyoaState,
} from "./cyoa-engine.js";
import type { Addon, Choice, Group, Row } from "./types.js";

type DesignGroupLike = {
  styling?: Record<string, unknown>;
  activatedId?: string;
  [key: string]: unknown;
};

function designGroupStyling(
  designGroups: string[] | undefined,
  designMap: Map<string, DesignGroupLike>,
  prop: string,
  idx: CyoaIndex,
  state: CyoaState,
): Record<string, unknown> | undefined {
  for (const groupId of designGroups ?? []) {
    const group = designMap.get(groupId);
    if (!group || !group[prop]) continue;
    const id = group.activatedId ?? "";
    const globalReq = idx.globalReqMap.get(id);
    if (id === "" || checkActivated(id, state)) return group.styling;
    if (globalReq && checkRequirements(globalReq, idx, state)) return group.styling;
  }
  return undefined;
}

function groupDesignGroupStyling(
  groupIds: string[] | undefined,
  groupMap: Map<string, Group>,
  designMap: Map<string, DesignGroupLike>,
  prop: string,
  idx: CyoaIndex,
  state: CyoaState,
): Record<string, unknown> | undefined {
  for (const groupId of groupIds ?? []) {
    const group = groupMap.get(groupId);
    if (!group) continue;
    const styling = designGroupStyling(group.designGroups, designMap, prop, idx, state);
    if (styling) return styling;
  }
  return undefined;
}

/**
 * Resolve the styling object for a row/choice with the full cascade:
 * private styling -> object/row design groups -> groups' design groups -> app
 * defaults.
 *
 * `prop` is the private-styling flag that gates each section (e.g.
 * `privateObjectIsOn`, `privateFilterIsOn`, `privateTextIsOn`, …) — the same
 * contract as the original ICCPlus `getStyling`, so design-group styling is
 * only consulted when that design group actually opts into the section.
 */
export function getStyling(
  prop: string,
  idx: CyoaIndex,
  state: CyoaState,
  row?: Row,
  choice?: Choice | Addon,
): Record<string, unknown> {
  const { app } = idx;
  if (choice) {
    const choiceData = choice as Choice & {
      styling?: Record<string, unknown>;
      isPrivateStyling?: boolean;
      objectDesignGroups?: string[];
      groups?: string[];
    };
    if (
      choiceData.styling !== undefined &&
      choiceData.isPrivateStyling &&
      (choiceData as unknown as Record<string, unknown>)[prop]
    ) {
      return choiceData.styling;
    }
    const direct = designGroupStyling(
      choiceData.objectDesignGroups,
      idx.objectDesignMap,
      prop,
      idx,
      state,
    );
    if (direct) return direct;
    const viaGroups = groupDesignGroupStyling(
      choiceData.groups,
      idx.groupMap,
      idx.objectDesignMap,
      prop,
      idx,
      state,
    );
    if (viaGroups) return viaGroups;
  }
  if (row) {
    const rowData = row as Row & {
      styling?: Record<string, unknown>;
      isPrivateStyling?: boolean;
      rowDesignGroups?: string[];
      groups?: string[];
    };
    if (
      rowData.styling !== undefined &&
      rowData.isPrivateStyling &&
      (rowData as unknown as Record<string, unknown>)[prop]
    ) {
      return rowData.styling;
    }
    const direct = designGroupStyling(rowData.rowDesignGroups, idx.rowDesignMap, prop, idx, state);
    if (direct) return direct;
    const viaGroups = groupDesignGroupStyling(
      rowData.groups,
      idx.groupMap,
      idx.rowDesignMap,
      prop,
      idx,
      state,
    );
    if (viaGroups) return viaGroups;
  }
  return app.styling as Record<string, unknown>;
}

/** CSS `filter` string for a choice state (selected / unmet / unselected). */
export function buildFilterString(
  styling: Record<string, unknown>,
  state: "sel" | "req" | "unsel",
): string {
  const parts: string[] = [];
  const get = (key: string): unknown => styling[key];
  // ICCPlus stores some numeric styling fields as strings (the editor's input
  // fields write `"50"`); the original viewer interpolates them directly, so
  // coerce numeric strings here to match.
  const value = (key: string): number | undefined => {
    const v = get(key);
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
      return Number(v);
    }
    return undefined;
  };
  const isOn = (key: string): boolean => get(key) === true;
  const prefix = state;

  const push = (key: string, unit: string, fallback = 0) => {
    if (isOn(`${prefix}${key}IsOn`))
      parts.push(
        `${key.replace(/^[A-Z]/, (c) => c.toLowerCase())}(${value(`${prefix}${key}`) ?? fallback}${unit})`,
      );
  };
  if (isOn(`${prefix}FilterBlurIsOn`)) parts.push(`blur(${value(`${prefix}FilterBlur`) ?? 0}px)`);
  if (isOn(`${prefix}FilterBrightIsOn`))
    parts.push(`brightness(${value(`${prefix}FilterBright`) ?? 100}%)`);
  if (isOn(`${prefix}FilterContIsOn`))
    parts.push(`contrast(${value(`${prefix}FilterCont`) ?? 100}%)`);
  if (isOn(`${prefix}FilterGrayIsOn`))
    parts.push(`grayscale(${value(`${prefix}FilterGray`) ?? 0}%)`);
  if (isOn(`${prefix}FilterHueIsOn`))
    parts.push(`hue-rotate(${value(`${prefix}FilterHue`) ?? 0}deg)`);
  if (isOn(`${prefix}FilterInvertIsOn`))
    parts.push(`invert(${value(`${prefix}FilterInvert`) ?? 0}%)`);
  if (isOn(`${prefix}FilterOpacIsOn`))
    parts.push(`opacity(${value(`${prefix}FilterOpac`) ?? 100}%)`);
  if (isOn(`${prefix}FilterSaturIsOn`))
    parts.push(`saturate(${value(`${prefix}FilterSatur`) ?? 100}%)`);
  if (isOn(`${prefix}FilterSepiaIsOn`)) parts.push(`sepia(${value(`${prefix}FilterSepia`) ?? 0}%)`);
  return parts.join(" ");
}
