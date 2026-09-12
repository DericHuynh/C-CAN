export type LivePath = readonly string[];
const safe = (key: string) => !["__proto__", "prototype", "constructor"].includes(key);

/** Stable identities in arrays, never array positions that change on reorder. */
export function readLivePath(source: unknown, path: LivePath): unknown {
  if (path[0] === "$categories" && source && typeof source === "object") {
    const categories = (source as { categories?: { idx: number; type: string }[] }).categories;
    return readLivePath(
      categories?.find((item) => item.type === path[1] && String(item.idx) === path[2]),
      path.slice(3),
    );
  }
  if (path[0] === "$choices" && source && typeof source === "object") {
    const rows = (source as { rows?: { objects?: { id: string }[] }[] }).rows;
    return readLivePath(
      rows?.flatMap((row) => row.objects ?? []).find((choice) => choice.id === path[1]),
      path.slice(2),
    );
  }
  let value = source;
  for (const key of path) {
    if (!safe(key) || !value || typeof value !== "object") return undefined;
    value = Array.isArray(value)
      ? value.find((item) => item?.id === key)
      : (value as Record<string, unknown>)[key];
  }
  return value;
}
export function writeLivePath<T>(source: T, path: LivePath, value: unknown): T {
  if (path[0] === "$categories" && source && typeof source === "object") {
    const categories = (source as { categories?: { idx: number; type: string }[] }).categories;
    if (!categories) return source;
    return {
      ...source,
      categories: categories.map((item) =>
        item.type === path[1] && String(item.idx) === path[2]
          ? writeLivePath(item, path.slice(3), value)
          : item,
      ),
    };
  }
  if (path[0] === "$choices" && source && typeof source === "object") {
    const rows = (source as { rows?: { id: string; objects?: { id: string }[] }[] }).rows;
    const row = rows?.find((row) => row.objects?.some((choice) => choice.id === path[1]));
    return row
      ? writeLivePath(source, ["rows", row.id, "objects", ...path.slice(1)], value)
      : source;
  }
  const [key, ...rest] = path;
  if (!key) return value as T;
  if (!safe(key) || !source || typeof source !== "object") return source;
  if (Array.isArray(source)) {
    const index = source.findIndex((item) => item?.id === key);
    if (index < 0) return source; // A draft cannot resurrect a deleted entity.
    const next = source.slice();
    next[index] = writeLivePath(next[index], rest, value);
    return next as T;
  }
  if (!Object.prototype.hasOwnProperty.call(source, key)) return source;
  return { ...source, [key]: writeLivePath((source as Record<string, unknown>)[key], rest, value) };
}
