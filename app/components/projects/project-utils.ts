import type { App, Choice, PointType, Row, Score } from "@shared/types";

/** Format a timestamp (ISO string, epoch ms, or Date) for display. */
export function formatDate(
  value: string | number | Date | null | undefined,
): string {
  if (value == null) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Look up a point type's name by id, falling back to the raw id. */
export function pointTypeName(
  pointTypes: PointType[],
  id: string | undefined,
): string {
  if (!id) return "?";
  const pointType = pointTypes.find((pt) => pt.id === id);
  return pointType?.name || id;
}

/**
 * Render a score as a compact chip label, e.g. "Cost: -5 gold" or "+3 points".
 * `beforeText`/`afterText` come from the owning point type when available.
 */
export function formatScoreChip(
  score: Score,
  pointTypes: PointType[],
): string {
  const value = Number(score.value ?? 0);
  const label = `${value > 0 ? "+" : ""}${value}`;
  const pointType = pointTypes.find(
    (pt) => pt.id === (score.id ?? score.type),
  );
  const before = (pointType?.beforeText ?? score.beforeText ?? "").trim();
  const after = (pointType?.afterText ?? score.afterText ?? "").trim();
  return [before, label, after].filter(Boolean).join(" ") || label;
}

/** Sort rows by their `index` field. */
export function sortedRows(app: App): Row[] {
  return [...(app.rows ?? [])].sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0),
  );
}

/** Sort a row's choices by their `index` field. */
export function sortedChoices(row: Row): Choice[] {
  return [...(row.objects ?? [])].sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0),
  );
}

/**
 * Count group members across rows and choices. Membership can be declared on
 * a row (`row.groups`) or on individual choices (`choice.groups`).
 */
export function countGroupMembers(app: App, groupId: string): number {
  let count = 0;
  for (const row of app.rows ?? []) {
    if (row.groups?.includes(groupId)) count += 1;
    for (const choice of row.objects ?? []) {
      if (choice.groups?.includes(groupId)) count += 1;
    }
  }
  return count;
}

/**
 * Compute the current point total for every point type from a set of
 * selected choice ids. Totals start at each point type's `startingSum` and
 * add the value of every selected score for that point type.
 */
export function computePointTotals(
  app: App,
  selected: Set<string>,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const pointType of app.pointTypes ?? []) {
    totals[pointType.id] = Number(pointType.startingSum ?? 0);
  }
  for (const row of app.rows ?? []) {
    for (const choice of row.objects ?? []) {
      if (!selected.has(choice.id)) continue;
      for (const score of choice.scores ?? []) {
        const pointTypeId = score.id ?? score.type;
        if (!pointTypeId) continue;
        totals[pointTypeId] =
          (totals[pointTypeId] ?? 0) + Number(score.value ?? 0);
      }
    }
  }
  return totals;
}
