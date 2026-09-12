import type { Row } from "@shared/types";

/** Return whole rows so search never changes the document's editable structure. */
export function filterEditorRows(rows: Row[], query: string): Row[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  const matches = (...values: unknown[]) =>
    values.some((value) => typeof value === "string" && value.toLowerCase().includes(needle));
  return rows.filter(
    (row) =>
      matches(row.id, row.title, row.titleText) ||
      (row.objects ?? []).some(
        (choice) =>
          matches(choice.id, choice.title, choice.text) ||
          (choice.addons ?? []).some((addon) => matches(addon.id, addon.title, addon.text)),
      ),
  );
}
