import { useState } from "react";

/** Keep inspector selection stable while its saved entity changes under collaboration. */
export function useLiveSelection<T>(
  items: T[],
  key: (item: T) => string = (item) => (item as { id: string }).id,
) {
  const [selection, setSelection] = useState<T | "new" | null>(null);
  const current =
    selection === null || selection === "new"
      ? selection
      : (items.find((item) => key(item) === key(selection)) ?? null);
  if (selection !== null && current === null) setSelection(null);
  return [current, setSelection] as const;
}
