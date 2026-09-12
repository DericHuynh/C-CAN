import * as Y from "yjs";
import { captureLiveCaret } from "./live-caret";
import { makeLiveValue, patchLiveValue, readLiveValue } from "./live-value";
import { sameValue } from "@shared/collaboration-merge";

import { readLivePath, writeLivePath, type LivePath } from "@shared/live-project-path";
export { readLivePath, writeLivePath, type LivePath } from "@shared/live-project-path";
const LOCAL = "cyoa-local-edit";

// A deterministic 53-bit id makes simultaneous first-open seeds identical Yjs
// operations, instead of duplicating the initial text or choosing one user's map.
function hash(text: string) {
  let a = 0xdeadbeef,
    b = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 2654435761);
    b = Math.imul(b ^ text.charCodeAt(i), 1597334677);
  }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return 4294967296 * (2097151 & b) + (a >>> 0);
}
export function canShareLiveValue(value: unknown) {
  const json = JSON.stringify(value) ?? "";
  return json.length <= 256 * 1024 && !/data:[^,\s]*;base64,/i.test(json);
}
export function liveFieldKey(path: LivePath, _base?: unknown) {
  return JSON.stringify(path);
}

/** Change only the differing span. Shared characters retain their CRDT identity. */
export function updateLiveText(text: Y.Text, value: string) {
  const previous = text.toString();
  let start = 0;
  while (start < previous.length && start < value.length && previous[start] === value[start])
    start++;
  // Yjs splits strings by UTF-16 offsets; never split an emoji's surrogate pair.
  const splitsPair = (input: string, at: number) =>
    at > 0 &&
    at < input.length &&
    input.charCodeAt(at - 1) >= 0xd800 &&
    input.charCodeAt(at - 1) <= 0xdbff &&
    input.charCodeAt(at) >= 0xdc00 &&
    input.charCodeAt(at) <= 0xdfff;
  if (splitsPair(previous, start) || splitsPair(value, start)) start--;
  let end = 0;
  while (
    end < previous.length - start &&
    end < value.length - start &&
    previous[previous.length - 1 - end] === value[value.length - 1 - end]
  )
    end++;
  if (end && (splitsPair(previous, previous.length - end) || splitsPair(value, value.length - end)))
    end--;
  if (previous.length - start - end) text.delete(start, previous.length - start - end);
  if (value.length - start - end) text.insert(start, value.slice(start, value.length - end));
}

type Field = { path: string[]; base: unknown; previousBase?: unknown; kind: "text" | "value" };
export function createLiveFields(doc: Y.Doc, canWrite = true) {
  const fields = doc.getMap<Field>("cyoa-live-fields-v1");
  const listeners = new Set<() => void>();
  let version = 0;
  const seen = new Map<string, Set<number>>();
  // Recovered drafts resume autosave for editors; later remote-only updates
  // do not start competing save queues in every connected tab.
  const localFields = new Set<string>(canWrite ? fields.keys() : []);
  let active: { element: Element | null; text: Y.Text } | null = null;
  let restore: (() => void) | null = null;
  let frame: number | undefined;
  const before = (transaction: Y.Transaction) => {
    if (
      transaction.origin !== LOCAL &&
      typeof document !== "undefined" &&
      active?.element === document.activeElement
    )
      restore = captureLiveCaret(active.text);
  };
  const after = () => {
    if (!restore) return;
    const restoreCaret = restore;
    restore = null;
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(restoreCaret);
  };
  const emit = () => {
    fields.forEach((field, key) => {
      const value =
        field.kind === "text"
          ? doc.getText(key).toString()
          : readLiveValue(doc.getMap(key).get("value"));
      const history = seen.get(key) ?? new Set<number>();
      history.add(hash(JSON.stringify(value) ?? "undefined"));
      if (history.size > 256) history.delete(history.values().next().value!);
      seen.set(key, history);
    });
    version++;
    listeners.forEach((fn) => fn());
  };
  return {
    subscribe(fn: () => void) {
      if (!listeners.size) {
        doc.on("beforeTransaction", before);
        doc.on("afterTransaction", after);
        doc.on("afterTransaction", emit);
      }
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
        if (!listeners.size) {
          doc.off("beforeTransaction", before);
          doc.off("afterTransaction", after);
          doc.off("afterTransaction", emit);
          if (frame !== undefined) cancelAnimationFrame(frame);
        }
      };
    },
    version: () => version,
    has(path: LivePath, base: unknown) {
      const field = fields.get(liveFieldKey(path));
      return (
        !!field &&
        (sameValue(field.base, base) ||
          (field.previousBase !== undefined && sameValue(field.previousBase, base)))
      );
    },
    read<T>(path: LivePath, base: T): T {
      const key = liveFieldKey(path, base);
      const field = fields.get(key);
      if (!field || (!sameValue(field.base, base) && !sameValue(field.previousBase, base)))
        return base;
      return (
        field.kind === "text"
          ? doc.getText(key).toString()
          : readLiveValue(doc.getMap(key).get("value"))
      ) as T;
    },
    write<T>(path: LivePath, base: T, value: T) {
      if (!canWrite || !canShareLiveValue(base) || !canShareLiveValue(value)) return false;
      const key = liveFieldKey(path, base);
      localFields.add(key);
      doc.transact(() => {
        if (!fields.has(key)) {
          const seed = new Y.Doc();
          seed.clientID = hash("cyoa-seed:" + key + JSON.stringify(base));
          if (typeof base === "string") seed.getText(key).insert(0, base);
          else seed.getMap(key).set("value", makeLiveValue(base));
          Y.applyUpdate(doc, Y.encodeStateAsUpdate(seed), "seed");
          seed.destroy();
          fields.set(key, {
            path: [...path],
            base,
            kind: typeof value === "string" ? "text" : "value",
          });
        }
        const field = fields.get(key)!;
        if (!sameValue(field.base, base) && !sameValue(field.previousBase, base))
          fields.set(key, { ...field, base, previousBase: undefined });
        if (typeof value === "string") updateLiveText(doc.getText(key), value);
        else patchLiveValue(doc.getMap(key), "value", value, updateLiveText);
      }, LOCAL);
      if (typeof value === "string" && typeof document !== "undefined")
        active = { element: document.activeElement, text: doc.getText(key) };
    },
    pending(source: unknown, metadata?: { title: string; description: string }) {
      const pending: { path: string[]; base: unknown; value: unknown }[] = [];
      fields.forEach((field, key) => {
        if (!localFields.has(key)) return;
        const path = field.path[0] === "$draft" ? field.path.slice(1) : field.path;
        if (["id", "index", "idx"].includes(path[path.length - 1])) return;
        if (path[path.length - 1] === "$kind") {
          const row = readLivePath(source, path.slice(0, -1)) as
            | Record<string, unknown>
            | undefined;
          if (!row) return;
          const flags = {
            button: "isButtonRow",
            info: "isInfoRow",
            result: "isResultRow",
            group: "isGroupRow",
          };
          const kind = Object.entries(flags).find(([, flag]) => row[flag])?.[0] ?? "normal";
          const value = doc.getText(key).toString();
          if (kind !== field.base || value === kind) return;
          for (const [kind, flag] of Object.entries(flags))
            if (row[flag] !== (kind === value))
              pending.push({
                path: [...path.slice(0, -1), flag],
                base: row[flag],
                value: kind === value,
              });
          return;
        }
        if (path[path.length - 1] === "functions" && field.base && typeof field.base === "object") {
          const choice = readLivePath(source, path.slice(0, -1)) as
            | Record<string, unknown>
            | undefined;
          const value = readLiveValue(doc.getMap(key).get("value")) as Record<string, unknown>;
          if (!choice || !value) return;
          for (const [name, next] of Object.entries(value)) {
            const base = (field.base as Record<string, unknown>)[name];
            if (
              choice[name] !== undefined &&
              sameValue(choice[name], base) &&
              !sameValue(base, next)
            )
              pending.push({ path: [...path.slice(0, -1), name], base, value: next });
          }
          return;
        }
        const current =
          path[0] === "$metadata"
            ? metadata?.[path[1] as "title" | "description"]
            : readLivePath(source, path);
        if (current === undefined) return;
        let base = field.base;
        let value =
          field.kind === "text"
            ? doc.getText(key).toString()
            : readLiveValue(doc.getMap(key).get("value"));
        if (value === "__custom__") return;
        if (field.path[0] === "$draft") {
          if (
            typeof current === "number" &&
            typeof value === "string" &&
            typeof base === "string"
          ) {
            if (!value.trim() || !Number.isFinite(Number(value))) return;
            base = Number(base);
            value = Number(value);
            if (path[path.length - 1] === "allowedChoices" && Number(value) < 0) return;
          } else if (
            Array.isArray(current) &&
            current.every((item) => typeof item === "string") &&
            typeof value === "string" &&
            typeof base === "string"
          ) {
            base = base
              .split(",")
              .map((part) => part.trim())
              .filter(Boolean);
            value = value
              .split(",")
              .map((part) => part.trim())
              .filter(Boolean);
          } else if (typeof current !== typeof value) return;
        }
        if (sameValue(current, base) && !sameValue(value, current))
          pending.push({ path, base, value });
      });
      return pending.slice(0, 200);
    },
    wasSeen(path: LivePath, base: unknown, value: unknown) {
      return (
        seen.get(liveFieldKey(path, base))?.has(hash(JSON.stringify(value) ?? "undefined")) ?? false
      );
    },
    acknowledge(before: unknown, after: unknown, knownOnly = false) {
      if (!canWrite) return;
      doc.transact(() => {
        fields.forEach((field, key) => {
          let previous = readLivePath(before, field.path);
          let next = readLivePath(after, field.path);
          if (field.path[0] === "$draft") {
            previous = readLivePath(before, field.path.slice(1));
            next = readLivePath(after, field.path.slice(1));
            const format = (value: unknown) =>
              typeof value === "number"
                ? String(value)
                : Array.isArray(value)
                  ? value.join(", ")
                  : value;
            previous = format(previous);
            next = format(next);
          }
          if (next === undefined || sameValue(next, field.base) || !sameValue(previous, field.base))
            return;
          if (knownOnly && !seen.get(key)?.has(hash(JSON.stringify(next) ?? "undefined"))) return;
          fields.set(key, { ...field, previousBase: field.base, base: next });
        });
      }, "acknowledged-save");
    },
    reconcileSaved(before: unknown, after: unknown) {
      if (!canWrite) return;
      doc.transact(() => {
        fields.forEach((field, key) => {
          const previous = readLivePath(before, field.path);
          const next = readLivePath(after, field.path);
          if (next === undefined || sameValue(previous, next) || !sameValue(field.base, previous))
            return;
          const current =
            field.kind === "text"
              ? doc.getText(key).toString()
              : readLiveValue(doc.getMap(key).get("value"));
          if (!sameValue(current, previous)) return; // Uncommitted overlap requires review.
          if (typeof next === "string" && field.kind === "text")
            updateLiveText(doc.getText(key), next);
          else if (field.kind === "value")
            patchLiveValue(doc.getMap(key), "value", next, updateLiveText);
          else return;
          fields.set(key, { ...field, previousBase: field.base, base: next });
        });
      }, "agent-reconcile");
    },
    preview<T>(source: T): T {
      let result = source;
      fields.forEach((field, key) => {
        if (["id", "index", "idx"].includes(field.path[field.path.length - 1])) return;
        // Old generations cannot overwrite a newer agent save or deleted item.
        if (
          !sameValue(readLivePath(source, field.path), field.base) &&
          !sameValue(readLivePath(source, field.path), field.previousBase)
        )
          return;
        const value =
          field.kind === "text"
            ? doc.getText(key).toString()
            : readLiveValue(doc.getMap(key).get("value"));
        if (!sameValue(value, readLivePath(source, field.path)))
          result = writeLivePath(result, field.path, value);
      });
      return result;
    },
    destroy() {
      doc.off("afterTransaction", emit);
      doc.off("beforeTransaction", before);
      doc.off("afterTransaction", after);
      if (frame !== undefined) cancelAnimationFrame(frame);
      listeners.clear();
    },
  };
}
export type LiveFields = ReturnType<typeof createLiveFields>;
