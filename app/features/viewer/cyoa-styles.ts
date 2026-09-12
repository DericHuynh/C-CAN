import DOMPurify from "isomorphic-dompurify";

import {
  checkActivated,
  checkRequirements,
  effectiveTemplate,
  isEnabled,
  replaceText,
  type CyoaIndex,
  type CyoaState,
} from "@shared/cyoa-engine";
import { buildFilterString, getStyling } from "@shared/cyoa-styling";
import { resolveImageRef } from "@shared/cyoa";
import type { Addon, App, Choice, PointType, Row } from "@shared/types";
import type { CSSProperties } from "react";

/**
 * Sanitizer configuration matching the original ICCPlus viewer's `sanitizeArg`:
 * the tag whitelist plus the extra attributes CYOA documents rely on.
 */
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "address",
    "article",
    "aside",
    "footer",
    "header",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hgroup",
    "nav",
    "section",
    "blockquote",
    "dd",
    "div",
    "dl",
    "dt",
    "figcaption",
    "figure",
    "hr",
    "li",
    "main",
    "ol",
    "p",
    "pre",
    "ul",
    "a",
    "abbr",
    "b",
    "bdi",
    "bdo",
    "br",
    "cite",
    "code",
    "data",
    "dfn",
    "em",
    "i",
    "kbd",
    "mark",
    "q",
    "rb",
    "rp",
    "rt",
    "rtc",
    "ruby",
    "s",
    "samp",
    "small",
    "span",
    "strong",
    "sub",
    "sup",
    "time",
    "u",
    "var",
    "wbr",
    "caption",
    "col",
    "colgroup",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "tr",
    "font",
    "iframe",
    "img",
  ],
  ADD_ATTR: ["href", "target", "style", "class"],
};

/** Sanitize arbitrary CYOA text (safe to inject via `dangerouslySetInnerHTML`). */
export function sanitizeHtml(str: string | undefined | null): string {
  return DOMPurify.sanitize(str ?? "", SANITIZE_CONFIG);
}

/**
 * Sanitized HTML for a CYOA text field, after word replacement — the React
 * equivalent of the original viewer's `{@html DOMPurify.sanitize(replaceText(…))}`.
 */
export function renderHtml(
  str: string | undefined | null,
  idx: CyoaIndex,
  state: CyoaState,
): { __html: string } {
  return { __html: sanitizeHtml(replaceText(str ?? "", idx, state)) };
}

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

/* ------------------------------------------------------------------ */
/* Shared helpers for the style resolvers                              */
/* ------------------------------------------------------------------ */

/**
 * Coerce an ICCPlus numeric value (number or numeric string — the editor
 * stores some fields as strings) to a number, with a fallback. Mirrors the
 * original viewer, which interpolates these values without type checks.
 */
export function numValue(v: unknown, fallback = 0): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return fallback;
}

/**
 * Number value with fallback. ICCPlus stores some numeric styling fields as
 * strings (the editor writes `"50"`), so accept numeric strings too — the
 * original viewer interpolates them directly without type checks.
 */
function num(style: Record<string, unknown>, key: string, fallback = 0): number {
  return numValue(style[key], fallback);
}

/** String value with fallback. */
function str(style: Record<string, unknown>, key: string): string {
  const v = style[key];
  return typeof v === "string" ? v : "";
}

/** True only when the flag is exactly `true`. */
function isOn(style: Record<string, unknown>, key: string): boolean {
  return style[key] === true;
}

/**
 * Normalize an ICCPlus gradient string into a CSS `linear-gradient(...)`.
 * The creator stores gradients with a trailing `);` fragment; the viewer
 * strips it (`gradient.split(');')[0]`) before wrapping.
 */
function gradientToCss(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  return `linear-gradient(${value.split(");")[0]})`;
}

/* ------------------------------------------------------------------ */
/* Choice surface (original AppObject.objectBackground + setFilters)   */
/* ------------------------------------------------------------------ */

export interface ChoiceSurfaceStyle {
  /** CSS filter string for the choice's current state. */
  filter: string;
  /** Background color from background styling (`objectBgColor`). */
  backgroundColor: string;
  /** Background color from the state filter (`sel/req/unsel BgColor`). */
  filterBackgroundColor: string;
  backgroundImage: string;
  backgroundRepeat: string;
  backgroundSize: string;
  /** Gradient for the current state (objectGradient*), already wrapped. */
  gradient: string;
  borderColor: string;
  borderStyle: string;
  borderWidth: string;
  borderRadius: string;
  borderImage: string;
  margin: string;
  overflow: string;
  boxShadow: string;
  imageBorderColor: string;
  titleColor: string;
  textColor: string;
  addonTitleColor: string;
  addonTextColor: string;
  scoreColor: string;
  visible: boolean;
}

/**
 * Resolve the full background/border/filter surface for a choice in its
 * current state, from the styling cascade. Port of the original viewer's
 * `AppObject.objectBackground` + `setFilters`.
 */
export function choiceSurfaceStyle(
  choice: Choice,
  row: Row,
  idx: CyoaIndex,
  state: CyoaState,
): ChoiceSurfaceStyle {
  const visualState = choiceVisualState(choice, idx, state);
  const prefix = FILTER_PREFIX[visualState];
  const objectStyle = getStyling("privateObjectIsOn", idx, state, row, choice) as Record<
    string,
    unknown
  >;
  const backgroundStyle = getStyling("privateBackgroundIsOn", idx, state, row, choice) as Record<
    string,
    unknown
  >;
  const filterStyling = getStyling("privateFilterIsOn", idx, state, row, choice) as Record<
    string,
    unknown
  >;

  const fStr = (key: string): string => str(filterStyling, key);
  const fOn = (key: string): boolean => isOn(filterStyling, key);

  // Base card background from the background styling cascade.
  let backgroundColor = "";
  if (isOn(backgroundStyle, "objectBgColorIsOn") && str(backgroundStyle, "objectBgColor")) {
    backgroundColor = str(backgroundStyle, "objectBgColor");
  }
  // Background image (repeat / fit-in / cover). Styling values may be
  // image-resource ids (the design tab writes ids) or legacy URLs — resolve
  // both to a renderable payload.
  let backgroundImage = "";
  let backgroundRepeat = "repeat";
  let backgroundSize = "cover";
  if (str(backgroundStyle, "objectBackgroundImage")) {
    backgroundImage = resolveImageRef(idx.app, str(backgroundStyle, "objectBackgroundImage")) ?? "";
    backgroundRepeat = isOn(backgroundStyle, "isObjectBackgroundRepeat") ? "repeat" : "";
    backgroundSize = isOn(backgroundStyle, "isObjectBackgroundFitIn") ? "100% 100%" : "cover";
  }

  // The state filter background overrides the card background when enabled
  // (selected -> selBgColorIsOn, unmet -> reqBgColorIsOn).
  const stateBg = fStr(`${prefix}FilterBgColor`);
  let filterBackgroundColor = "";
  if (fOn(`${prefix}BgColorIsOn`) && stateBg) {
    filterBackgroundColor = stateBg;
    backgroundColor = stateBg;
    if (!fOn(`${prefix}OverlayOnImage`)) backgroundImage = "";
  }

  // State gradient.
  let gradient = "";
  if (isOn(objectStyle, "objectGradientIsOn")) {
    const value =
      visualState === "selected"
        ? str(objectStyle, "objectGradientOnSelect")
        : visualState === "req"
          ? str(objectStyle, "objectGradientOnReq")
          : str(objectStyle, "objectGradient");
    gradient = gradientToCss(value);
  }

  // Border: filter color overrides the object border color when enabled. The
  // original viewer renders the border whenever the object border OR a state
  // filter border color is on (width/style still come from the object
  // styling), so a state border color alone must produce a border.
  const stateBorderColor = fOn(`${prefix}BorderColorIsOn`) && fStr(`${prefix}FilterBorderColor`);
  let borderColor = "";
  if (stateBorderColor) {
    borderColor = fStr(`${prefix}FilterBorderColor`);
  } else if (isOn(objectStyle, "objectBorderIsOn")) {
    borderColor = str(objectStyle, "objectBorderColor");
  }
  let borderStyle = "";
  let borderWidth = "";
  if (isOn(objectStyle, "objectBorderIsOn") || stateBorderColor) {
    borderStyle = str(objectStyle, "objectBorderStyle");
    borderWidth = `${num(objectStyle, "objectBorderWidth")}px`;
  }

  const suffix = isOn(objectStyle, "objectBorderRadiusIsPixels") ? "px" : "%";
  const borderRadius = `${num(objectStyle, "objectBorderRadiusTopLeft")}${suffix} ${num(objectStyle, "objectBorderRadiusTopRight")}${suffix} ${num(objectStyle, "objectBorderRadiusBottomRight")}${suffix} ${num(objectStyle, "objectBorderRadiusBottomLeft")}${suffix}`;

  // Drop shadow: box-shadow when opted in, otherwise a filter drop-shadow.
  let boxShadow = "";
  let filter = buildFilterString(filterStyling, prefix);
  if (isOn(objectStyle, "objectDropShadowIsOn")) {
    const shadow = `${num(objectStyle, "objectDropShadowH")}px ${num(objectStyle, "objectDropShadowV")}px ${num(objectStyle, "objectDropShadowBlur")}px ${num(objectStyle, "objectDropShadowSpread")}px ${str(objectStyle, "objectDropShadowColor")}`;
    if (isOn(objectStyle, "objectUseBoxShadowIsOn")) {
      boxShadow = shadow;
    } else if (filter) {
      filter = `${filter} drop-shadow(${shadow})`;
    } else {
      filter = `drop-shadow(${shadow})`;
    }
  }

  let imageBorderColor = "";
  if (fOn(`${prefix}ImgBorderColorIsOn`) && fStr(`${prefix}FilterImgBorderColor`)) {
    imageBorderColor = fStr(`${prefix}FilterImgBorderColor`);
  } else if (isOn(objectStyle, "objectImgBorderIsOn")) {
    imageBorderColor = str(objectStyle, "objectImgBorderColor");
  }

  const titleColor = fOn(`${prefix}CTitleColorIsOn`) ? fStr(`${prefix}FilterCTitleColor`) : "";
  const textColor = fOn(`${prefix}CTextColorIsOn`) ? fStr(`${prefix}FilterCTextColor`) : "";
  const addonTitleColor = fOn(`${prefix}ATitleColorIsOn`) ? fStr(`${prefix}FilterATitleColor`) : "";
  const addonTextColor = fOn(`${prefix}ATextColorIsOn`) ? fStr(`${prefix}FilterATextColor`) : "";
  const scoreColor = fOn(`${prefix}ScoreTextColorIsOn`) ? fStr(`${prefix}FilterSTextColor`) : "";

  return {
    filter,
    backgroundColor,
    filterBackgroundColor,
    backgroundImage,
    backgroundRepeat,
    backgroundSize,
    gradient,
    borderColor,
    borderStyle,
    borderWidth,
    borderRadius,
    // Full `border-image` shorthand with the doc's slice/width/repeat values
    // (the original viewer: `url() slices / width repeat`). Empty when the doc
    // has no border image.
    borderImage:
      str(objectStyle, "objectBorderImage") && isOn(objectStyle, "objectBorderIsOn")
        ? `url('${resolveImageRef(idx.app, str(objectStyle, "objectBorderImage"))}') ${num(objectStyle, "objectBorderImageSliceTop")} ${num(objectStyle, "objectBorderImageSliceRight")} ${num(objectStyle, "objectBorderImageSliceBottom")} ${num(objectStyle, "objectBorderImageSliceLeft")} / ${num(objectStyle, "objectBorderImageWidth")}px ${str(objectStyle, "objectBorderImageRepeat") || "stretch"}`
        : "",
    margin: `${num(objectStyle, "objectMargin")}px`,
    overflow: isOn(objectStyle, "objectOverflowIsOn") ? "hidden" : "",
    boxShadow,
    imageBorderColor,
    titleColor,
    textColor,
    addonTitleColor,
    addonTextColor,
    scoreColor,
    visible: !fOn(`${prefix}FilterVisibleIsOn`),
  };
}

/**
 * Resolve the image shown for a choice, honoring requirement-gated image
 * switching: when `imageSwitchingIsOn`, the highest-priority `ImageVariant`
 * whose requirements are met wins over the base image. Requirements may
 * target choices, selectable addons, point values, groups or global
 * requirements. Falls back to the legacy inline `image` string.
 */
export function resolveChoiceImage(
  choice: Choice,
  idx: CyoaIndex,
  state: CyoaState,
): string | undefined {
  const app = idx.app;
  if (choice.imageSwitchingIsOn && Array.isArray(choice.imageVariants)) {
    const matching = choice.imageVariants
      .filter((variant) => isEnabled(variant.requireds, idx, state))
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    if (matching.length > 0) {
      return resolveImageRef(app, matching[0].image);
    }
  }
  return resolveImageRef(app, state.uploadedImages.get(choice.id) ?? choice.image);
}

/**
 * The choice card's outer margin (`objectMargin`) as a CSS padding value for
 * the column wrapper. The original viewer puts the margin on the card itself
 * while the card is stretched by a flex parent — with `height: 100%` that
 * inflates the card beyond its content and leaves an empty band under the
 * body text. Moving the spacing to the wrapper (padding) keeps the same outer
 * gaps but lets the card size exactly to its content.
 */
export function choiceMargin(
  choice: Choice,
  row: Row,
  idx: CyoaIndex,
  state: CyoaState,
): string | undefined {
  const objectStyle = getStyling("privateObjectIsOn", idx, state, row, choice) as Record<
    string,
    unknown
  >;
  const margin = num(objectStyle, "objectMargin");
  return margin > 0 ? `${margin}px` : undefined;
}

/** CSS filter string for an addon in its current state. */
export function addonFilter(addon: Choice, row: Row, idx: CyoaIndex, state: CyoaState): string {
  const visualState = choiceVisualState(addon, idx, state);
  const filterStyling = getStyling("privateFilterIsOn", idx, state, row, addon) as Record<
    string,
    unknown
  >;
  return buildFilterString(filterStyling, FILTER_PREFIX[visualState]);
}

/** Addons inherit the parent's design sections, with their own selection state. */
export function addonSurfaceStyle(
  addon: Addon,
  choice: Choice,
  row: Row,
  idx: CyoaIndex,
  state: CyoaState,
): CSSProperties {
  const style = getStyling("privateAddonIsOn", idx, state, row, choice);
  const filters = getStyling("privateFilterIsOn", idx, state, row, choice);
  const enabled = isEnabled(choice.requireds, idx, state) && isEnabled(addon.requireds, idx, state);
  const selected = state.activated.has(addon.isSelectable ? addon.id : choice.id);
  const prefix = !enabled ? "req" : selected ? "sel" : "unsel";
  const result: CSSProperties = {};
  if (style.useAddonDesign) {
    const suffix = style.addonBorderRadiusIsPixels ? "px" : "%";
    result.padding = `${num(style, "addonTextPadding")}px`;
    result.borderRadius = ["TopLeft", "TopRight", "BottomRight", "BottomLeft"]
      .map((corner) => `${num(style, `addonBorderRadius${corner}`)}${suffix}`)
      .join(" ");
    if (style.addonOverflowIsOn) result.overflow = "hidden";
    if (style.addonBgColorIsOn) result.backgroundColor = str(style, "addonBgColor");
    if (style.useAddonBackgroundImage) {
      result.backgroundImage = `url('${resolveImageRef(idx.app, str(style, "addonBackgroundImage")) ?? ""}')`;
      result.backgroundSize = style.isAddonBackgroundFitIn ? "cover" : undefined;
      result.backgroundRepeat = style.isAddonBackgroundRepeat ? "repeat" : "no-repeat";
    }
    if (style.addonBorderIsOn) {
      result.border = `${num(style, "addonBorderWidth")}px ${str(style, "addonBorderStyle") || "solid"} ${str(style, "addonBorderColor")}`;
      if (filters[`${prefix}BorderColorIsOn`])
        result.borderColor = str(filters, `${prefix}FilterBorderColor`);
      if (style.addonBorderImage)
        result.borderImage = `url('${resolveImageRef(idx.app, str(style, "addonBorderImage"))}') ${["Top", "Right", "Bottom", "Left"].map((side) => num(style, `addonBorderImageSlice${side}`)).join(" ")} / ${num(style, "addonBorderImageWidth")}px ${str(style, "addonBorderImageRepeat") || "stretch"}`;
    }
    if (style.addonGradientIsOn) {
      const key = !enabled
        ? "addonGradientOnReq"
        : selected
          ? "addonGradientOnSelect"
          : "addonGradient";
      const gradient = str(style, key) || str(style, "addonGradient");
      if (gradient) result.backgroundImage = `linear-gradient(${gradient.split(");")[0]})`;
    }
    if (style.addonDropShadowIsOn) {
      const shadow = `${num(style, "addonDropShadowH")}px ${num(style, "addonDropShadowV")}px ${num(style, "addonDropShadowBlur")}px`;
      if (style.addonUseBoxShadowIsOn)
        result.boxShadow = `${shadow} ${num(style, "addonDropShadowSpread")}px ${str(style, "addonDropShadowColor")}`;
      else result.filter = `drop-shadow(${shadow} ${str(style, "addonDropShadowColor")})`;
    }
  }
  if (addon.isSelectable) {
    result.filter =
      [result.filter, buildFilterString(filters, prefix)].filter(Boolean).join(" ") || undefined;
    if (filters[`${prefix}BgColorIsOn`]) {
      result.backgroundColor = str(filters, `${prefix}FilterBgColor`);
      if (!filters[`${prefix}OverlayOnImage`]) result.backgroundImage = undefined;
    }
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Text styling (original objectTitle/objectText/scoreText/rowText)    */
/* ------------------------------------------------------------------ */

export type TextStyleGroup =
  | "rowTitle"
  | "rowText"
  | "objectTitle"
  | "objectText"
  | "addonTitle"
  | "addonText"
  | "scoreText";

const STATE_TEXT_KEYS: Partial<Record<TextStyleGroup, { colorOn: string; color: string }>> = {
  objectTitle: { colorOn: "CTitleColorIsOn", color: "FilterCTitleColor" },
  objectText: { colorOn: "CTextColorIsOn", color: "FilterCTextColor" },
  addonTitle: { colorOn: "ATitleColorIsOn", color: "FilterATitleColor" },
  addonText: { colorOn: "ATextColorIsOn", color: "FilterATextColor" },
  scoreText: { colorOn: "ScoreTextColorIsOn", color: "FilterSTextColor" },
};

/** Text styling for a text group (row title, choice text, ...). */
export function textStyle(
  group: TextStyleGroup,
  idx: CyoaIndex,
  state: CyoaState,
  row?: Row,
  choice?: Choice,
): React.CSSProperties {
  const styling = getStyling("privateTextIsOn", idx, state, row, choice) as Record<string, unknown>;
  const family = str(styling, group);
  const size = num(styling, `${group}TextSize`);
  const color = str(styling, `${group}Color`);
  const align = str(styling, `${group}Align`);

  // State filter colors override the base text color for choice-level groups
  // (unmet -> req*Color, selected -> sel*Color), matching the original viewer.
  let resolvedColor = color;
  if (choice && group !== "rowTitle" && group !== "rowText") {
    const keys = STATE_TEXT_KEYS[group];
    if (keys) {
      const filterStyling = getStyling("privateFilterIsOn", idx, state, row, choice) as Record<
        string,
        unknown
      >;
      const visualState = choiceVisualState(choice, idx, state);
      const prefix = FILTER_PREFIX[visualState];
      const stateColor: string =
        typeof filterStyling[`${prefix}${keys.color}`] === "string"
          ? (filterStyling[`${prefix}${keys.color}`] as string)
          : "";
      if (isOn(filterStyling, `${prefix}${keys.colorOn}`) && stateColor) {
        resolvedColor = stateColor;
      }
    }
  }

  // Padding: the original viewer applies text padding from the object/row
  // styling, not the text styling object.
  let padding: string | undefined;
  if (group === "objectText") {
    const objectStyle = getStyling("privateObjectIsOn", idx, state, row, choice) as Record<
      string,
      unknown
    >;
    padding = `${num(objectStyle, "objectTextPadding")}px`;
  } else if (group === "objectTitle") {
    const objectStyle = getStyling("privateObjectIsOn", idx, state, row, choice) as Record<
      string,
      unknown
    >;
    if (isOn(objectStyle, "titlePaddingIsOn")) {
      padding = `${num(objectStyle, "objectTextPadding")}px`;
    }
  } else if (group === "rowText") {
    const rowStyle = getStyling("privateRowIsOn", idx, state, row) as Record<string, unknown>;
    const padX = num(rowStyle, "rowTextPaddingX");
    const padY = num(rowStyle, "rowTextPaddingY");
    padding = `${padX}px ${padY}% ${padX}px ${padY}%`;
  }

  // The original viewer renders titles with `pre-line` and body text with
  // `pre-wrap` so embedded `\n` line breaks survive alongside HTML tags.
  const whiteSpace =
    group === "rowTitle" || group === "objectTitle" || group === "addonTitle"
      ? "pre-line"
      : "pre-wrap";
  return {
    fontFamily: family || undefined,
    fontSize: size > 0 ? `${size}%` : undefined,
    color: resolvedColor || undefined,
    textAlign: (align as React.CSSProperties["textAlign"]) || undefined,
    whiteSpace,
    padding,
  };
}

/* ------------------------------------------------------------------ */
/* Image sizing (original objectImage/rowImage)                        */
/* ------------------------------------------------------------------ */

/**
 * Image sizing from the styling cascade (rowImage / objectImage / addonImage),
 * including border-radius, overflow and border from the image styling.
 * Defaults match the original viewer: width 100%, natural height, no cropping;
 * a fixed height + `object-fit` only apply when the doc opts into it
 * (`*ImgObjectFillIsOn` + `*ImgObjectFillHeight`).
 */
export function imageStyle(
  kind: "rowImage" | "objectImage" | "addonImage",
  idx: CyoaIndex,
  state: CyoaState,
  row?: Row,
  choice?: Choice,
): React.CSSProperties {
  const flag =
    kind === "rowImage"
      ? "privateRowImageIsOn"
      : kind === "objectImage"
        ? "privateObjectImageIsOn"
        : "privateAddonImageIsOn";
  const styling = getStyling(flag, idx, state, row, choice) as Record<string, unknown>;
  const widthKey =
    kind === "rowImage"
      ? "rowImageWidth"
      : kind === "objectImage"
        ? "objectImageWidth"
        : "addonImageWidth";
  const fillKey =
    kind === "rowImage"
      ? "rowImgObjectFillIsOn"
      : kind === "objectImage"
        ? "objectImgObjectFillIsOn"
        : "addonImgObjectFillIsOn";
  const fillStyleKey =
    kind === "rowImage"
      ? "rowImgObjectFillStyle"
      : kind === "objectImage"
        ? "objectImgObjectFillStyle"
        : "addonImgObjectFillStyle";
  const fillHeightKey =
    kind === "rowImage"
      ? "rowImgObjectFillHeight"
      : kind === "objectImage"
        ? "objectImgObjectFillHeight"
        : "addonImgObjectFillHeight";
  const marginTopKey =
    kind === "rowImage"
      ? "rowImageMarginTop"
      : kind === "objectImage"
        ? "objectImageMarginTop"
        : "addonImageMarginTop";
  const marginBottomKey =
    kind === "rowImage"
      ? "rowImageMarginBottom"
      : kind === "objectImage"
        ? "objectImageMarginBottom"
        : "addonImageMarginBottom";
  const radiusKeys = {
    tl: `${kind === "rowImage" ? "rowImg" : kind === "objectImage" ? "objectImg" : "addonImg"}BorderRadiusTopLeft`,
    tr: `${kind === "rowImage" ? "rowImg" : kind === "objectImage" ? "objectImg" : "addonImg"}BorderRadiusTopRight`,
    br: `${kind === "rowImage" ? "rowImg" : kind === "objectImage" ? "objectImg" : "addonImg"}BorderRadiusBottomRight`,
    bl: `${kind === "rowImage" ? "rowImg" : kind === "objectImage" ? "objectImg" : "addonImg"}BorderRadiusBottomLeft`,
  };
  const imgPrefix =
    kind === "rowImage" ? "rowImg" : kind === "objectImage" ? "objectImg" : "addonImg";
  const radiusIsPixelsKey = `${imgPrefix}BorderRadiusIsPixels`;

  const width = num(styling, widthKey, 100);
  const style: React.CSSProperties = {
    width: `${width}%`,
    maxWidth: "100%",
    height: "auto",
    display: "block",
    border: "none",
  };
  // Margins are percentages of the image box in the original viewer.
  const marginTop = Number(styling[marginTopKey]);
  const marginBottom = Number(styling[marginBottomKey]);
  if (Number.isFinite(marginTop) && marginTop !== 0) style.marginTop = `${marginTop}%`;
  if (Number.isFinite(marginBottom) && marginBottom !== 0) {
    style.marginBottom = `${marginBottom}%`;
  }
  if (styling[fillKey] === true) {
    const fit = styling[fillStyleKey];
    if (typeof fit === "string" && fit) style.objectFit = fit as React.CSSProperties["objectFit"];
    const h = Number(styling[fillHeightKey]);
    if (Number.isFinite(h) && h > 0) style.height = `${h}px`;
  }
  const suffix = isOn(styling, radiusIsPixelsKey) ? "px" : "%";
  style.borderRadius = `${num(styling, radiusKeys.tl)}${suffix} ${num(styling, radiusKeys.tr)}${suffix} ${num(styling, radiusKeys.br)}${suffix} ${num(styling, radiusKeys.bl)}${suffix}`;
  if (isOn(styling, `${imgPrefix}OverflowIsOn`)) style.overflow = "hidden";
  if (isOn(styling, `${imgPrefix}BorderIsOn`)) {
    // Choice images honor the state filter image-border color (original
    // objectImage border logic); row/addon images use their plain color.
    let borderColor = str(styling, `${imgPrefix}BorderColor`);
    if (kind === "objectImage" && choice) {
      const filterStyling = getStyling("privateFilterIsOn", idx, state, row, choice) as Record<
        string,
        unknown
      >;
      const enabled = isEnabled(choice.requireds, idx, state);
      const active = state.activated.has(choice.id);
      const stateColor = enabled
        ? active && isOn(filterStyling, "selImgBorderColorIsOn")
          ? str(filterStyling, "selFilterImgBorderColor")
          : ""
        : isOn(filterStyling, "reqImgBorderColorIsOn")
          ? str(filterStyling, "reqFilterImgBorderColor")
          : "";
      if (stateColor) borderColor = stateColor;
    }
    style.border = `${num(styling, `${imgPrefix}BorderWidth`)}px ${str(styling, `${imgPrefix}BorderStyle`)} ${borderColor}`;
  }
  return style;
}

/* ------------------------------------------------------------------ */
/* Row surface (original AppRow.rowBody + rowBackground)               */
/* ------------------------------------------------------------------ */

export interface RowSurfaceStyle {
  /** Outer row body margin (top, sides%, bottom). */
  margin: string;
  marginLeft: string;
  marginRight: string;
  /** Header bottom margin (rowHeaderMarginBottom). */
  marginBottom: string;
  backgroundColor: string;
  backgroundImage: string;
  backgroundRepeat: string;
  backgroundSize: string;
  /** Row-body background image/color (original rowBodyBgImage/rowBodyBgColor). */
  bodyBackgroundImage: string;
  bodyBackgroundRepeat: string;
  bodyBackgroundSize: string;
  bodyBackgroundColor: string;
  /** rowGradient when enabled, already wrapped in linear-gradient(). */
  gradient: string;
  borderColor: string;
  borderStyle: string;
  borderWidth: string;
  borderRadius: string;
  borderImage: string;
  boxShadow: string;
  /** drop-shadow filter when the doc uses the filter variant. */
  filter: string;
  overflow: string;
}

/**
 * Row-body background from the row's private styling or an active row design
 * group (original `rowBodyBgImage`/`rowBodyBgColor`): the plain `backgroundImage`
 * / `backgroundColor` keys — never the app defaults, which only feed the
 * header's `rowBackgroundImage`/`rowBgColor`.
 */
function rowBodyBackground(
  row: Row,
  idx: CyoaIndex,
  state: CyoaState,
): {
  backgroundImage: string;
  backgroundRepeat: string;
  backgroundSize: string;
  backgroundColor: string;
} {
  const rowData = row as Row & {
    styling?: Record<string, unknown>;
    isPrivateStyling?: boolean;
    privateBackgroundIsOn?: boolean;
    rowDesignGroups?: string[];
  };
  let styling: Record<string, unknown> | undefined;
  if (
    rowData.styling !== undefined &&
    rowData.isPrivateStyling &&
    rowData.privateBackgroundIsOn &&
    (str(rowData.styling, "backgroundImage") || isOn(rowData.styling, "bgColorIsOn"))
  ) {
    styling = rowData.styling;
  }
  if (!styling) {
    for (const groupId of rowData.rowDesignGroups ?? []) {
      const group = idx.rowDesignMap.get(groupId);
      if (!group) continue;
      if (!group.privateBackgroundIsOn) continue;
      const s = (group as { styling?: Record<string, unknown> }).styling;
      if (!s || !(str(s, "backgroundImage") || isOn(s, "bgColorIsOn"))) continue;
      const id = group.activatedId ?? "";
      const globalReq = idx.globalReqMap.get(id);
      if (
        id === "" ||
        checkActivated(id, state) ||
        (globalReq !== undefined && checkRequirements(globalReq, idx, state))
      ) {
        styling = s;
        break;
      }
    }
  }
  if (!styling) {
    return { backgroundImage: "", backgroundRepeat: "", backgroundSize: "", backgroundColor: "" };
  }
  return {
    backgroundImage: str(styling, "backgroundImage")
      ? (resolveImageRef(idx.app, str(styling, "backgroundImage")) ?? "")
      : "",
    backgroundRepeat: isOn(styling, "isBackgroundRepeat") ? "repeat" : "",
    backgroundSize: isOn(styling, "isBackgroundFitIn") ? "100% 100%" : "cover",
    backgroundColor:
      isOn(styling, "bgColorIsOn") && str(styling, "backgroundColor")
        ? str(styling, "backgroundColor")
        : "",
  };
}

/**
 * Resolve the row card surface (background, border, radius, shadow, margins)
 * from the styling cascade. Port of the original `AppRow.rowBackground` +
 * `rowBody` (the row header box that wraps image/title/text).
 */
export function rowSurfaceStyle(row: Row, idx: CyoaIndex, state: CyoaState): RowSurfaceStyle {
  const rowStyle = getStyling("privateRowIsOn", idx, state, row) as Record<string, unknown>;
  const backgroundStyle = getStyling("privateBackgroundIsOn", idx, state, row) as Record<
    string,
    unknown
  >;

  let backgroundColor = "";
  if (isOn(backgroundStyle, "rowBgColorIsOn") && str(backgroundStyle, "rowBgColor")) {
    backgroundColor = str(backgroundStyle, "rowBgColor");
  }
  let backgroundImage = "";
  let backgroundRepeat = "repeat";
  let backgroundSize = "cover";
  if (str(backgroundStyle, "rowBackgroundImage")) {
    backgroundImage = resolveImageRef(idx.app, str(backgroundStyle, "rowBackgroundImage")) ?? "";
    backgroundRepeat = isOn(backgroundStyle, "isRowBackgroundRepeat") ? "repeat" : "";
    backgroundSize = isOn(backgroundStyle, "isRowBackgroundFitIn") ? "100% 100%" : "cover";
  }

  const gradient = isOn(rowStyle, "rowGradientIsOn")
    ? gradientToCss(str(rowStyle, "rowGradient"))
    : "";

  const suffix = isOn(rowStyle, "rowBorderRadiusIsPixels") ? "px" : "%";
  const borderRadius = `${num(rowStyle, "rowBorderRadiusTopLeft")}${suffix} ${num(rowStyle, "rowBorderRadiusTopRight")}${suffix} ${num(rowStyle, "rowBorderRadiusBottomRight")}${suffix} ${num(rowStyle, "rowBorderRadiusBottomLeft")}${suffix}`;

  let borderColor = "";
  let borderStyle = "";
  let borderWidth = "";
  if (isOn(rowStyle, "rowBorderIsOn")) {
    borderColor = str(rowStyle, "rowBorderColor");
    borderStyle = str(rowStyle, "rowBorderStyle");
    borderWidth = `${num(rowStyle, "rowBorderWidth")}px`;
  }

  let boxShadow = "";
  let filter = "";
  if (isOn(rowStyle, "rowDropShadowIsOn")) {
    const shadow = `${num(rowStyle, "rowDropShadowH")}px ${num(rowStyle, "rowDropShadowV")}px ${num(rowStyle, "rowDropShadowBlur")}px ${num(rowStyle, "rowDropShadowSpread")}px ${str(rowStyle, "rowDropShadowColor")}`;
    if (isOn(rowStyle, "rowUseBoxShadowIsOn")) {
      boxShadow = shadow;
    } else {
      filter = `drop-shadow(${shadow})`;
    }
  }

  const body = rowBodyBackground(row, idx, state);
  return {
    margin: `${num(rowStyle, "rowBodyMarginTop")}px ${num(rowStyle, "rowBodyMarginSides")}% ${num(rowStyle, "rowBodyMarginBottom")}px`,
    marginLeft: `${num(rowStyle, "rowMargin")}%`,
    marginRight: `${num(rowStyle, "rowMargin")}%`,
    marginBottom: `${num(rowStyle, "rowHeaderMarginBottom")}px`,
    backgroundColor,
    backgroundImage,
    backgroundRepeat,
    backgroundSize,
    bodyBackgroundImage: body.backgroundImage,
    bodyBackgroundRepeat: body.backgroundRepeat,
    bodyBackgroundSize: body.backgroundSize,
    bodyBackgroundColor: body.backgroundColor,
    gradient,
    borderColor,
    borderStyle,
    borderWidth,
    borderRadius,
    borderImage:
      str(rowStyle, "rowBorderImage") && isOn(rowStyle, "rowBorderIsOn")
        ? `url('${resolveImageRef(idx.app, str(rowStyle, "rowBorderImage"))}') ${num(rowStyle, "rowBorderImageSliceTop")} ${num(rowStyle, "rowBorderImageSliceRight")} ${num(rowStyle, "rowBorderImageSliceBottom")} ${num(rowStyle, "rowBorderImageSliceLeft")} / ${num(rowStyle, "rowBorderImageWidth")}px ${str(rowStyle, "rowBorderImageRepeat") || "stretch"}`
        : "",
    boxShadow,
    filter,
    overflow: isOn(rowStyle, "rowOverflowIsOn") ? "hidden" : "",
  };
}

/**
 * Inline style for a row button (original `AppRow.rowButton`): the padding is
 * the only row-styling the button itself carries — the surrounding row header
 * provides the background/border. Note the original mapping: top/bottom =
 * `rowButtonXPadding`, left/right = `rowButtonYPadding`.
 */
export function rowButtonStyle(row: Row, idx: CyoaIndex, state: CyoaState): React.CSSProperties {
  const rowStyle = getStyling("privateRowIsOn", idx, state, row) as Record<string, unknown>;
  const textStyling = getStyling("privateTextIsOn", idx, state, row) as Record<string, unknown>;
  const padX = num(rowStyle, "rowButtonXPadding");
  const padY = num(rowStyle, "rowButtonYPadding");
  const style: React.CSSProperties = {
    padding: `${padX}px ${padY}px`,
  };
  const color = str(textStyling, "rowTitleColor");
  const family = str(textStyling, "rowTitle");
  const size = num(textStyling, "rowTitleTextSize");
  if (color) style.color = color;
  if (family) style.fontFamily = family;
  if (size > 0) style.fontSize = `${size}%`;
  return style;
}

/**
 * The template to render for an entity, honoring the viewer's
 * `minimizeTemplate` behavior: below `smallerScreenPx` every row/choice
 * collapses to the stacked template 1 layout (original `minimizeTemplate`).
 */
export function viewerTemplate(
  entity: { template?: number; id: string; groups?: string[] },
  isRow: boolean,
  app: App,
  viewport: number,
  idx: CyoaIndex,
  state: CyoaState,
): number {
  const tpl = effectiveTemplate(entity, isRow, idx, state);
  if (app.minimizeTemplate && viewport <= Number(app.smallerScreenPx ?? 720)) {
    return 1;
  }
  return tpl;
}

/** Column width class for a row, honoring `enableHalfRow` / viewport. */
export function rowWidthClass(row: Row, app: App, viewport: number): string {
  if (row.width && (viewport > 1280 || app.enableHalfRow)) return "col-6";
  return "col-12";
}

/** ICCPlus width token -> number of objects per row (original `objectWidthToNum`). */
export function objectWidthToNum(width: string): number {
  switch (width) {
    case "col-sm-6":
    case "col-sm-5":
      return 2;
    case "col-md-4":
      return 3;
    case "col-md-3":
      return 4;
    case "w-20":
      return 5;
    case "col-lg-2":
      return 6;
    case "w-14":
      return 7;
    case "w-12":
      return 8;
    case "w-11":
      return 9;
    case "w-10":
      return 10;
    case "w-9":
      return 11;
    case "col-xl-1":
      return 12;
    default:
      return 1;
  }
}

/** ICCPlus responsive token -> plain `col-N` (original `fixedWidth`). */
export function fixedWidth(width: string): string {
  switch (width) {
    case "col-xl-1":
      return "col-1";
    case "col-lg-2":
      return "col-2";
    case "col-md-3":
      return "col-3";
    case "col-md-4":
      return "col-4";
    case "col-sm-5":
      return "col-5";
    case "col-sm-6":
      return "col-6";
    case "col-sm-7":
      return "col-7";
    case "col-sm-8":
      return "col-8";
    case "col-sm-9":
      return "col-9";
    case "col-sm-10":
      return "col-10";
    case "col-sm-11":
      return "col-11";
    default:
      return width;
  }
}

/**
 * Column width class for a choice, mirroring the original viewer's
 * `objectWidthClass`: the choice's width falls back to the row's, and the
 * app-level `objectsPerRow`/viewport rules pick the responsive grid column.
 */
export function choiceWidthClass(row: Row, choice: Choice, app: App, viewport: number): string {
  const objectWidth = row.overrideWidth ? row.objectWidth : choice.objectWidth || row.objectWidth;
  const objectWidthNum = objectWidthToNum(objectWidth);
  const objectsPerRowNum =
    app.objectsPerRow === "col-6" ? 2 : app.objectsPerRow === "col-4" ? 3 : 4;
  if (viewport > 1280) return objectWidth || "col-12";
  if (viewport > Number(app.smallerScreenPx ?? 720)) {
    if (app.objectsPerRow === "default") return fixedWidth(objectWidth);
    switch (objectWidthNum) {
      case 1:
        return "col-12";
      case 2:
        return "col-6";
      case 3:
        return objectsPerRowNum > 2 ? "col-4" : app.objectsPerRow;
      case 4:
        return objectsPerRowNum > 3 ? "col-3" : app.objectsPerRow;
      default:
        return app.objectsPerRow;
    }
  }
  if (viewport > 480) return objectWidthNum === 1 ? "col-12" : "col-6";
  return "col-12";
}

/**
 * Format a point value the way the original viewer renders sums: integers as
 * plain text, floats rounded to the point type's decimal places with trailing
 * zeros stripped (the original's `value % 1 === 0 ? value :
 * parseFloat(value.toFixed(places))`).
 */
export function formatPointValue(point: PointType, value: number): string {
  if (Number.isInteger(value)) return String(value);
  const places = numValue(point.decimalPlaces, 2);
  return String(parseFloat(value.toFixed(places)));
}

/** Row template layout: 1 image-top, 2 image-right, 3 image-left, 4 image-bottom, 5 image-inline. */
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
      // Original ICCPlus template 5: the image flows inline between the
      // requirements and the body text (not a background).
      return { container: "space-y-3", image: "", body: "" };
    case 4:
      return { container: "flex flex-col-reverse gap-3", image: "", body: "" };
    case 1:
    default:
      return { container: "space-y-3", image: "", body: "" };
  }
}

/** True when the choice should be hidden by its state's filter visibility. */
export function isChoiceShown(choice: Choice, row: Row, idx: CyoaIndex, state: CyoaState): boolean {
  const styling = getStyling("privateFilterIsOn", idx, state, row, choice) as Record<
    string,
    unknown
  >;
  const visualState = choiceVisualState(choice, idx, state);
  const prefix = FILTER_PREFIX[visualState];
  return styling[`${prefix}FilterVisibleIsOn`] !== true;
}
