import { projectAudit } from "./_project-audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { getImagePreview } from "../shared/image-preview.js";
import { generateImagePreview } from "./_image-previews.js";
import { getProjectOrThrow, saveProject } from "./_project-store.js";

export default defineAction({
  audit: projectAudit,
  description:
    "Generate tiny embedded viewer previews for up to 8 existing image resources. Full images remain external. Returns generated, skipped and failed ids; retry failed ids after correcting inaccessible URLs.",
  schema: z.object({
    projectId: z.string(),
    imageIds: z.array(z.string()).min(1).max(8),
  }),
  run: async ({ projectId, imageIds }) => {
    const { app } = await getProjectOrThrow(projectId);
    const ids = new Set(imageIds);
    const images = app.images.filter((image) => ids.has(image.id));
    const skipped = images.filter((image) => getImagePreview(image)).map((image) => image.id);
    const pending = images.filter((image) => !getImagePreview(image));
    // Two downloads at a time, even when the caller requests a whole batch.
    for (let i = 0; i < pending.length; i += 2) {
      await Promise.all(pending.slice(i, i + 2).map(generateImagePreview));
    }
    // Downloading can take seconds: merge only previews into the latest document.
    const { app: latest } = await getProjectOrThrow(projectId);
    const generated: string[] = [];
    for (const image of pending) {
      const target = latest.images.find((entry) => entry.id === image.id);
      if (image.preview && target && target.image === image.image) {
        target.preview = image.preview;
        generated.push(image.id);
      }
    }
    if (generated.length) await saveProject(projectId, latest);
    return {
      generated,
      skipped,
      failed: [...ids].filter((id) => !generated.includes(id) && !skipped.includes(id)),
    };
  },
});
