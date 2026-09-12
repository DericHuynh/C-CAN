import { createDefaultApp, normalizeApp } from "./cyoa";
import type { App } from "./types";
import { projectEntities, resolveEntity } from "./project-workflow";
import { validateProject } from "./project-validation";

export function copyProjectReference(
  source: App,
  scope: "full" | "sections" | "style" | "mechanics",
  rowIds: string[] = [],
) {
  let app = structuredClone(source);
  const notes: string[] = [];
  if (scope === "style") {
    app = createDefaultApp();
    app.rows = [];
    app.styling = structuredClone(source.styling);
    app.images = structuredClone(source.images ?? []);
    notes.push("Copied global styling and image resources. No authored rows or mechanics copied.");
  }
  if (scope === "sections") {
    if (!rowIds.length)
      throw new Error("Select at least one row ID or unique title for a section copy.");
    const entries = projectEntities(source),
      edges = validateProject(source).references;
    const included = new Set(rowIds.map((id) => resolveEntity(entries, id, "row").id));
    // A dependent choice/addon needs its containing row. Include the row's
    // children, then follow known mechanics until the closure stops growing.
    let changed = true;
    while (changed) {
      changed = false;
      const add = (id: string) => {
        if (!included.has(id)) {
          included.add(id);
          changed = true;
        }
      };
      for (const e of entries) if (included.has(e.id) && e.rowId) add(e.rowId);
      for (const e of entries) if (e.rowId && included.has(e.rowId)) add(e.id);
      for (const edge of edges) if (included.has(edge.source)) add(edge.value.split("/ON#")[0]);
    }
    app.rows = app.rows.filter((r) => included.has(r.id));
    app.pointTypes = app.pointTypes.filter((p) => included.has(p.id));
    app.groups = app.groups.filter((g) => included.has(g.id));
    app.globalRequirements = app.globalRequirements?.filter((r) => included.has(r.id));
    app.backpack = [];
    app.activated = (app.activated ?? []).filter((id) => included.has(id));
    notes.push(
      `Included ${app.rows.length} rows from ${rowIds.length} requested roots, following known dependencies. Review the manifest for automatically included rows.`,
    );
  }
  if (scope === "mechanics") {
    const base = createDefaultApp();
    const fields = new Set([
      "id",
      "title",
      "name",
      "objects",
      "addons",
      "parentId",
      "requireds",
      "scores",
      "groups",
      "elements",
      "rowElements",
      "allowedChoices",
      "isSelectable",
      "isNotSelectable",
      "isSelectableMultiple",
      "numMultipleTimesPluss",
      "numMultipleTimesMinus",
      "isAutoActive",
      "forcedActivated",
      "selectOnce",
      "startingSum",
      "initValue",
      "isChangeStartingSum",
      "isNotGoingBelowZero",
    ]);
    const copy = (value: Record<string, any>): Record<string, any> =>
      Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => fields.has(key))
          .map(([key, v]) => [
            key,
            ["objects", "addons"].includes(key) ? v.map(copy) : structuredClone(v),
          ]),
      );
    base.rows = source.rows.map(copy) as App["rows"];
    base.pointTypes = source.pointTypes.map(copy) as App["pointTypes"];
    base.groups = source.groups.map(copy) as App["groups"];
    base.globalRequirements = source.globalRequirements?.map(copy) as App["globalRequirements"];
    base.variables = structuredClone(source.variables);
    app = normalizeApp(base);
    notes.push(
      "Copied core selection rules, currencies, scores, requirements and groups. Prose, images, styling and advanced activation/function effects are omitted; review validation before use.",
    );
  }
  // Editorial plans describe the source project and must not be applied to a copy.
  if (scope !== "full") delete app.planning;
  const validation = validateProject(app);
  return { app, notes, validation };
}
