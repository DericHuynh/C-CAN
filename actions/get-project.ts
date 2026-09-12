import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getProjectOrThrow, canEditProject } from "../server/projects/repository.js";
import { toProjectDetail } from "../server/projects/presentation.js";

export default defineAction({
  description:
    "Get a single CYOA project: metadata, a summary of its contents, and the full parsed (normalized) document as `app`.",
  schema: z.object({
    id: z.string().describe("Project id"),
  }),
  http: { method: "GET" },
  readOnly: true,
  // Authenticated read exposure for external MCP/A2A hosts.
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  // Deep link surfaced by MCP/A2A surfaces: "Open in editor →".
  link: ({ args }) => ({
    url: `/projects/${encodeURIComponent(String(args.id ?? ""))}/editor`,
    label: "Open in editor",
    view: "projects",
  }),
  run: async ({ id }, ctx) => {
    const { row, app } = await getProjectOrThrow(id, ctx, "viewer");
    return { ...toProjectDetail(row, app), canEdit: await canEditProject(id, ctx) };
  },
});
