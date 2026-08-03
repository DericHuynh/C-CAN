import { readFileSync } from "node:fs";

export default async function tmpImportExample() {
  const raw = JSON.parse(readFileSync("examples/project.json", "utf8"));
  const { default: importAction } = await import("../actions/import-project-json.js");
  const created = await importAction.run({ title: "styling-check", json: raw });
  console.log("PROJECT_ID=" + created.id);
  return { id: created.id };
}
