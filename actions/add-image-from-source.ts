import { projectAudit } from "./_project-audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { generateImagePreview } from "./_image-previews.js";
import { createDefaultImageResource } from "../shared/cyoa.js";
import { fetchBooruPost, type BooruSite } from "./_booru.js";
import { getProjectOrThrow, saveProject } from "./_project-store.js";

export default defineAction({
  audit: projectAudit,
  description:
    "Import an image from e621 or Derpibooru by post id with automatic attribution: fetches the post, copies its title (as the resource name), description, full tag list, and source URL onto a new image resource, and stores the direct image URL. Find post ids with search-image-source. NSFW content on Derpibooru requires the account's API key in Settings → Secrets.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    site: z.enum(["e621", "derpibooru"]).describe("Which site the post id belongs to"),
    postId: z.string().describe("The post/image id from search-image-source"),
    name: z.string().optional().describe("Override the resource name (defaults to the post title)"),
  }),
  run: async ({ projectId, site, postId, name }, ctx) => {
    await getProjectOrThrow(projectId);
    const post = await fetchBooruPost(site as BooruSite, postId, ctx?.userEmail);

    const resource = createDefaultImageResource(name?.trim() || post.title);
    resource.image = post.url;
    resource.imageIsURL = true;
    resource.sourceTooltip = `${post.site} #${post.id}`;
    if (post.description.trim()) resource.description = post.description.trim();
    if (post.tags.length > 0) resource.tags = post.tags;
    resource.source = post.source || post.pageUrl;

    await generateImagePreview(resource);
    const { app } = await getProjectOrThrow(projectId);
    app.images.push(resource);
    await saveProject(projectId, app);
    return {
      image: resource,
      attribution: {
        site: post.site,
        postId: post.id,
        title: resource.name,
        pageUrl: post.pageUrl,
        description: resource.description ?? "",
        tags: resource.tags ?? [],
        source: resource.source ?? "",
      },
    };
  },
});
