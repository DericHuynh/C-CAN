import { z } from "zod";
import type { App } from "./types";

export const entityKindSchema = z.enum(["row", "choice", "addon", "point", "group", "requirement"]);
export type EntityKind = z.infer<typeof entityKindSchema>;
export const operationSchema = z.object({
  op: z.enum(["create", "update", "delete"]),
  kind: entityKindSchema,
  id: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe("Existing ID, unique title, or new semantic ID"),
  alias: z.string().min(1).max(100).optional().describe("Batch alias, referenced as $alias"),
  parent: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe(
      "Parent row for a choice; parent choice for an addon. IDs, titles and $aliases accepted.",
    ),
  fields: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Narrow field patch. scores/requireds/groups are arrays; IDs may refer to entities created later in this same batch.",
    ),
  expected: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("For updates/deletes, values from the last read; reject if any changed."),
});
export type BuildOperation = z.infer<typeof operationSchema>;
export type EntityEntry = {
  kind: EntityKind;
  id: string;
  title: string;
  entity: Record<string, any>;
  parentId?: string;
  rowId?: string;
  choiceId?: string;
  index: number;
  collection: any[];
};
export function projectEntities(app: App): EntityEntry[] {
  const entries: EntityEntry[] = [];
  const add = (kind: EntityKind, collection: any[], parent?: EntityEntry) =>
    collection.forEach((entity, index) => {
      const entry: EntityEntry = {
        kind,
        id: entity.id,
        title: entity.title || entity.name || `${kind} ${index + 1}`,
        entity,
        index,
        collection,
        ...(kind === "row"
          ? { rowId: entity.id }
          : parent
            ? {
                parentId: parent.id,
                rowId: parent.rowId,
                choiceId: kind === "choice" ? entity.id : parent.id,
              }
            : {}),
      };
      entries.push(entry);
      if (kind === "row") add("choice", entity.objects ?? [], entry);
      if (kind === "choice") add("addon", entity.addons ?? [], entry);
    });
  add("row", app.rows ?? []);
  add("point", app.pointTypes ?? []);
  add("group", app.groups ?? []);
  add("requirement", app.globalRequirements ?? []);
  return entries;
}
export function resolveEntity(entries: EntityEntry[], ref: string, kind?: EntityKind): EntityEntry {
  const candidates = entries.filter((e) => !kind || e.kind === kind);
  const ids = candidates.filter((e) => e.id === ref);
  const matches = ids.length
    ? ids
    : candidates.filter((e) => e.title.toLocaleLowerCase() === ref.toLocaleLowerCase());
  if (matches.length !== 1)
    throw new Error(
      matches.length
        ? `Ambiguous ${kind ?? "entity"} reference "${ref}"; use an ID: ${matches
            .map((e) => e.id)
            .slice(0, 8)
            .join(", ")}`
        : `Unknown ${kind ?? "entity"} reference "${ref}"`,
    );
  return matches[0];
}
export function entityTarget(entry: EntityEntry) {
  return {
    ...(entry.rowId ? { rowId: entry.rowId } : {}),
    ...(entry.choiceId ? { choiceId: entry.choiceId } : {}),
    ...(entry.kind === "addon" ? { addonId: entry.id } : {}),
  };
}
export function semanticId(kind: EntityKind, title: string, parent?: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug)
    throw new Error("Supply an explicit semantic ID for an entity without a usable title.");
  return `${parent ? `${parent}-` : ""}${kind}-${slug}`.slice(0, 200);
}
