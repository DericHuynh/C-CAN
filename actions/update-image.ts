import { projectAudit } from "./_project-audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { generateImagePreview } from "./_image-previews.js";
import { getImagePreview } from "../shared/image-preview.js";

import { assertFound, getProjectOrThrow, saveProject } from "./_project-store.js";

export default defineAction({
  audit: projectAudit,
  description:
    "Shallow-merge a patch into an image resource's fields (id is preserved). Returns the updated resource.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    imageId: z.string().describe("Image resource id"),
    patch: z.record(z.string(), z.unknown()).describe("Fields to merge into the image resource"),
  }),
  run: async ({ projectId, imageId, patch }) => {
    const { app } = await getProjectOrThrow(projectId);
    const image = app.images.find((img) => img.id === imageId);
    assertFound(image, `Image "${imageId}" not found in project "${projectId}"`);
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
    const latest = await getProjectOrThrow(projectId);
    const index = latest.app.images.findIndex((entry) => entry.id === imageId);
    assertFound(index >= 0, `Image "${imageId}" no longer exists`);
    assertFound(
      latest.app.images[index].image === image.image,
      "Image changed while its preview was generated. Please retry.",
    );
    const updated = {
      ...latest.app.images[index],
      ...patch,
      id: image.id,
      preview: merged.preview,
      imageIsURL: merged.imageIsURL,
    };
    latest.app.images[index] = updated;
    await saveProject(projectId, latest.app);
    return { image: updated };
  },
});
