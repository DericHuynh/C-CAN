import type { App } from "./types";
import { projectEntities, type EntityKind } from "./project-workflow";

export type ReferenceKind = EntityKind | "activation-target" | "activation" | "variable" | "image";
export type Reference = { source: string; path: string; kind: ReferenceKind; value: string };
/** Visit reference-bearing mechanics, never arbitrary prose/image URLs. */
export function visitReferences(
  entity: Record<string, any>,
  source: string,
  update: (r: Reference) => string,
): void {
  const one = (obj: any, key: string, kind: ReferenceKind, path: string) => {
    if (typeof obj[key] === "string" && obj[key])
      obj[key] = update({ source, path: `${path}.${key}`, kind, value: obj[key] });
  };
  const list = (obj: any, key: string, kind: ReferenceKind, path: string) => {
    if (Array.isArray(obj[key]))
      obj[key] = obj[key].map((value: unknown, i: number) =>
        typeof value === "string"
          ? update({ source, path: `${path}.${key}[${i}]`, kind, value })
          : value,
      );
  };
  const requirements = (values: any[], path: string, depth = 0) => {
    if (depth > 30) throw new Error("Requirements exceed the supported nesting depth.");
    for (const [i, req] of (values ?? []).entries()) {
      const p = `${path}[${i}]`;
      if (["points", "pointCompare"].includes(req.type)) {
        one(req, "reqId", "point", p);
        if (req.type === "pointCompare") one(req, "reqId1", "point", p);
        for (const [j, more] of (req.more ?? []).entries())
          one(more, "id", "point", `${p}.more[${j}]`);
      } else if (req.type === "id") one(req, "reqId", "activation", p);
      else if (req.type === "gid") one(req, "reqId", "requirement", p);
      list(req, "selGroups", "group", p);
      list(req, "selRows", "row", p);
      requirements(req.requireds, p + ".requireds", depth + 1);
      requirements(req.orRequireds, p + ".orRequireds", depth + 1);
    }
  };
  requirements(entity.requireds, "requireds");
  for (const [i, score] of (entity.scores ?? []).entries()) {
    one(score, "id", "point", `scores[${i}]`);
    requirements(score.requireds, `scores[${i}].requireds`);
  }
  list(entity, "groups", "group", "");
  list(entity, "elements", "activation", "");
  list(entity, "rowElements", "row", "");
  for (const [i, variant] of (entity.imageVariants ?? []).entries())
    requirements(variant.requireds, `imageVariants[${i}].requireds`);
  for (const key of ["activateThisChoice", "deactivateThisChoice"]) {
    if (typeof entity[key] === "string" && entity[key])
      entity[key] = entity[key]
        .split(",")
        .map((value: string, index: number) =>
          value.trim()
            ? update({
                source,
                path: `${key}[${index}]`,
                kind: "activation-target",
                value: value.trim(),
              })
            : value,
        )
        .join(",");
  }
  if (entity.multiplyPointtypeIsId) one(entity, "multiplyWithThis", "point", "");
  one(entity, "pointTypeRandom", "point", "");
  one(entity, "multipleScoreId", "point", "");
  for (const key of ["pointTypeToSet", "pointTypeToMultiply", "pointTypeToDivide"])
    list(entity, key, "point", "");
  list(entity, "changedVariables", "variable", "");
  for (const key of ["scrollRowId", "duplicateRowId", "idOfAllowChoice"])
    one(entity, key, "row", "");
  one(entity, "scrollObjectId", "activation", "");
}
export type ValidationIssue = {
  severity: "error" | "warning";
  code: string;
  source: string;
  path?: string;
  reference?: string;
  message: string;
};
export function validateProject(app: App) {
  const entries = projectEntities(app);
  const byId = new Map<string, typeof entries>();
  const issues: ValidationIssue[] = [];
  const references: Reference[] = [];
  for (const entry of entries) {
    const same = byId.get(entry.id) ?? [];
    same.push(entry);
    byId.set(entry.id, same);
    if (!entry.id)
      issues.push({
        severity: "error",
        code: "missing-id",
        source: entry.title,
        message: "Entity has no stable ID.",
      });
  }
  for (const [id, same] of byId)
    if (same.length > 1)
      issues.push({
        severity: "error",
        code: "duplicate-id",
        source: id,
        message: `ID is used by ${same.length} entities.`,
      });
  const vars = new Set((app.variables ?? []).map((v) => v.id));
  for (const entry of entries) {
    visitReferences(structuredClone(entry.entity), entry.id, (reference) => {
      references.push(reference);
      const id = reference.value.split("/ON#")[0];
      const found =
        (byId.get(id) ?? []).some((e) =>
          reference.kind === "activation"
            ? ["choice", "addon", "row"].includes(e.kind)
            : reference.kind === "activation-target"
              ? ["choice", "addon", "group"].includes(e.kind)
              : e.kind === reference.kind,
        ) ||
        (["activation", "variable"].includes(reference.kind) && vars.has(id));
      if (!found)
        issues.push({
          severity: "error",
          code: "broken-reference",
          source: entry.id,
          path: reference.path,
          reference: reference.value,
          message: `Unknown ${reference.kind} reference "${reference.value}".`,
        });
      return reference.value;
    });
    const ids = new Map<string, Set<boolean>>();
    const ranges = new Map<
      string,
      { lower: number; upper: number; lowerOpen: boolean; upperOpen: boolean }
    >();
    for (const req of entry.entity.requireds ?? []) {
      if (req.type === "id" && !req.requireds?.length) {
        const flags = ids.get(req.reqId) ?? new Set();
        flags.add(req.required !== false);
        ids.set(req.reqId, flags);
      }
      if (
        req.type === "points" &&
        req.required === true &&
        !req.requireds?.length &&
        Number.isFinite(Number(req.reqPoints))
      ) {
        const range = ranges.get(req.reqId) ?? {
          lower: -Infinity,
          upper: Infinity,
          lowerOpen: false,
          upperOpen: false,
        };
        const v = Number(req.reqPoints),
          op = req.operator ?? "1";
        if (["1", "2", "3"].includes(op) && v >= range.lower) {
          const open = op === "1";
          range.lowerOpen = v === range.lower ? range.lowerOpen || open : open;
          range.lower = v;
        }
        if (["3", "4", "5"].includes(op) && v <= range.upper) {
          const open = op === "5";
          range.upperOpen = v === range.upper ? range.upperOpen || open : open;
          range.upper = v;
        }
        ranges.set(req.reqId, range);
      }
    }
    for (const [id, flags] of ids)
      if (flags.size > 1)
        issues.push({
          severity: "error",
          code: "contradictory-requirements",
          source: entry.id,
          reference: id,
          message: "Requires the same target both selected and unselected.",
        });
    for (const [id, r] of ranges)
      if (r.lower > r.upper || (r.lower === r.upper && (r.lowerOpen || r.upperOpen)))
        issues.push({
          severity: "error",
          code: "impossible-point-range",
          source: entry.id,
          reference: id,
          message: "Point comparisons have no common satisfying value.",
        });
    if (entry.kind === "addon" && entry.entity.parentId !== entry.parentId)
      issues.push({
        severity: "error",
        code: "addon-parent",
        source: entry.id,
        message: "Addon parent does not match its containing choice.",
      });
  }
  // Positive dependency cycles are warnings: external activation functions can
  // unlock them. Do not label them impossible without a complete state search.
  const edges = new Map(
    entries.map((e) => [
      e.id,
      (e.entity.requireds ?? [])
        .filter((r: any) => r.type === "id" && r.required !== false)
        .map((r: any) => r.reqId.split("/ON#")[0]) as string[],
    ]),
  );
  const visiting = new Set<string>(),
    done = new Set<string>();
  function visit(id: string, depth = 0) {
    if (visiting.has(id)) {
      issues.push({
        severity: "warning",
        code: "dependency-cycle",
        source: id,
        message: "Positive requirement cycle; check for an initial selection or activation path.",
      });
      return;
    }
    if (done.has(id) || depth > 100) return;
    visiting.add(id);
    for (const next of edges.get(id) ?? []) visit(next, depth + 1);
    visiting.delete(id);
    done.add(id);
  }
  for (const entry of entries) visit(entry.id);
  if (!app.viewerConfig?.title?.trim())
    issues.push({
      severity: "warning",
      code: "viewer-title",
      source: "project",
      message: "Set viewerConfig.title for a named player view.",
    });
  const currencies = (app.pointTypes ?? []).map((point) => {
    let min = Number(point.startingSum ?? 0),
      max = min,
      exactLinear = true;
    for (const e of entries) {
      if (
        [
          "multiplyPointtypeIsOn",
          "dividePointtypeIsOn",
          "setPointtypeIsOn",
          "discountOther",
          "isChangePoints",
          "useFunctions",
          "isRandom",
        ].some((k) => e.entity[k])
      )
        exactLinear = false;
      for (const s of e.entity.scores ?? [])
        if (s.id === point.id) {
          const value = Number(s.value);
          if (
            !Number.isFinite(value) ||
            s.isRandom ||
            s.useExpression ||
            s.multiplyByTimes ||
            s.requireds?.length ||
            s.discounts?.length ||
            s.discountIsOn ||
            s.setValue
          ) {
            exactLinear = false;
            continue;
          }
          const copies = e.entity.isSelectableMultiple
            ? Number(e.entity.numMultipleTimesPluss ?? 0)
            : 1;
          if (copies <= 0) {
            exactLinear = false;
            continue;
          }
          const negativeCopies = e.entity.isSelectableMultiple
            ? Number(e.entity.numMultipleTimesMinus ?? 0)
            : 0;
          min += Math.min(0, -value * copies, -value * negativeCopies);
          max += Math.max(0, -value * copies, -value * negativeCopies);
        }
    }
    return {
      id: point.id,
      name: point.name,
      min: exactLinear ? min : null,
      max: exactLinear ? max : null,
      kind: exactLinear ? "optimistic-independent-selection-bounds" : "requires-state-analysis",
    };
  });
  return {
    valid: !issues.some((i) => i.severity === "error"),
    errors: issues.filter((i) => i.severity === "error").length,
    warnings: issues.filter((i) => i.severity === "warning").length,
    issues,
    references,
    currencies,
    limitations: [
      "Static analysis, not an exhaustive proof of reachability. Cycles may have external activation paths.",
      "Currency bounds ignore mutual exclusion and ordering; nonlinear/random/function-driven totals need gameplay-state analysis.",
      "Unknown ICCPlus extension fields are preserved but not analyzed.",
    ],
  };
}
export const issueKey = (issue: ValidationIssue) =>
  `${issue.code}:${issue.source}:${issue.path ?? ""}:${issue.reference ?? ""}`;
