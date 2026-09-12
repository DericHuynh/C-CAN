import type { App, Category } from "./types.js";

const collections = new Map(
  Object.entries({
    pointType: ["pointTypes"],
    variable: ["variables"],
    word: ["words"],
    group: ["groups"],
    designGroup: ["rowDesignGroups", "objectDesignGroups"],
    globalRequirement: ["globalRequirements"],
    soundEffect: ["soundEffects"],
  }),
);

/** Clear deleted category slots before their numeric IDs can be reused. */
export function clearDeletedCategoryAssignments(app: App, previous: Category[]) {
  for (const category of previous) {
    if (app.categories.some((next) => next.type === category.type && next.idx === category.idx))
      continue;
    for (const key of collections.get(category.type) ?? []) {
      if (!Array.isArray(app[key])) continue;
      for (const item of app[key]) {
        if (item && typeof item === "object" && item.category === category.idx)
          delete item.category;
      }
    }
  }
}
