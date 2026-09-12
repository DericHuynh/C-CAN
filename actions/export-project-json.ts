import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getProjectOrThrow } from "./_project-store.js";

export default defineAction({
  description:
    "Export a project's CYOA document as a parsed JSON object (ready to download or copy). Images live in blob storage and export as URL references (imageIsURL: true) — the document stays compatible with the original ICCPlus editor, which renders remote image URLs natively.",
  schema: z.object({
    id: z.string().describe("Project id"),
  }),
  http: { method: "GET" },
  readOnly: true,
  // Authenticated read exposure for external MCP/A2A hosts.
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  run: async ({ id }, ctx) => {
    const { app } = await getProjectOrThrow(id, ctx, "viewer");
    return { json: app };
  },
});
