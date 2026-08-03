import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { createDefaultImageResource } from "../shared/cyoa.js";
import { getProjectOrThrow, saveProject } from "./_project-store.js";

export default defineAction({
  description:
    'Add a new image resource to a project (default name "Image"). Choices/rows/addons reference image resources by id.',
  schema: z.object({
    projectId: z.string().describe("Project id"),
    name: z.string().optional().describe('Resource name; defaults to "Image"'),
    image: z.string().describe("Inline data URL or remote URL for the image"),
    sourceTooltip: z.string().optional().describe("Optional source attribution tooltip"),
  }),
  run: async ({ projectId, name, image, sourceTooltip }) => {
    const { app } = await getProjectOrThrow(projectId);
    const resource = createDefaultImageResource(name ?? "Image");
    resource.image = image;
    if (sourceTooltip) resource.sourceTooltip = sourceTooltip;
    resource.imageIsURL = !image.startsWith("data:");
    app.images.push(resource);
    await saveProject(projectId, app);
    return { image: resource };
  },
});
