// Run through the app test toolchain to resolve the locale TypeScript imports.
import { it } from "vite-plus/test";
import { readdir } from "node:fs/promises";
import enUS from "../app/i18n/en-US.ts";

function flatten(value: Record<string, unknown>, prefix = "", result: Record<string, string> = {}) {
  for (const [key, item] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof item === "string") result[path] = item;
    else if (item && typeof item === "object")
      flatten(item as Record<string, unknown>, path, result);
    else throw new Error(`Invalid message at ${path}`);
  }
  return result;
}
it("keeps locale keys and interpolation parameters aligned", async () => {
  const source = flatten(enUS);
  const placeholders = (text: string) =>
    [...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)]
      .map((match) => match[1])
      .sort()
      .join(",");
  let checked = 0;
  const failures: string[] = [];
  for (const filename of await readdir(new URL("../app/i18n/", import.meta.url))) {
    if (!/^[a-z]{2}-[A-Z]{2}\.ts$/.test(filename)) continue;
    const messages = flatten(
      (await import(new URL(`../app/i18n/${filename}`, import.meta.url))).default,
    );
    for (const key of new Set([...Object.keys(source), ...Object.keys(messages)])) {
      // CLDR plural categories legitimately differ between locales.
      if (/_(zero|one|two|few|many|other)$/.test(key)) continue;
      if (!(key in messages) || !(key in source))
        failures.push(`${filename}: unmatched key ${key}`);
      else if (placeholders(source[key]) !== placeholders(messages[key]))
        failures.push(`${filename}: mismatched placeholders in ${key}`);
    }
    checked++;
  }
  if (failures.length) throw new Error(failures.join("\n"));
  console.log(
    `Locale catalogs checked: ${checked}; source messages: ${Object.keys(source).length}`,
  );
});
