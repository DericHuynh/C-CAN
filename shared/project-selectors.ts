import type { App, Choice, Row } from "./types.js";

/** Sort rows by their `index` field. */
export function sortedRows(app: App): Row[] {
  return [...(app.rows ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

/** Sort a row's choices by their `index` field. */
export function sortedChoices(row: Row): Choice[] {
  return [...(row.objects ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}
