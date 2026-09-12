/** Three-way merging for the structured CYOA document. Never merges by array position. */
export class CollaborationConflict extends Error {
  constructor(public readonly path: string) {
    super(`Another editor changed ${path || "this field"}. Review the latest value before saving.`);
  }
}

export function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((value, index) => sameValue(value, b[index]));
  if (record(a) && record(b)) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && sameValue(a[key], b[key]))
    );
  }
  return false;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function itemKey(value: unknown): string | null {
  if (!record(value)) return null;
  if (typeof value.id === "string" && value.id) return `id:${value.id}`;
  if (typeof value.type === "string" && typeof value.idx === "number")
    return `category:${JSON.stringify([value.type, value.idx])}`;
  return null;
}

/** Merge disjoint edits; same-field edits, delete/edit races and ambiguous lists conflict. */
export function mergeCollaborativeValue<T>(
  base: T,
  local: T,
  remote: T,
  path = "",
  onConflict?: (path: string) => void,
): T {
  if (sameValue(local, base)) return remote;
  if (sameValue(remote, base) || sameValue(local, remote)) return local;
  if (record(base) && record(local) && record(remote)) {
    const result: Record<string, unknown> = {};
    for (const key of new Set([
      ...Object.keys(base),
      ...Object.keys(local),
      ...Object.keys(remote),
    ])) {
      const value = mergeCollaborativeValue(
        base[key],
        local[key],
        remote[key],
        path ? `${path}.${key}` : key,
        onConflict,
      );
      if (value !== undefined)
        Object.defineProperty(result, key, {
          value,
          enumerable: true,
          configurable: true,
          writable: true,
        });
    }
    return result as T;
  }
  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) {
    const keyed = [base, local, remote].map((items) => items.map(itemKey));
    if (
      keyed.every((keys) => keys.every((key) => key !== null) && new Set(keys).size === keys.length)
    ) {
      const [baseKeys, localKeys, remoteKeys] = keyed as string[][];
      const maps = [base, local, remote].map(
        (items, index) => new Map(keyed[index].map((key, i) => [key, items[i]])),
      );
      const retained = baseKeys.filter(
        (key) => localKeys.includes(key) && remoteKeys.includes(key),
      );
      const localOrder = localKeys.filter((key) => retained.includes(key));
      const remoteOrder = remoteKeys.filter((key) => retained.includes(key));
      const reordered = !sameValue(retained, localOrder);
      if (reordered && !sameValue(retained, remoteOrder) && !sameValue(localOrder, remoteOrder)) {
        if (!onConflict) throw new CollaborationConflict(`${path} order`);
        onConflict(`${path} order`);
      }
      const order = [...(reordered ? localKeys : remoteKeys)];
      const additions = reordered ? remoteKeys : localKeys;
      for (const key of additions) {
        if (order.includes(key)) continue;
        const next = additions
          .slice(additions.indexOf(key) + 1)
          .find((candidate) => order.includes(candidate));
        order.splice(next ? order.indexOf(next) : order.length, 0, key);
      }
      // Include deleted keys for conflict detection (delete versus edit).
      for (const key of baseKeys) if (!order.includes(key)) order.push(key);
      return order.flatMap((key) => {
        const value = mergeCollaborativeValue(
          maps[0].get(key),
          maps[1].get(key),
          maps[2].get(key),
          `${path}[${key}]`,
          onConflict,
        );
        return value === undefined ? [] : [value];
      }) as T;
    }
  }
  if (!onConflict) throw new CollaborationConflict(path);
  onConflict(path);
  return local;
}

/** Only changed patch fields need to cross the action boundary. */
export function changedFields(base: Record<string, unknown>, patch: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(patch).filter(([key, value]) => !sameValue(base[key], value)),
  );
}
