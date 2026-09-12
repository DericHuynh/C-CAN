import { normalizeTagList } from "../shared/tags.js";
import { projectEntities, resolveEntity } from "../shared/project-workflow.js";
import { projectAudit } from "../server/projects/audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { createDefaultImageResource } from "../shared/cyoa.js";
import { externalizeAppImages } from "../server/media/blob-images.js";
import { generateImagePreview } from "../server/media/image-previews.js";
import { getProjectOrThrow, saveProject } from "../server/projects/repository.js";

export default defineAction({
  audit: projectAudit,
  description:
    'Add a new image resource to a project (default name "Image"). Choices/rows/addons reference image resources by id. Data-URL payloads are moved to blob storage (the document keeps a URL reference). Optional attribution fields (description, tags, source) are stored on the resource; use add-image-from-source to import from e621/Derpibooru with attribution filled automatically.',
  schema: z.object({
    projectId: z.string().describe("Project id"),
    target: z
      .object({
        kind: z.enum(["row", "choice", "addon"]),
        id: z.string(),
        expectedImage: z.string().optional(),
      })
      .optional()
      .describe("Optionally attach the new image to an existing entity in the same save."),
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
  run: async (
    { projectId, name, image, sourceTooltip, description, tags, source, target },
    ctx,
  ) => {
    const initial = await getProjectOrThrow(projectId, ctx, "editor");
    const checkTarget = (app: typeof initial.app) => {
      if (!target) return;
      const entity = resolveEntity(projectEntities(app), target.id, target.kind).entity;
      if (target.expectedImage !== undefined && (entity.image ?? "") !== target.expectedImage)
        throw new Error("The target image changed. Reload before creating and selecting an image.");
      return entity;
    };
    checkTarget(initial.app);
    // Externalize inline payloads before persisting the resource.
    const resource = createDefaultImageResource(name ?? "Image");
    resource.createdAt = resource.updatedAt = new Date().toISOString();
    resource.anonymous = !name?.trim();
    resource.image = image;
    if (sourceTooltip) resource.sourceTooltip = sourceTooltip;
    if (description && description.trim()) resource.description = description.trim();
    if (Array.isArray(tags) && tags.length > 0) resource.tags = normalizeTagList(tags);
    if (source) resource.source = source;
    resource.imageIsURL = !image.startsWith("data:");
    await externalizeAppImages({ images: [resource] });
    if (!/^data:/i.test(image)) await generateImagePreview(resource);
    const { app, row: storedProject } = await getProjectOrThrow(projectId, ctx, "editor");
    const entity = checkTarget(app);
    app.images.push(resource);
    if (entity) entity.image = resource.id;
    await saveProject(projectId, app, storedProject.json);
    return { image: resource };
  },
});
