import type { App } from "./types";

/** Stable identities for legacy untitled addons, before random default IDs are merged. */
export function ensureAddonIds(app: App): void {
  const used = new Set<string>();
  for (const list of Object.values(app)) {
    if (Array.isArray(list)) for (const item of list) if (item?.id) used.add(item.id);
  }
  const rows = [...(app.rows ?? []), ...(app.backpack ?? [])];
  for (const row of rows)
    for (const choice of row.objects ?? []) {
      if (choice.id) used.add(choice.id);
      for (const addon of choice.addons ?? []) if (addon.id?.trim()) used.add(addon.id);
    }
  rows.forEach((row, ri) =>
    (row.objects ?? []).forEach((choice, ci) => {
      (choice.addons ?? []).forEach((addon, ai) => {
        if (!addon.id?.trim()) {
          const base = `${choice.id || row.id || `row-${ri + 1}-choice-${ci + 1}`}-addon-${ai + 1}`;
          let id = base;
          for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
          addon.id = id;
          used.add(id);
        }
        addon.parentId = choice.id;
      });
    }),
  );
}
