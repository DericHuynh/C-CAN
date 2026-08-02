/**
 * Aggregate stats for a large ICCPlus project.json.
 *
 * Walks the (17 MB) example document WITHOUT printing raw values and reports,
 * per collection (rows, choices, addons, point types, groups, …) and for the
 * styling object:
 *   - which keys are present and how many items carry them
 *   - the value type + a small sample of distinct values (so we can see what
 *     the viewer must actually apply)
 *   - which keys exist in the source but are missing from our defaults
 *     (forward-compat extras) and vice versa
 *
 * Image/binary payload keys (`image`, `*BackgroundImage`, `*BorderImage`, …)
 * are ignored entirely — ICCPlus documents embed base64 webp data that would
 * otherwise flood the output and make the result unusable in an agent context.
 * Any string value that still looks like a data URL or is very long is
 * summarized to a placeholder instead of being printed.
 *
 * Usage: pnpm script aggregate-json-stats [--file path/to/project.json]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  createDefaultAddon,
  createDefaultApp,
  createDefaultChoice,
  createDefaultGlobalRequirement,
  createDefaultGroup,
  createDefaultPointType,
  createDefaultRow,
  createDefaultSoundEffect,
  createDefaultVariable,
  createDefaultWord,
  normalizeApp,
} from "../shared/cyoa.js";

type Sample = { count: number; values: unknown[] };

/** Keys that carry binary/embedded payloads — always skipped, never sampled. */
const PAYLOAD_KEYS = new Set([
  "image",
  "backgroundImage",
  "rowBackgroundImage",
  "objectBackgroundImage",
  "addonBackgroundImage",
  "backpackBgImage",
  "objectBorderImage",
  "rowBorderImage",
  "addonBorderImage",
  "bgImage",
  "defaultImage",
  "negativeImage",
  "audio",
  "favicon",
  "loadingBgImage",
]);

const DATA_URL_RE = /^data:[\w/+.-]+;base64,/i;

function typeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

/**
 * Deep-truncate a value so it is safe to print in an agent context: strings
 * are cut to 80 chars, objects/arrays are sampled shallowly, and anything
 * beyond a small depth collapses to a placeholder. Data URLs and very long
 * strings become `(N chars)` markers instead of raw payloads.
 */
function summarizeValue(v: unknown, depth = 0): unknown {
  if (typeof v === "string") {
    if (DATA_URL_RE.test(v)) return `<data-url ${v.length} chars>`;
    if (v.length > 80) return `"${v.slice(0, 80)}… (${v.length} chars)"`;
    return v;
  }
  if (Array.isArray(v)) {
    if (depth >= 2) return `[array ${v.length}]`;
    const items = v.slice(0, 3).map((item) => summarizeValue(item, depth + 1));
    if (v.length > 3) items.push(`… +${v.length - 3} more`);
    return items;
  }
  if (v !== null && typeof v === "object") {
    if (depth >= 2) return `{object ${Object.keys(v as object).length} keys}`;
    const entries = Object.entries(v as Record<string, unknown>);
    const out: Record<string, unknown> = {};
    for (const [k, val] of entries.slice(0, 6)) out[k] = summarizeValue(val, depth + 1);
    if (entries.length > 6) out["..."] = `+${entries.length - 6} more keys`;
    return out;
  }
  return v;
}

/**
 * Summarize a value for context: type + tiny sample, never the full raw
 * payload. Data URLs, image-ish URLs and very long strings collapse to a
 * placeholder.
 */
function summarize(v: unknown, max = 3): Sample {
  if (Array.isArray(v)) {
    if (v.length === 0) return { count: 0, values: [[]] };
    return {
      count: v.length,
      values: v.slice(0, max).map((item) => summarizeValue(item)),
    };
  }
  return { count: 1, values: [summarizeValue(v)] };
}

/**
 * Aggregate a list of objects by key: presence count + distinct sample values.
 * Only keys that are not payload keys are reported; values are always
 * summarized (never stored raw).
 */
function aggregateItems(items: unknown[]): Record<string, Sample> {
  const out: Record<string, Sample> = {};
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
      if (PAYLOAD_KEYS.has(key)) continue;
      const existing = out[key];
      if (!existing) {
        out[key] = summarize(value);
        continue;
      }
      existing.count += 1;
      if (existing.values.length < 5) {
        const sample = summarize(value, 1).values[0];
        if (!existing.values.some((v) => JSON.stringify(v) === JSON.stringify(sample))) {
          existing.values.push(sample);
        }
      }
    }
  }
  return out;
}

export default async function aggregateJsonStats(args: Record<string, unknown>) {
  const file = (args.file as string) ?? "examples/project.json";
  const raw = JSON.parse(readFileSync(resolve(file), "utf8")) as Record<string, unknown>;
  const defaults = createDefaultApp();
  const app = normalizeApp(raw) as Record<string, unknown>;

  console.log(`file: ${file}`);
  console.log(`top-level keys: ${Object.keys(raw).length}`);

  const print = (label: string, agg: Record<string, Sample>, total: number) => {
    const keys = Object.keys(agg).sort();
    console.log(`\n== ${label} (${keys.length} keys) ==`);
    for (const key of keys) {
      const { count, values } = agg[key];
      const valStr = values.map((v) => (v === undefined ? "undefined" : JSON.stringify(v))).join(" | ");
      console.log(`  ${key}: [${count}/${total}] ${typeOf(values[0])} ${valStr}`);
    }
  };

  // Top-level: which keys are NOT covered by our default app?
  const topMissing = Object.keys(raw).filter((k) => !(k in defaults));
  console.log(`\n[top-level] source keys missing from createDefaultApp(): ${topMissing.length ? topMissing.join(", ") : "none"}`);
  const topExtra = Object.keys(defaults).filter((k) => !(k in raw));
  console.log(`[top-level] default keys absent from source (filled by normalize): ${topExtra.length}`);

  // Styling
  const srcStyling = raw.styling as Record<string, unknown> | undefined;
  const defStyling = defaults.styling as Record<string, unknown>;
  if (srcStyling) {
    const missing = Object.keys(srcStyling).filter((k) => !(k in defStyling));
    console.log(`\n[styling] source styling keys missing from defaults: ${missing.length ? missing.join(", ") : "none"}`);
    console.log(`[styling] default styling keys absent from source (filled by normalize): ${Object.keys(defStyling).filter((k) => !(k in srcStyling)).length}`);
    const payload = Object.keys(srcStyling).filter((k) => PAYLOAD_KEYS.has(k));
    if (payload.length) console.log(`[styling] payload keys ignored: ${payload.join(", ")}`);
    // Only print keys whose value differs from defaults — that's what the doc customizes.
    const custom = Object.keys(srcStyling).filter(
      (k) => !PAYLOAD_KEYS.has(k) && JSON.stringify(srcStyling[k]) !== JSON.stringify(defStyling[k]),
    );
    console.log(`[styling] customized keys (differ from defaults): ${custom.length}`);
    print("styling.customized", aggregateItems(custom.map((k) => ({ [k]: srcStyling[k] }))), custom.length);
  }

  // Entity collections
  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  const factories: Record<string, () => object> = {
    rows: () => createDefaultRow(app as never, 0),
    "backpack rows": () => createDefaultRow(app as never, 0),
    choices: () => createDefaultChoice(app as never, 0),
    addons: () => createDefaultAddon(app as never),
    pointTypes: () => createDefaultPointType(app as never),
    groups: () => createDefaultGroup(),
    globalRequirements: () => createDefaultGlobalRequirement(),
    variables: () => createDefaultVariable(),
    words: () => createDefaultWord(),
    soundEffects: () => createDefaultSoundEffect(),
  };
  const collections: [string, unknown[]][] = [
    ["rows", arr(raw.rows)],
    ["backpack rows", arr(raw.backpack)],
    ["choices", arr(raw.rows).flatMap((r) => arr((r as Record<string, unknown>).objects))],
    ["addons", arr(raw.rows).flatMap((r) => arr((r as Record<string, unknown>).objects).flatMap((o) => arr((o as Record<string, unknown>).addons)))],
    ["pointTypes", arr(raw.pointTypes)],
    ["groups", arr(raw.groups)],
    ["globalRequirements", arr(raw.globalRequirements)],
    ["variables", arr(raw.variables)],
    ["words", arr(raw.words)],
    ["soundEffects", arr(raw.soundEffects)],
    ["rowDesignGroups", arr(raw.rowDesignGroups)],
    ["objectDesignGroups", arr(raw.objectDesignGroups)],
  ];
  for (const [label, items] of collections) {
    console.log(`\n${label}: ${items.length} items`);
    const agg = aggregateItems(items);
    const factory = factories[label];
    if (factory) {
      const defKeys = new Set(Object.keys(factory()));
      const unknown = Object.keys(agg).filter((k) => !defKeys.has(k) && k !== "styling");
      console.log(`  keys not in default ${label}: ${unknown.length ? unknown.join(", ") : "none"}`);
    }
    print(label, agg, items.length);
  }

  // Id / reference integrity: rows and choices ids, group element targets
  const rows = raw.rows as Record<string, unknown>[];
  const rowIds = new Set(rows.map((r) => r.id));
  const choiceIds = new Set(
    rows.flatMap((r) => ((r.objects as Record<string, unknown>[]) ?? []).map((o) => o.id)),
  );
  const danglingChoices = rows
    .flatMap((r) => ((r.objects as Record<string, unknown>[]) ?? []).filter((o) => !o.id))
    .length;
  const danglingRows = rows.filter((r) => !r.id).length;
  console.log(`\n[id integrity] rows without id: ${danglingRows}, choices without id: ${danglingChoices}`);
  console.log(`[id integrity] unique row ids: ${rowIds.size}, unique choice ids: ${choiceIds.size}`);

  return { ok: true };
}
