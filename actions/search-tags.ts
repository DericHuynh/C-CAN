import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { searchTagCatalog } from "../server/tags/repository.js";
export default defineAction({
  description:
    "Autocomplete canonical e621 tags from the shared public catalog. Returns names, categories and post counts; caches upstream results for a day and falls back to stored suggestions during outages. Never searches private project tags.",
  schema: z.object({
    query: z.string().max(128).default(""),
    limit: z.coerce.number().int().min(1).max(40).default(20),
  }),
  http: { method: "GET" },
  readOnly: true,
  requiresAuth: false,
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  run: ({ query, limit }) => searchTagCatalog(query, limit),
});
