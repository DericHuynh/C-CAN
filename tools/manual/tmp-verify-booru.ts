/** Dev helper: verify add-image-from-source attribution landed in the doc. */
import { getProjectOrThrow } from "../../server/projects/repository.js";

const PID = process.argv[2] ?? "af8f4b8d-b881-4534-b845-d68314ebc80d";
const { app } = await getProjectOrThrow(PID);
const interesting = app.images.filter((img) => img.tags?.length || img.source || img.description);
console.log(`total images: ${app.images.length}, with attribution: ${interesting.length}`);
for (const img of interesting.slice(-4)) {
  console.log("---");
  console.log("name:", img.name);
  console.log("image:", String(img.image).slice(0, 70));
  console.log("imageIsURL:", img.imageIsURL);
  console.log("sourceTooltip:", img.sourceTooltip);
  console.log("source:", img.source);
  console.log("description:", String(img.description ?? "").slice(0, 60));
  console.log("tags:", (img.tags ?? []).slice(0, 6).join(", "), `(${img.tags?.length ?? 0})`);
}
