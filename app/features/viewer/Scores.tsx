import { Badge } from "@/components/ui/badge";
import { type UseCyoaResult } from "@/features/viewer/use-cyoa";
import {
  checkActivated,
  checkRequirements,
  computeScoreNet,
  isEnabled,
  scoreDiscountDisplay,
  type CyoaIndex,
  type CyoaState,
} from "@shared/cyoa-engine";
import type { App, Choice, PointType, Row, Score, SelectableAddon } from "@shared/types";
import { getStyling } from "@shared/cyoa-styling";
import { resolveImageRef } from "@shared/cyoa";
import { formatPointValue, numValue, sanitizeHtml, textStyle } from "./cyoa-styles";
import { ViewerImage } from "./ViewerImage";

function formatScoreValue(point: PointType | undefined, value: number): string {
  const abs = Math.abs(value);
  const display = point?.allowFloat ? abs : Math.floor(abs);
  if (point?.plussOrMinusAdded) {
    const negative = value < 0;
    const prefix = point.plussOrMinusInverted ? (negative ? "-" : "+") : negative ? "+" : "-";
    return `${prefix}${formatPointValue(point, display)}`;
  }
  return formatPointValue(point ?? ({} as PointType), display);
}

/**
 * Badge display value (original ObjectScore `scoreValueText`): the base net
 * with discounts, scaled by the count ONLY when `multiplyByTimes` +
 * `displayMulScore` — a plain multi-select badge shows the per-copy value,
 * not the cumulative total.
 */
function scoreDisplayValue(
  choice: Choice | SelectableAddon,
  scoreIndex: number,
  score: Score,
  idx: CyoaIndex,
  state: CyoaState,
  multiple: number,
): number {
  const base = computeScoreNet(choice, scoreIndex, score, idx, state, 0);
  const count = Math.abs(multiple);
  if (score.multiplyByTimes && score.displayMulScore && count > 0) {
    return base * (count + 1);
  }
  return base;
}

/**
 * Score visibility gate (original ObjectScore `isPointtypeActivated`): the
 * score renders only when `showScore` is on AND the point type is not hidden
 * from objects — or, when hidden, only while its `activatedId` target is met
 * (a global requirement, a true variable, or an activated choice).
 */
function isScoreShown(
  score: Score,
  choice: Choice | SelectableAddon,
  idx: CyoaIndex,
  state: CyoaState,
): boolean {
  if (!score.showScore) return false;
  const point = idx.pointTypeMap.get(score.id ?? score.type);
  if (!point) return true;
  if (!point.isNotShownObjects) return true;
  if (point.activatedId !== undefined && point.activatedId !== "") {
    const globalReq = idx.globalReqMap.get(point.activatedId);
    const variable = idx.variableMap.get(point.activatedId);
    if (globalReq) return checkRequirements(globalReq, idx, state);
    if (variable) return state.variables.get(variable.id) === true;
    return checkActivated(point.activatedId, state);
  }
  return false;
}

/**
 * Point-type icon renderer (original ObjectScore): the icon image with the
 * point type's width/height, placed around the text per `imageOnSide` /
 * `imageSidePlacement` (and the negative variant when the score is a gain and
 * `negativeIconIsOn`).
 */
function ScoreIcon({
  app,
  point,
  isNegative,
}: {
  app: App;
  point: PointType;
  isNegative: boolean;
}) {
  const useNeg = point.negativeIconIsOn === true && isNegative;
  const image = resolveImageRef(app, useNeg ? point.negativeImage : point.image);
  if (!image) return null;
  const width = numValue(useNeg ? point.negativeIconWidth : point.iconWidth, 0);
  const height = numValue(useNeg ? point.negativeIconHeight : point.iconHeight, 0);
  const inChoice = point.useSeperatePosition === true;
  const onSide = useNeg
    ? inChoice
      ? point.negativeImageOnSideInChoice === true
      : point.negativeImageOnSide === true
    : inChoice
      ? point.imageOnSideInChoice === true
      : point.imageOnSide === true;
  const sidePlacement = useNeg
    ? inChoice
      ? point.negativeImageSidePlacementInChoice === true
      : point.negativeImageSidePlacement === true
    : inChoice
      ? point.imageSidePlacementInChoice === true
      : point.imageSidePlacement === true;
  const afterText = sidePlacement && !onSide;
  const afterBeforeText = !sidePlacement && onSide;
  const beforeText = !sidePlacement && !onSide;
  const afterAfterText = sidePlacement && onSide;
  return { image, width, height, beforeText, afterBeforeText, afterText, afterAfterText };
}

export function Scores({ cyoa, choice, row }: { cyoa: UseCyoaResult; choice: Choice; row: Row }) {
  const scores = choice.scores ?? [];
  const activeScores = scores.filter((score) => {
    if (!isScoreShown(score, choice, cyoa.idx, cyoa.state)) return false;
    return isEnabled(score.requireds, cyoa.idx, cyoa.state);
  });
  if (activeScores.length === 0) return null;
  const scoreStyle = textStyle("scoreText", cyoa.idx, cyoa.state, row, choice);
  const filterStyling = getStyling(
    "privateFilterIsOn",
    cyoa.idx,
    cyoa.state,
    row,
    choice,
  ) as Record<string, unknown>;
  const fStr = (key: string): string =>
    typeof filterStyling[key] === "string" ? (filterStyling[key] as string) : "";
  const fOn = (key: string): boolean => filterStyling[key] === true;
  const enabled = isEnabled(choice.requireds, cyoa.idx, cyoa.state);
  const isActive = cyoa.state.activated.has(choice.id);
  return (
    <div className="flex flex-wrap justify-center gap-1.5 pt-1">
      {activeScores.map((score, scoreIndex) => {
        const entry = cyoa.state.activated.get(choice.id);
        const multiple = entry?.multiple ?? 0;
        const point = cyoa.idx.pointTypeMap.get(score.id ?? score.type);
        const value = scoreDisplayValue(choice, scoreIndex, score, cyoa.idx, cyoa.state, multiple);
        const display = scoreDiscountDisplay(choice, score, cyoa.idx, cyoa.state);
        // Discount display mirrors the original ObjectScore: when a discount
        // is active with `discountShow`, its custom text replaces the normal
        // before/after labels (unless `replaceScoreText` is off).
        const before = display.show
          ? [display.replace ? "" : (score.beforeText ?? point?.beforeText ?? ""), display.before]
              .filter(Boolean)
              .join(" ")
          : (score.beforeText ?? point?.beforeText ?? "");
        const after = display.show
          ? [display.replace ? "" : (score.afterText ?? point?.afterText ?? ""), display.after]
              .filter(Boolean)
              .join(" ")
          : (score.afterText ?? point?.afterText ?? "");
        const hideValue = score.hideValue || display.hideValue;
        // Color cascade (original ObjectScore `scoreText`): the scoreText
        // color, overridden by the point type's positive/negative colors when
        // `pointColorsIsOn` (note the original's inverted mapping: a negative
        // change uses `positiveColor`), then by the req/sel state filter
        // colors when those are enabled.
        const checkNegative = value < 0;
        let color = scoreStyle.color;
        if (point?.pointColorsIsOn) {
          color = checkNegative ? point.positiveColor : point.negativeColor;
        }
        if (!enabled && fOn("reqScoreTextColorIsOn") && fStr("reqFilterSTextColor")) {
          color = fStr("reqFilterSTextColor");
        } else if (isActive && fOn("selScoreTextColorIsOn") && fStr("selFilterSTextColor")) {
          color = fStr("selFilterSTextColor");
        }
        const icon = point?.iconIsOn
          ? ScoreIcon({ app: cyoa.idx.app, point, isNegative: !checkNegative })
          : null;
        return (
          <Badge
            key={`${score.id ?? score.type}-${scoreIndex}`}
            variant="secondary"
            style={{ ...scoreStyle, color }}
          >
            {icon && icon.beforeText ? (
              <ViewerImage
                src={icon.image}
                alt=""
                className="mx-0.5 self-center"
                style={{ width: icon.width, height: icon.height }}
              />
            ) : null}
            {before ? <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(before) }} /> : null}
            {icon && icon.afterBeforeText ? (
              <ViewerImage
                src={icon.image}
                alt=""
                className="mx-0.5 self-center"
                style={{ width: icon.width, height: icon.height }}
              />
            ) : null}
            {hideValue ? null : (
              <span
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(formatScoreValue(point, value)),
                }}
              />
            )}
            {icon && icon.afterText ? (
              <ViewerImage
                src={icon.image}
                alt=""
                className="mx-0.5 self-center"
                style={{ width: icon.width, height: icon.height }}
              />
            ) : null}
            {after ? <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(after) }} /> : null}
            {icon && icon.afterAfterText ? (
              <ViewerImage
                src={icon.image}
                alt=""
                className="mx-0.5 self-center"
                style={{ width: icon.width, height: icon.height }}
              />
            ) : null}
          </Badge>
        );
      })}
    </div>
  );
}

/**
 * Requirement visibility gate (original ObjectRequired `isShowReq`):
 * `showRequired` must be on; `hideRequired2` hides while the requirement's
 * own sub-requireds are unmet; `hideRequired` shows only while the
 * requirement itself is NOT yet met (a hint that it is missing).
 */
