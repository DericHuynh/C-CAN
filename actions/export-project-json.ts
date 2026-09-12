import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getProjectOrThrow } from "../server/projects/repository.js";

export default defineAction({
  description:
    "Export a project's CYOA document as a parsed JSON object (ready to download or copy). Images live in blob storage and export as URL references (imageIsURL: true) — exports retain C-CAN image resource IDs for reimport here, and are not promised to reopen in the original ICCPlus editor.",
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
