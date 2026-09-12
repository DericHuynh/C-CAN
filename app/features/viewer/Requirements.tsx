import { Badge } from "@/components/ui/badge";
import { type UseCyoaResult } from "@/features/viewer/use-cyoa";
import {
  checkReq,
  checkRequirements,
  replaceText,
  type CyoaIndex,
  type CyoaState,
} from "@shared/cyoa-engine";
import type { Choice, Requireds, Row } from "@shared/types";
import { sanitizeHtml, textStyle } from "./cyoa-styles";

function isReqShown(req: Requireds, idx: CyoaIndex, state: CyoaState): boolean {
  if (!req.showRequired) return false;
  let result = true;
  if (req.hideRequired2) {
    result = checkRequirements(req.requireds, idx, state);
  }
  if (req.hideRequired) {
    if ((req.requireds ?? []).length > 0) {
      result = checkRequirements(req.requireds, idx, state) && !checkReq(req, idx, state);
    } else {
      result = !checkReq(req, idx, state);
    }
  }
  return result;
}

export function Requirements({
  cyoa,
  choice,
  row,
  textColor,
}: {
  cyoa: UseCyoaResult;
  choice: Choice;
  row: Row;
  textColor?: string;
}) {
  const reqs = choice.requireds ?? [];
  if (reqs.length === 0) return null;
  // `gid` requirements expand into their global requirement's entries, each
  // gated by its own `showRequired` (the original renders them separately).
  const expanded: Requireds[] = [];
  for (const r of reqs) {
    if (r.type === "gid") {
      const subs = cyoa.idx.globalReqMap.get(r.reqId);
      if (subs && subs.length > 0) {
        for (const sub of subs) {
          if (sub.showRequired !== false) expanded.push(sub);
        }
        continue;
      }
    }
    expanded.push(r);
  }
  const items = expanded
    .filter((r) => isReqShown(r, cyoa.idx, cyoa.state))
    .map((r) => ({
      req: r,
      text: requirementLabel(r, cyoa),
      // Exclusive requirements (`required: false`) gate on the target being
      // NOT active — give them a distinct look so they aren't mistaken for
      // normal requirements.
      negated: r.required === false,
    }))
    .filter((item) => item.text);
  // Requirements chained with a leading "and " beforeText belong to the
  // previous badge (e.g. "Requires: X" + "and Y" condenses to ONE bubble
  // "Requires: X and Y").
  const merged: { text: string; negated: boolean }[] = [];
  for (const item of items) {
    const joinsPrevious = /^\s*and\b/i.test(item.req.beforeText ?? "");
    if (joinsPrevious && merged.length > 0) {
      const prev = merged[merged.length - 1];
      prev.text = `${prev.text} ${item.text}`;
    } else {
      merged.push({ text: item.text, negated: item.negated });
    }
  }
  const labels = merged
    .map((label) => ({ text: sanitizeHtml(label.text), negated: label.negated }))
    .filter((label) => label.text);
  if (labels.length === 0) return null;
  const style = textStyle("scoreText", cyoa.idx, cyoa.state, row, choice);
  return (
    <div className="flex flex-wrap justify-center gap-1.5 pt-1 text-xs text-muted-foreground">
      {labels.map((label, i) => (
        <Badge
          key={i}
          variant="outline"
          className={label.negated ? "border-destructive/40 text-destructive" : undefined}
          style={{ ...style, color: textColor || undefined }}
        >
          <span dangerouslySetInnerHTML={{ __html: label.text }} />
        </Badge>
      ))}
    </div>
  );
}

/**
 * Core requirement text (before/after/custom excluded): the target choice,
 * the point comparison, or — for `or`/`selFrom*` — the listed targets, so a
 * requirement reads "1 of A, B, C" instead of the count-only "1 of 7".
 */
function requirementCoreText(req: import("@shared/types").Requireds, cyoa: UseCyoaResult): string {
  const { idx } = cyoa;
  switch (req.type) {
    case "id": {
      // Old docs may encode an activation target as `choiceId/ON#suffix`.
      const [targetId, suffix] = req.reqId.split("/ON#");
      const cMap = idx.choiceMap.get(targetId);
      return cMap
        ? `${suffix ? `${suffix} ` : ""}${cMap.choice.title}`
        : `${stripEntityPrefix(targetId)}${suffix ? ` ${suffix}` : ""}`;
    }
    case "points": {
      const point = idx.pointTypeMap.get(req.reqId);
      // Keep these symbols aligned with comparePoint in the gameplay engine.
      const symbols: Record<string, string> = {
        "1": ">",
        "2": "≥",
        "3": "=",
        "4": "≤",
        "5": "<",
        "6": "≠",
      };
      return `${point?.name || stripEntityPrefix(req.reqId)} ${symbols[req.operator ?? "1"] ?? "?"} ${req.reqPoints}`;
    }
    case "gid": {
      const reqs = idx.globalReqMap.get(req.reqId);
      return reqs ? requirementCoreText(reqs[0], cyoa) : stripEntityPrefix(req.reqId);
    }
    case "or": {
      const subs = (req.orRequireds ?? [])
        .map((sub) => requirementCoreText(sub, cyoa))
        .filter(Boolean);
      const orNum = req.orNum ?? 1;
      const word = cyoa.app.defaultOrReq ?? "of";
      if ((cyoa.app.orderOrReqText ?? "0") === "1") {
        return `${subs.join(", ")} ${word} ${orNum}`;
      }
      return `${orNum} ${word} ${subs.join(", ")}`;
    }
    case "selFromGroups": {
      const names = (req.selGroups ?? []).map(
        (gid) => idx.groupMap.get(gid)?.name || stripEntityPrefix(gid),
      );
      const num = req.selNum ?? 1;
      const word = cyoa.app.defaultOrReq ?? "of";
      if ((cyoa.app.orderSelReqText ?? "0") === "1") {
        return `${names.join(", ")} ${word} ${num}`;
      }
      return `${num} ${word} ${names.join(", ")}`;
    }
    case "selFromRows": {
      const names = (req.selRows ?? []).map(
        (rid) => idx.rowById.get(rid)?.title || stripEntityPrefix(rid),
      );
      const num = req.selNum ?? 1;
      const word = cyoa.app.defaultOrReq ?? "of";
      if ((cyoa.app.orderSelReqText ?? "0") === "1") {
        return `${names.join(", ")} ${word} ${num}`;
      }
      return `${num} ${word} ${names.join(", ")}`;
    }
    case "selFromWhole": {
      const num = req.selNum ?? 1;
      const word = cyoa.app.defaultOrReq ?? "of";
      return (cyoa.app.orderSelReqText ?? "0") === "1" ? `${word} ${num}` : `${num} ${word}`;
    }
    default:
      return stripEntityPrefix(req.reqId || req.type);
  }
}

/** Human-readable label for a requirement entry (getReqText equivalent). */
function requirementLabel(req: import("@shared/types").Requireds, cyoa: UseCyoaResult): string {
  const { idx } = cyoa;
  let before = req.beforeText ?? "";
  // The legacy editor's default after-requirement text is the placeholder
  // "choice" (e.g. "Required: Some Choice choice") — drop it from display.
  let after = (req.afterText ?? "") === "choice" ? "" : (req.afterText ?? "");
  if (req.type === "points") {
    // Drop legacy comparison prose now expressed by the actual operator,
    // retaining author prefixes such as "Requires:" and conjunctions.
    before = before.replace(
      /\b(?:(?:more|greater|less)(?: than)?(?: or equal(?: to)?)?|(?:not )?equal(?: to)?|at (?:least|most))\s*:?\s*$/i,
      "",
    );
    after = after.replace(/^\s*or (?:more|less)\b\s*/i, "");
  }
  const text = requirementCoreText(req, cyoa);
  const custom = req.customTextIsOn ? req.customText : "";
  if (custom !== undefined && custom !== "") {
    return replaceText(custom, idx, cyoa.state);
  }
  // Exclusive requirements (`required: false`) gate on the target being NOT
  // active — read as "Not: X" instead of the author's positive before/after
  // text (e.g. "Required:") so they aren't mistaken for normal requirements.
  if (req.required === false) {
    return replaceText(`Not: ${text}`.trim(), idx, cyoa.state);
  }
  return replaceText(`${before} ${text} ${after}`.trim(), idx, cyoa.state);
}

/** Strip known entity-type prefixes (choice-/row-/addon-/point-…) from ids. */
function stripEntityPrefix(id: string): string {
  return id.replace(/^(choice|row|addon|point|group|variable|word|image|sfx)-/, "");
}

/* ------------------------------------------------------------------ */
/* Addons                                                             */
/* ------------------------------------------------------------------ */
