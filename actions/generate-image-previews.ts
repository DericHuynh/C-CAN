import { projectAudit } from "../server/projects/audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { hasCurrentImagePreview } from "../shared/image-preview.js";
import { generateImagePreview } from "../server/media/image-previews.js";
import { getProjectOrThrow, saveProject } from "../server/projects/repository.js";

export default defineAction({
  audit: projectAudit,
  description:
    "Generate or upgrade embedded viewer previews (up to 8 KiB each, original layout dimensions) for up to 8 existing image resources. Full images remain external. Returns generated, skipped and failed ids; retry failed ids after correcting inaccessible URLs.",
  schema: z.object({
    projectId: z.string(),
    imageIds: z.array(z.string()).min(1).max(8),
  }),
  run: async ({ projectId, imageIds }, ctx) => {
    const { app } = await getProjectOrThrow(projectId, ctx, "editor");
    const ids = new Set(imageIds);
    const images = app.images.filter((image) => ids.has(image.id));
    const skipped = images
      .filter((image) => hasCurrentImagePreview(image))
      .map((image) => image.id);
    const pending = images.filter((image) => !hasCurrentImagePreview(image));
    // Two downloads at a time, even when the caller requests a whole batch.
    for (let i = 0; i < pending.length; i += 2) {
      await Promise.all(pending.slice(i, i + 2).map(generateImagePreview));
    }
    // Downloading can take seconds: merge only previews into the latest document.
    const { app: latest, row: storedProject } = await getProjectOrThrow(projectId, ctx, "editor");
    const generated: string[] = [];
    for (const image of pending) {
      const target = latest.images.find((entry) => entry.id === image.id);
      if (hasCurrentImagePreview(image) && target && target.image === image.image) {
        target.preview = image.preview;
        generated.push(image.id);
      }
    }
    if (generated.length) await saveProject(projectId, latest, storedProject.json);
    return {
      generated,
      skipped,
      failed: [...ids].filter((id) => !generated.includes(id) && !skipped.includes(id)),
    };
  },
});
