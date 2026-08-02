/**
 * Round-trip fidelity check for ICCPlus project.json imports.
 *
 * Reads the (large) example project, runs it through normalizeApp (the same
 * path the `import-project-json` action uses), re-serializes it, and verifies
 * that no document data is lost or mutated in unexpected ways.
 *
 * Usage: pnpm script roundtrip-check [path-to-project.json]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createDefaultApp, normalizeApp } from "../shared/cyoa.js";

export default async function roundtripCheck(args: Record<string, unknown>) {
  const file = (args.file as string) ?? "examples/project.json";
  const raw = readFileSync(resolve(file), "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  const beforeKeys = new Set(Object.keys(parsed));
  const app = normalizeApp(parsed);
  const out = JSON.stringify(app);
  const after = JSON.parse(out) as Record<string, unknown>;

  console.log(`file: ${file}`);
  console.log(`input bytes: ${raw.length}`);
  console.log(`output bytes: ${out.length}`);

  // 1. Every original top-level key must survive (format is forward-compatible).
  const lostKeys = [...beforeKeys].filter((k) => !(k in after));
  console.log(`\n[top-level] lost keys: ${lostKeys.length ? lostKeys.join(", ") : "none"}`);

  // 2. Arrays must keep their lengths (rows/choices/scores/addons/…).
  function counts(obj: unknown, prefix = ""): Record<string, number> {
    const out: Record<string, number> = {};
    if (Array.isArray(obj)) {
      out[`${prefix}.length`] = obj.length;
      for (const item of obj) Object.assign(out, counts(item, `${prefix}[]`));
    } else if (obj && typeof obj === "object") {
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        Object.assign(out, counts(v, prefix ? `${prefix}.${k}` : k));
      }
    }
    return out;
  }
  const beforeCounts = counts(parsed);
  const afterCounts = counts(after);
  const diffs = Object.keys(beforeCounts).filter(
    (k) => beforeCounts[k] !== afterCounts[k] && !k.endsWith("[]"),
  );
  console.log(`\n[array lengths] mismatches:`);
  if (!diffs.length) console.log("  none");
  for (const d of diffs) {
    console.log(`  ${d}: ${beforeCounts[d]} -> ${afterCounts[d]}`);
  }

  // 3. The exported document must be a *superset* of the input at every path —
  //    deep-merge only ever adds default keys, never drops or rewrites values.
  let mutations = 0;
  function diffTree(before: unknown, afterVal: unknown, path: string) {
    if (typeof before !== typeof afterVal) {
      if (before === null) return;
      if (typeof before === "number" && typeof afterVal === "number") return;
      if (typeof before === "boolean" && typeof afterVal === "boolean") return;
      mutations++;
      console.log(`  [type change] ${path}: ${typeof before} -> ${typeof afterVal}`);
      return;
    }
    if (Array.isArray(before) && Array.isArray(afterVal)) {
      if (before.length !== afterVal.length) return;
      for (let i = 0; i < before.length; i++) diffTree(before[i], afterVal[i], `${path}[${i}]`);
      return;
    }
    if (before && typeof before === "object" && afterVal && typeof afterVal === "object") {
      for (const [k, v] of Object.entries(before as Record<string, unknown>)) {
        if (!(k in (afterVal as Record<string, unknown>))) {
          mutations++;
          console.log(`  [missing key] ${path}.${k}`);
        } else {
          diffTree(v, (afterVal as Record<string, unknown>)[k], `${path}.${k}`);
        }
      }
      return;
    }
    if (before !== afterVal) {
      mutations++;
      const a = JSON.stringify(afterVal);
      console.log(`  [value change] ${path}: ${JSON.stringify(before)} -> ${a.slice(0, 120)}`);
    }
  }
  diffTree(parsed, after, "$");
  console.log(`\n[value mutations] total: ${mutations}`);

  // 4. Normalized doc must include every default key at top level.
  const defaults = createDefaultApp();
  const missingDefaults = Object.keys(defaults).filter((k) => !(k in after));
  console.log(
    `\n[defaults] missing default keys after normalize: ${
      missingDefaults.length ? missingDefaults.join(", ") : "none"
    }`,
  );

  const ok = mutations === 0 && !lostKeys.length && !diffs.length;
  console.log(`\nresult: ${ok ? "PASS" : "CHECK"}`);
  return { ok, lostKeys, diffs, mutations };
}
