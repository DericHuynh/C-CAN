import { executeProjectBuild } from "../server/projects/workflow.js";
import { projectAudit } from "../server/projects/audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound } from "../shared/assert.js";
import { getProjectOrThrow, saveProject } from "../server/projects/repository.js";

export default defineAction({
  audit: projectAudit,
  description:
    "Remove an addon by stable addonId with dependency validation. Legacy choiceId/addonIndex is accepted for existing editor clients.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    addonId: z.string().optional(),
    expectedRevision: z.string().optional(),
    choiceId: z.string().optional().describe("Choice holding the addon"),
    addonIndex: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("0-based position of the addon in the choice's addons array"),
  }),
  run: async ({ projectId, choiceId, addonIndex, addonId, expectedRevision }, ctx) => {
    if (addonId) {
      if (choiceId !== undefined || addonIndex !== undefined)
        throw new Error("Use addonId alone, or the legacy choiceId/addonIndex pair.");
      return executeProjectBuild(
        { projectId, expectedRevision, operations: [{ op: "delete", kind: "addon", id: addonId }] },
        ctx,
      );
    }
    if (!choiceId || addonIndex === undefined)
      throw new Error("Supply addonId or choiceId and addonIndex.");
    if (expectedRevision) throw new Error("Use addonId with expectedRevision.");
    const { app, row: storedProject } = await getProjectOrThrow(projectId, ctx, "editor");
    let choice: { addons?: unknown[] } | undefined;
    for (const row of app.rows ?? []) {
      const found = row.objects.find((c) => c.id === choiceId);
      if (found) {
        choice = found;
        break;
      }
    }
    assertFound(choice, `Choice "${choiceId}" not found in project "${projectId}"`);
    const addons = choice.addons ?? [];
    assertFound(
      addonIndex >= 0 && addonIndex < addons.length,
      `Addon at index ${addonIndex} not found on choice "${choiceId}"`,
    );
    addons.splice(addonIndex, 1);
    choice.addons = addons;
    await saveProject(projectId, app, storedProject.json);
    return { ok: true };
  },
});
