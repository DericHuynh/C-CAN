import { isEnabled, type CyoaIndex, type CyoaState } from "@shared/cyoa-engine";
import { buildFilterString, getStyling } from "@shared/cyoa-styling";
import type { App, Choice, PointType, Row } from "@shared/types";

export type ChoiceVisualState = "selected" | "req" | "unselected";

/** The visual state a choice is in right now (drives filters/colors). */
export function choiceVisualState(
  choice: Choice,
  idx: CyoaIndex,
  state: CyoaState,
): ChoiceVisualState {
  if (state.activated.has(choice.id)) return "selected";
  if (!isEnabled(choice.requireds, idx, state)) return "req";
  return "unselected";
}

const FILTER_PREFIX: Record<ChoiceVisualState, "sel" | "req" | "unsel"> = {
  selected: "sel",
  req: "req",
  unselected: "unsel",
};

export interface ChoiceSurfaceStyle {
  filter: string;
  background: string;
  backgroundImage: string;
  backgroundRepeat: string;
  backgroundSize: string;
  backgroundColor: string;
  borderColor: string;
  imageBorderColor: string;
  titleColor: string;
  textColor: string;
  addonTitleColor: string;
  addonTextColor: string;
  scoreColor: string;
  gradient: string;
  visible: boolean;
}

/**
 * Resolve the full filter/background/border/color surface for a choice in its
 * current state, from the styling cascade.
 */
export function choiceSurfaceStyle(
  choice: Choice,
  row: Row,
  idx: CyoaIndex,
  state: CyoaState,
): ChoiceSurfaceStyle {
  const visualState = choiceVisualState(choice, idx, state);
  const prefix = FILTER_PREFIX[visualState];
  const styling = getStyling("objectGradient", idx, state, row, choice);
  const gradient = getStyling("objectGradient", idx, state, row, choice);
  const filterStyling = getStyling("filterStyling", idx, state, row, choice);

  const str = (key: string): string => {
    const v = filterStyling[key];
    return typeof v === "string" ? v : "";
  };
  const num = (key: string): number | undefined => {
    const v = filterStyling[key];
    return typeof v === "number" ? v : undefined;
  };
  const isOn = (key: string): boolean => filterStyling[key] === true;

  const statePrefix = `${prefix}`;

  let background = "";
  let backgroundImage = "";
  let backgroundRepeat = "";
  let backgroundSize = "";
  if (isOn(`${statePrefix}BgColorIsOn`)) {
    background = str(`${statePrefix}FilterBgColor`);
    if (isOn(`${statePrefix}OverlayOnImage`)) {
      background = `linear-gradient(${background}, ${background})`;
    }
  }
  if (isOn(`${statePrefix}OverlayOnImage`) && isOn(`${statePrefix}BgColorIsOn`)) {
    backgroundImage = "none";
  }

  const gradientValue =
    visualState === "selected"
      ? str("objectGradientOnSelect")
      : visualState === "req"
        ? str("objectGradientOnReq")
        : str("objectGradient");

  let borderColor = "";
  if (isOn(`${statePrefix}BorderColorIsOn`)) borderColor = str(`${statePrefix}FilterBorderColor`);
  let imageBorderColor = "";
  if (isOn(`${statePrefix}ImgBorderColorIsOn`)) imageBorderColor = str(`${statePrefix}FilterImgBorderColor`);
  let titleColor = "";
  if (isOn(`${statePrefix}CTitleColorIsOn`)) titleColor = str(`${statePrefix}FilterCTitleColor`);
  let textColor = "";
  if (isOn(`${statePrefix}CTextColorIsOn`)) textColor = str(`${statePrefix}FilterCTextColor`);
  let addonTitleColor = "";
  if (isOn(`${statePrefix}ATitleColorIsOn`)) addonTitleColor = str(`${statePrefix}FilterATitleColor`);
  let addonTextColor = "";
  if (isOn(`${statePrefix}ATextColorIsOn`)) addonTextColor = str(`${statePrefix}FilterATextColor`);
  let scoreColor = "";
  if (isOn(`${statePrefix}ScoreTextColorIsOn`)) scoreColor = str(`${statePrefix}FilterSTextColor`);

  const visible = !isOn(`${statePrefix}FilterVisibleIsOn`);
  const blur = isOn(`${statePrefix}FilterBlurIsOn`) ? `blur(${num(`${statePrefix}FilterBlur`) ?? 0}px)` : "";
  void gradient;

  return {
    filter: buildFilterString(filterStyling, prefix),
    background,
    backgroundImage,
    backgroundRepeat: "repeat",
    backgroundSize: "cover",
    backgroundColor: background,
    borderColor,
    imageBorderColor,
    titleColor,
    textColor,
    addonTitleColor,
    addonTextColor,
    scoreColor,
    gradient: gradientValue,
    visible,
  };
}

/** CSS filter string for an addon in its current state. */
export function addonFilter(
  addon: Choice,
  row: Row,
  idx: CyoaIndex,
  state: CyoaState,
): string {
  const visualState = choiceVisualState(addon, idx, state);
  const filterStyling = getStyling("filterStyling", idx, state, row, addon);
  return buildFilterString(filterStyling, FILTER_PREFIX[visualState]);
}

/** Text styling for a text group (row title, choice text, ...). */
export function textStyle(
  group: "rowTitle" | "rowText" | "objectTitle" | "objectText" | "addonTitle" | "addonText" | "scoreText",
  idx: CyoaIndex,
  state: CyoaState,
  row?: Row,
  choice?: Choice,
): React.CSSProperties {
  const styling = getStyling("textStyling", idx, state, row, choice) as Record<
    string,
    unknown
  >;
  const custom = styling[`custom${group[0].toUpperCase()}${group.slice(1)}`] === true;
  const family =
    (custom ? styling[group] : styling[group]) || undefined;
  const size = styling[`${group}TextSize`];
  const color = styling[`${group}Color`];
  const align = styling[`${group}Align`];
  return {
    fontFamily: typeof family === "string" ? family : undefined,
    fontSize: typeof size === "number" ? `${size}%` : undefined,
    color: typeof color === "string" ? color : undefined,
    textAlign: typeof align === "string" ? (align as React.CSSProperties["textAlign"]) : undefined,
  };
}

/** Column width class for a row, honoring `enableHalfRow` / viewport. */
export function rowWidthClass(row: Row, app: App, viewport: number): string {
  if (row.width && (viewport > 1280 || app.enableHalfRow)) return "col-6";
  return "col-12";
}

/** Column width class for a choice within its row. */
export function choiceWidthClass(
  row: Row,
  choice: Choice,
  app: App,
  viewport: number,
): string {
  if (app.objectsPerRow) {
    switch (Number(app.objectsPerRow)) {
      case 3:
        return "col-sm-4";
      case 4:
        return "col-sm-3";
      default:
        break;
    }
  }
  const width = row.overrideWidth ? row.objectWidth : choice.objectWidth;
  if (row.choicesShareTemplate && row.objectsPerRow) {
    switch (Number(row.objectsPerRow)) {
      case 2:
        return "col-sm-6";
      case 3:
        return "col-sm-4";
      case 4:
        return "col-sm-3";
      default:
        break;
    }
  }
  if (viewport > 1280) return width || "col-sm-6 col-12";
  if (viewport > 480) return "col-sm-6 col-12";
  return "col-12";
}

/** Format a point value with the point type's decimal places. */
export function formatPointValue(point: PointType, value: number): string {
  if (Number.isInteger(value) || !point.allowFloat) {
    return String(value);
  }
  const places = point.decimalPlaces ?? 2;
  return value.toFixed(places);
}

/** Row template layout: 1 image-top, 2 image-right, 3 image-left, 4 image-bottom, 5 image-center. */
export function templateClasses(template: number | undefined): {
  container: string;
  image: string;
  body: string;
} {
  switch (template) {
    case 2:
      return { container: "flex flex-row gap-3", image: "w-2/5 shrink-0", body: "flex-1" };
    case 3:
      return { container: "flex flex-row-reverse gap-3", image: "w-2/5 shrink-0", body: "flex-1" };
    case 5:
      return { container: "space-y-3", image: "absolute inset-0", body: "relative" };
    case 4:
      return { container: "flex flex-col-reverse gap-3", image: "", body: "" };
    case 1:
    default:
      return { container: "space-y-3", image: "", body: "" };
  }
}

/** True when the choice should be hidden by its state's filter visibility. */
export function isChoiceShown(
  choice: Choice,
  row: Row,
  idx: CyoaIndex,
  state: CyoaState,
): boolean {
  const styling = getStyling("filterStyling", idx, state, row, choice) as Record<
    string,
    unknown
  >;
  const visualState = choiceVisualState(choice, idx, state);
  const prefix = FILTER_PREFIX[visualState];
  return styling[`${prefix}FilterVisibleIsOn`] !== true;
}
