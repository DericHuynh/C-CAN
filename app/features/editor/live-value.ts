import * as Y from "yjs";
import { sameValue } from "@shared/collaboration-merge";

/** Strings remain Y.Text even inside addons, scores, requirements and styling. */
export function makeLiveValue(value: unknown): unknown {
  if (typeof value === "string") return new Y.Text(value);
  if (Array.isArray(value)) {
    const node = new Y.Map<unknown>();
    const entries = new Y.Map<unknown>();
    const keys = arrayKeys(value);
    node.set("kind", "array");
    node.set("order", keys);
    value.forEach((item, i) => entries.set(keys[i], makeLiveValue(item)));
    node.set("entries", entries);
    return node;
  }
  if (value && typeof value === "object") {
    const node = new Y.Map<unknown>();
    node.set("kind", "object");
    const entries = new Y.Map<unknown>();
    Object.entries(value).forEach(([key, item]) => entries.set(key, makeLiveValue(item)));
    node.set("entries", entries);
    return node;
  }
  return value;
}
export function readLiveValue(value: unknown): unknown {
  if (value instanceof Y.Text) return value.toString();
  if (!(value instanceof Y.Map)) return value;
  const entries = value.get("entries") as Y.Map<unknown>;
  if (value.get("kind") === "array") {
    const order = value.get("order") as string[];
    // Concurrent additions must survive even if the other peer also reordered.
    const keys = [...new Set([...order, ...entries.keys()])].filter((key) => entries.has(key));
    return keys.map((key) => readLiveValue(entries.get(key)));
  }
  return Object.fromEntries([...entries].map(([key, item]) => [key, readLiveValue(item)]));
}
function arrayKeys(items: unknown[]) {
  const ids = items.map((item) =>
    item && typeof item === "object" && "id" in item ? String(item.id) : "",
  );
  return ids.map((id, i) =>
    id && ids.indexOf(id) === ids.lastIndexOf(id) ? "id:" + id : "index:" + i,
  );
}
export function patchLiveValue(
  parent: Y.Map<unknown>,
  key: string,
  next: unknown,
  updateText: (text: Y.Text, value: string) => void,
) {
  const previous = parent.get(key);
  if (previous instanceof Y.Text && typeof next === "string") {
    updateText(previous, next);
    return;
  }
  if (
    previous instanceof Y.Map &&
    next &&
    typeof next === "object" &&
    previous.get("kind") === (Array.isArray(next) ? "array" : "object")
  ) {
    const entries = previous.get("entries") as Y.Map<unknown>;
    const record = Array.isArray(next)
      ? Object.fromEntries(arrayKeys(next).map((id, i) => [id, next[i]]))
      : (next as Record<string, unknown>);
    for (const id of entries.keys()) if (!(id in record)) entries.delete(id);
    for (const [id, item] of Object.entries(record)) patchLiveValue(entries, id, item, updateText);
    if (Array.isArray(next) && !sameValue(previous.get("order"), Object.keys(record)))
      previous.set("order", Object.keys(record));
    return;
  }
  if (!sameValue(readLiveValue(previous), next)) parent.set(key, makeLiveValue(next));
}
