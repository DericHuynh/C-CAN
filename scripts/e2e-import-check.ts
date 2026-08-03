/**
 * End-to-end interchange check: imports the real (17 MB) ICCPlus example
 * project through the actual `import-project-json` action (DB-backed), then
 * exports it back through `export-project-json` and verifies no data was lost.
 *
 * Usage: pnpm script e2e-import-check [path-to-project.json]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export default async function e2eImportCheck(args: Record<string, unknown>) {
  const file = (args.file as string) ?? "examples/project.json";
  const raw = readFileSync(resolve(file), "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  const { default: importAction } = await import("../actions/import-project-json.js");
  const { default: exportAction } = await import("../actions/export-project-json.js");
  const { default: listProjects } = await import("../actions/list-projects.js");

  console.log(`importing ${file} (${(raw.length / 1024 / 1024).toFixed(1)} MB)...`);
  const created = await importAction.run({ title: "e2e-import-check", json: parsed });
  console.log(
    `created project ${created.id}: ${created.summary.rowCount} rows, ${created.summary.choiceCount} choices`,
  );

  const exported = await exportAction.run({ id: created.id });
  const out = JSON.parse(JSON.stringify(exported.json)) as Record<string, unknown>;

  // ACL image-resource translation: every legacy inline image on choices,
  // rows and addons must have been rewritten to an image-resource id, and the
  // `images` collection must hold the same payloads.
  const images = Array.isArray(out.images) ? (out.images as Array<Record<string, unknown>>) : [];
  const imageIds = new Set(images.map((img) => img.id));
  let inlineImages = 0;
  let danglingRefs = 0;
  const walkRefs = (ref: unknown): void => {
    if (typeof ref === "string" && ref !== "" && !imageIds.has(ref)) inlineImages++;
  };
  const rows = Array.isArray(out.rows) ? (out.rows as Array<Record<string, unknown>>) : [];
  const backpack = Array.isArray(out.backpack)
    ? (out.backpack as Array<Record<string, unknown>>)
    : [];
  for (const row of [...rows, ...backpack]) {
    walkRefs(row.image);
    for (const choice of Array.isArray(row.objects)
      ? (row.objects as Array<Record<string, unknown>>)
      : []) {
      walkRefs(choice.image);
      if (typeof choice.image === "string" && choice.image !== "" && !imageIds.has(choice.image))
        danglingRefs++;
      for (const addon of Array.isArray(choice.addons)
        ? (choice.addons as Array<Record<string, unknown>>)
        : []) {
        walkRefs(addon.image);
      }
    }
  }
  console.log(
    `[acl images] resources: ${images.length}, inline refs remaining: ${inlineImages}, dangling refs: ${danglingRefs}`,
  );
  // Styling background images (design tab) must be resource ids too.
  const styling = (out.styling ?? {}) as Record<string, unknown>;
  const stylingBgKeys = [
    "backgroundImage",
    "rowBackgroundImage",
    "objectBackgroundImage",
    "addonBackgroundImage",
    "backpackBgImage",
  ];
  const stylingRefs = stylingBgKeys.filter(
    (k) => typeof styling[k] === "string" && styling[k] !== "",
  );
  const stylingInline = stylingRefs.filter((k) => !imageIds.has(String(styling[k]))).length;
  console.log(
    `[acl styling] background keys with values: ${stylingRefs.length}, inline refs remaining: ${stylingInline}`,
  );
  const aclOk =
    images.length > 0 && inlineImages === 0 && danglingRefs === 0 && stylingInline === 0;

  function walk(obj: unknown, fn: (path: string, value: unknown) => void, path = "$"): void {
    if (Array.isArray(obj)) {
      fn(`${path}.length`, obj.length);
      for (let i = 0; i < obj.length; i++) walk(obj[i], fn, `${path}[${i}]`);
    } else if (obj && typeof obj === "object") {
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        walk(v, fn, path ? `${path}.${k}` : k);
      }
    } else {
      fn(path, obj);
    }
  }

  let mismatches = 0;
  const beforeCounts: Array<[string, unknown]> = [];
  walk(parsed, (p, v) => {
    if (p.endsWith(".length")) beforeCounts.push([p, v]);
  });
  const afterSet = new Map<string, unknown>();
  walk(out, (p, v) => {
    if (p.endsWith(".length")) afterSet.set(p, v);
  });
  for (const [p, v] of beforeCounts) {
    if (afterSet.get(p) !== v) {
      mismatches++;
      console.log(`  [count mismatch] ${p}: ${v} -> ${afterSet.get(p)}`);
    }
  }

  const beforeIds = new Set<string>();
  walk(parsed, (p, v) => {
    if (/\.id$/.test(p) && typeof v === "string") beforeIds.add(`${p}=${v}`);
  });
  const afterIds = new Set<string>();
  walk(out, (p, v) => {
    if (/\.id$/.test(p) && typeof v === "string") afterIds.add(`${p}=${v}`);
  });
  const lostIds = [...beforeIds].filter((id) => !afterIds.has(id));
  if (lostIds.length) {
    mismatches += lostIds.length;
    console.log(`  [lost ids] ${lostIds.slice(0, 10).join(", ")}`);
  }

  const afterList = await listProjects.run({});
  const listed = afterList.projects ?? afterList;
  const listedOk = JSON.stringify(listed).includes(created.id);

  // Clean up the throwaway project.
  const { default: deleteAction } = await import("../actions/delete-project.js");
  try {
    await deleteAction.run({ id: created.id });
  } catch {
    // the project may already be gone — non-fatal
  }

  const ok = mismatches === 0 && lostIds.length === 0 && listedOk;
  console.log(`\nproject appears in list-projects: ${listedOk}`);
  console.log(
    `\nresult: ${ok && aclOk ? "PASS" : `FAIL (${mismatches} mismatches${aclOk ? "" : ", acl"})`}`,
  );
  return { ok: ok && aclOk, mismatches, lostIds: lostIds.length, listedOk, aclOk };
}
