import { editBaseSchema, mergeProjectPatch } from "../server/projects/collaboration.js";
import { normalizeTagList } from "../shared/tags.js";
import { projectAudit } from "../server/projects/audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { generateImagePreview } from "../server/media/image-previews.js";
import { getImagePreview } from "../shared/image-preview.js";

import { assertFound } from "../shared/assert.js";
import { getProjectOrThrow, saveProject } from "../server/projects/repository.js";

export default defineAction({
  audit: projectAudit,
  description:
    "Shallow-merge a patch into an image resource's fields (id is preserved). Returns the updated resource.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    imageId: z.string().describe("Image resource id"),
    base: editBaseSchema,
    patch: z.record(z.string(), z.unknown()).describe("Fields to merge into the image resource"),
  }),
  run: async ({ projectId, imageId, patch, base }, ctx) => {
    const { app } = await getProjectOrThrow(projectId, ctx, "editor");
    const image = app.images.find((img) => img.id === imageId);
    assertFound(image, `Image "${imageId}" not found in project "${projectId}"`);
    patch = mergeProjectPatch(image, patch, base);
    const merged = { ...image, ...patch, id: image.id };
    if (typeof merged.image === "string") {
      merged.imageIsURL = !merged.image.startsWith("data:");
    }
    if (merged.image !== image.image) {
      delete merged.preview;
      await generateImagePreview(merged);
    } else if (!getImagePreview(merged)) {
      delete merged.preview;
    }
    // Preserve edits made while the remote image was downloading.
    const latest = await getProjectOrThrow(projectId, ctx, "editor");
    const index = latest.app.images.findIndex((entry) => entry.id === imageId);
    assertFound(index >= 0, `Image "${imageId}" no longer exists`);
    assertFound(
      latest.app.images[index].image === image.image,
      "Image changed while its preview was generated. Please retry.",
    );
    patch = mergeProjectPatch(latest.app.images[index], patch, image);
    const updated = {
      ...latest.app.images[index],
      ...patch,
      id: image.id,
      ...(Array.isArray(patch.tags)
        ? {
            tags: normalizeTagList(
              patch.tags.filter((tag): tag is string => typeof tag === "string"),
            ),
          }
        : {}),
      updatedAt: new Date().toISOString(),
      preview: merged.preview,
      imageIsURL: merged.imageIsURL,
    };
    latest.app.images[index] = updated;
    await saveProject(projectId, latest.app, latest.row.json);
    return { image: updated };
  },
});
