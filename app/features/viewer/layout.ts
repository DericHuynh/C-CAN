import { type UseCyoaResult } from "@/features/viewer/use-cyoa";
import { effectiveWidth } from "@shared/cyoa-engine";
import type { Choice, Row } from "@shared/types";
import { choiceWidthClass } from "./cyoa-styles";

/** Choice column width honoring runtime `changeWidth` overrides. */
export function effectiveChoiceWidth(
  row: Row,
  choice: Choice,
  cyoa: UseCyoaResult,
  viewport: number,
): string {
  const rowW = effectiveWidth(row, true, cyoa.idx, cyoa.state);
  const choiceW = effectiveWidth(choice, false, cyoa.idx, cyoa.state);
  const effRow = rowW === row.objectWidth ? row : { ...row, objectWidth: rowW };
  const effChoice = choiceW === choice.objectWidth ? choice : { ...choice, objectWidth: choiceW };
  return choiceWidthClass(effRow, effChoice, cyoa.app, viewport);
}

export function rowJustifyClass(row: Row): string {
  switch (row.rowJustify) {
    case "center":
      return "justify-center";
    case "end":
      return "justify-end";
    case "space-around":
      return "justify-around";
    case "space-between":
      return "justify-between";
    default:
      return "justify-start";
  }
}
