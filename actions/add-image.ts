import { projectAudit } from "./_project-audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { createDefaultImageResource } from "../shared/cyoa.js";
import { externalizeAppImages } from "./_blob-images.js";
import { generateImagePreview } from "./_image-previews.js";
import { getProjectOrThrow, saveProject } from "./_project-store.js";

export default defineAction({
  audit: projectAudit,
  description:
    'Add a new image resource to a project (default name "Image"). Choices/rows/addons reference image resources by id. Data-URL payloads are moved to blob storage (the document keeps a URL reference). Optional attribution fields (description, tags, source) are stored on the resource; use add-image-from-source to import from e621/Derpibooru with attribution filled automatically.',
  schema: z.object({
    projectId: z.string().describe("Project id"),
    name: z.string().optional().describe('Resource name; defaults to "Image"'),
    image: z.string().describe("Inline data URL or remote URL for the image"),
    sourceTooltip: z
      .string()
      .optional()
      .describe("Optional short attribution shown under the resource"),
    description: z
      .string()
      .optional()
      .describe("Optional longer description (e.g. the original post description)"),
    tags: z
      .array(z.string())
      .optional()
      .describe("Optional search tags copied from the source site"),
    source: z
      .string()
      .optional()
      .describe("Optional attribution URL (original source or site post page)"),
  }),
  run: async ({ projectId, name, image, sourceTooltip, description, tags, source }, ctx) => {
    await getProjectOrThrow(projectId);
    // Externalize inline payloads before persisting the resource.
    const resource = createDefaultImageResource(name ?? "Image");
    resource.image = image;
    if (sourceTooltip) resource.sourceTooltip = sourceTooltip;
    if (description && description.trim()) resource.description = description.trim();
    if (Array.isArray(tags) && tags.length > 0)
      resource.tags = tags.filter((t) => typeof t === "string");
    if (source) resource.source = source;
    resource.imageIsURL = !image.startsWith("data:");
    await externalizeAppImages({ images: [resource] });
    if (!/^data:/i.test(image)) await generateImagePreview(resource);
    const { app } = await getProjectOrThrow(projectId);
    app.images.push(resource);
    await saveProject(projectId, app);
    return { image: resource };
  },
});
