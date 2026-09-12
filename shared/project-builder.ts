import {
  createDefaultAddon,
  createDefaultChoice,
  createDefaultGlobalRequirement,
  createDefaultGroup,
  createDefaultPointType,
  createDefaultRow,
  normalizeApp,
} from "./cyoa";
import type { App } from "./types";
import {
  projectEntities,
  resolveEntity,
  semanticId,
  entityTarget,
  type BuildOperation,
  type EntityKind,
} from "./project-workflow";
import {
  issueKey,
  validateProject,
  visitReferences,
  type ReferenceKind,
} from "./project-validation";

export function buildProjectDocument(original: App, operations: BuildOperation[]) {
  let app = structuredClone(original);
  const aliases = new Map<string, string>();
  const changes: Array<{
    operation: number;
    op: string;
    kind: EntityKind;
    id: string;
    title: string;
    target: ReturnType<typeof entityTarget>;
  }> = [];
  const touched = new Set<string>();
  const ref = (value: string) =>
    value.startsWith("$") ? (aliases.get(value.slice(1)) ?? value) : value;
  // Create parents before children, independent of the caller's operation order.
  const pending = operations
    .map((op, index) => ({ op, index }))
    .filter(({ op }) => op.op === "create");
  while (pending.length) {
    let progress = false;
    for (let i = 0; i < pending.length;) {
      const { op, index } = pending[i];
      if (op.parent?.startsWith("$") && !aliases.has(op.parent.slice(1))) {
        i++;
        continue;
      }
      try {
        const entries = projectEntities(app);
        const parentKind =
          op.kind === "choice" ? "row" : op.kind === "addon" ? "choice" : undefined;
        if (parentKind && !op.parent) throw new Error(`${op.kind} needs a parent ${parentKind}`);
        if (
          parentKind &&
          !entries.some(
            (e) =>
              e.kind === parentKind &&
              (e.id === ref(op.parent!) || e.title.toLowerCase() === ref(op.parent!).toLowerCase()),
          )
        ) {
          i++;
          continue;
        }
        const parent = parentKind ? resolveEntity(entries, ref(op.parent!), parentKind) : undefined;
        const fields = { ...op.fields };
        if ("objects" in fields || "addons" in fields)
          throw new Error(
            "Create nested choices/addons as separate operations in this same atomic batch.",
          );
        const title = String(fields.title ?? fields.name ?? `${op.kind} ${index + 1}`);
        const id = op.id ?? semanticId(op.kind, title, parent?.id);
        if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,199}$/.test(id))
          throw new Error(
            "New IDs must be 1–200 letters, digits, dots, underscores, colons or hyphens.",
          );
        if (entries.some((e) => e.id === id))
          throw new Error(`ID "${id}" already exists; use update or a different ID.`);
        if (op.alias) {
          if (aliases.has(op.alias)) throw new Error(`Duplicate batch alias "${op.alias}"`);
          aliases.set(op.alias, id);
        }
        const defaults: Record<EntityKind, () => any> = {
          row: () => createDefaultRow(app, app.rows.length),
          choice: () => createDefaultChoice(app, parent!.entity.objects.length),
          addon: () => createDefaultAddon(app),
          point: () => createDefaultPointType(app, title),
          group: () => createDefaultGroup(title),
          requirement: () => createDefaultGlobalRequirement(title),
        };
        const entity = { ...defaults[op.kind](), ...fields, id };
        if (["row", "choice", "addon"].includes(op.kind) && !entity.title?.trim())
          entity.title = title.trim() || `${op.kind} ${index + 1}`;
        if (op.kind === "addon") entity.parentId = parent!.id;
        const lists: Record<string, any[]> = {
          row: app.rows,
          point: app.pointTypes,
          group: app.groups,
          requirement: app.globalRequirements ?? (app.globalRequirements = []),
        };
        const collection = parent
          ? op.kind === "choice"
            ? parent.entity.objects
            : (parent.entity.addons ?? (parent.entity.addons = []))
          : lists[op.kind];
        collection.push(entity);
        touched.add(id);
        changes.push({ operation: index, op: op.op, kind: op.kind, id, title, target: {} });
        pending.splice(i, 1);
        progress = true;
      } catch (error) {
        throw new Error(
          `Operation ${index}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (!progress)
      throw new Error(
        `Unresolved or cyclic parent references in operations: ${pending.map((p) => p.index).join(", ")}`,
      );
  }
  for (const [index, op] of operations.entries()) {
    if (op.op === "create") continue;
    try {
      if (!op.id) throw new Error("An ID or unique title is required.");
      const entry = resolveEntity(projectEntities(app), ref(op.id), op.kind);
      if (op.expected)
        for (const [key, value] of Object.entries(op.expected))
          if (JSON.stringify(entry.entity[key]) !== JSON.stringify(value))
            throw new Error(`Conflict: ${entry.id}.${key} changed since it was read.`);
      if (op.op === "delete") entry.collection.splice(entry.index, 1);
      else {
        for (const key of ["id", "index", "parentId", "objects", "addons"])
          if (key in (op.fields ?? {}))
            throw new Error(`Patch individual entities; ${key} cannot be replaced by an update.`);
        Object.assign(entry.entity, op.fields);
        touched.add(entry.id);
      }
      changes.push({
        operation: index,
        op: op.op,
        kind: op.kind,
        id: entry.id,
        title: entry.title,
        target: entityTarget(entry),
      });
    } catch (error) {
      throw new Error(
        `Operation ${index}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  app = normalizeApp(app);
  const entries = projectEntities(app);
  function resolveReference(value: string, kind: ReferenceKind): string {
    const [base, suffix] = value.split("/ON#");
    const actual = ref(base);
    if (kind === "variable") {
      if (!(app.variables ?? []).some((v) => v.id === actual))
        throw new Error(`Unknown variable reference "${actual}"`);
      return actual;
    }
    if (kind === "activation-target") {
      const found = resolveEntity(
        entries.filter((e) => ["choice", "addon", "group"].includes(e.kind)),
        actual,
      );
      return found.id + (suffix ? `/ON#${suffix}` : "");
    }
    if (kind === "activation") {
      if ((app.variables ?? []).some((v) => v.id === actual))
        return actual + (suffix ? `/ON#${suffix}` : "");
      const found = resolveEntity(
        entries.filter((e) => ["row", "choice", "addon"].includes(e.kind)),
        actual,
      );
      return found.id + (suffix ? `/ON#${suffix}` : "");
    }
    return resolveEntity(entries, actual, kind as EntityKind).id;
  }
  for (const entry of entries)
    if (touched.has(entry.id))
      visitReferences(entry.entity, entry.id, (r) => {
        try {
          return resolveReference(r.value, r.kind);
        } catch (error) {
          if (
            r.value.startsWith("$") ||
            (error instanceof Error && error.message.startsWith("Ambiguous"))
          )
            throw error;
          return r.value;
        }
      });
  const validation = validateProject(app);
  const oldErrors = new Set(
    validateProject(original)
      .issues.filter((i) => i.severity === "error")
      .map(issueKey),
  );
  const introducedErrors = validation.issues.filter(
    (i) => i.severity === "error" && !oldErrors.has(issueKey(i)),
  );
  for (const change of changes) {
    const entry = entries.find((e) => e.id === change.id);
    if (entry) {
      change.title = entry.title;
      change.target = entityTarget(entry);
    }
  }
  return {
    app,
    changes: changes.sort((a, b) => a.operation - b.operation),
    aliases: Object.fromEntries(aliases),
    validation,
    introducedErrors,
  };
}
