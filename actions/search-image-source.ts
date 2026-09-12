import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { searchBooru, type BooruSite } from "./_booru.js";

export default defineAction({
  description:
    "Search e621 or Derpibooru for images by tag query. Returns usable image candidates with their post id, direct image URL, title, description, tags and source URL — for automatic attribution. Then import a chosen candidate with add-image-from-source (pass the same site + post id) so tags/description/title/source are copied onto the image resource. Tag syntax: space-separated tags plus metatags like rating:safe / rating:questionable / rating:explicit, species:canine, order:random. NSFW content on Derpibooru requires the account's API key in Settings → Secrets.",
  schema: z.object({
    site: z
      .enum(["e621", "derpibooru"])
      .describe("Which image site to search"),
    tags: z
      .string()
      .describe(
        "Space-separated tag query, e.g. 'canine rating:safe' or 'pinkie pie pony order:random'. Supports the site's metatags (rating:, species:, order:, …).",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(25)
      .optional()
      .describe("Max candidates to return (default 10)"),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ site, tags, limit }, ctx) => {
    const candidates = await searchBooru(site as BooruSite, tags, limit ?? 10, ctx?.userEmail);
    return {
      site,
      query: tags.trim(),
      count: candidates.length,
      candidates,
      hint: "Pick a candidate and call add-image-from-source with the same site and its post id to import it with automatic attribution.",
    };
  },
});
