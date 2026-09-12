import { updateProjectMetadata } from "../server/projects/repository.js";
import { projectAudit } from "../server/projects/audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getProjectOrThrow } from "../server/projects/repository.js";
import { toProjectSummary } from "../server/projects/presentation.js";
import { editBaseSchema, mergeProjectPatch } from "../server/projects/collaboration.js";

export default defineAction({
  audit: projectAudit,
  description:
    "Update a project's metadata only (title/description). The CYOA document itself is left untouched.",
  schema: z.object({
    id: z.string().describe("Project id"),
    base: editBaseSchema,
    title: z.string().optional().describe("New list title"),
    description: z.string().optional().describe("New description"),
  }),
  run: async ({ id, title, description, base }, ctx) => {
    const { app, row } = await getProjectOrThrow(id, ctx, "editor");
    const patch = mergeProjectPatch(
      { ...row, description: row.description ?? "" },
      {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
      },
      base,
    );
    const updated = await updateProjectMetadata(id, patch, row);
    return { ok: true, summary: toProjectSummary(updated, app) };
  },
});
