import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound, getProjectOrThrow, saveProject } from "./_project-store.js";

export default defineAction({
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
    app.images[app.images.indexOf(image)] = merged;
    await saveProject(projectId, app);
    return { image: merged };
  },
});
