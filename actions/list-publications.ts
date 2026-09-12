import { defineAction } from "@agent-native/core/action";
import { explorerFilters } from "../shared/publications.js";
import { listPublications } from "../server/publishing/repository.js";
export default defineAction({
  description:
    "Discover published ICYOAs with typo-tolerant search, AND include tags, excludeTags that reject any matching tag, SFW/NSFW filtering and rating sorting. SFW by default; metadata only, 24 results per page.",
  schema: explorerFilters,
  http: { method: "GET" },
  readOnly: true,
  requiresAuth: false,
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  link: () => ({ url: "/explorer", label: "Open ICYOA Explorer", view: "explorer" }),
  run: async (args) => listPublications(args),
});
