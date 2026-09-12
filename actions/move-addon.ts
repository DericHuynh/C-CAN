import { projectEntities, resolveEntity } from "../shared/project-workflow.js";
import { projectRevision } from "../server/projects/revision.js";
import { projectAudit } from "../server/projects/audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound } from "../shared/assert.js";
import { getProjectOrThrow, saveProject } from "../server/projects/repository.js";

export default defineAction({
  audit: projectAudit,
  description:
    "Move an addon by stable addonId (legacy sourceChoiceId/addonIndex also accepted) from one choice to another, or reorder it within the same choice. The addon's parentId is rewritten to the target choice id.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    addonId: z.string().optional(),
    expectedRevision: z.string().optional(),
    sourceChoiceId: z.string().optional().describe("Choice currently holding the addon"),
    addonIndex: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("0-based position of the addon in the source choice's addons array"),
    targetChoiceId: z.string().describe("Choice the addon moves to"),
    targetIndex: z
      .number()
      .int()
      .min(0)
      .describe("0-based position in the target choice's addons array (after removal)"),
  }),
  run: async (
    {
      projectId,
      sourceChoiceId,
      addonIndex,
      targetChoiceId,
      targetIndex,
      addonId,
      expectedRevision,
    },
    ctx,
  ) => {
    const { app, row: storedProject } = await getProjectOrThrow(projectId, ctx, "editor");
    if (expectedRevision && projectRevision(storedProject.json) !== expectedRevision)
      throw new Error("Conflict: project changed since inspection.");
    if (addonId) {
      if (sourceChoiceId !== undefined || addonIndex !== undefined)
        throw new Error("Use addonId alone or sourceChoiceId/addonIndex.");
      const entry = resolveEntity(projectEntities(app), addonId, "addon");
      sourceChoiceId = entry.parentId;
      addonIndex = entry.index;
    }
    if (!sourceChoiceId || addonIndex === undefined)
      throw new Error("Supply addonId or sourceChoiceId and addonIndex.");
    const findChoice = (id: string) => {
      for (const row of app.rows ?? []) {
        const choice = row.objects.find((c) => c.id === id);
        if (choice) return choice;
      }
      return undefined;
    };
    const source = findChoice(sourceChoiceId);
    assertFound(source, `Choice "${sourceChoiceId}" not found in project "${projectId}"`);
    const target = findChoice(targetChoiceId);
    assertFound(target, `Choice "${targetChoiceId}" not found in project "${projectId}"`);
    const sourceAddons = source.addons ?? [];
    assertFound(
      addonIndex >= 0 && addonIndex < sourceAddons.length,
      `Addon at index ${addonIndex} not found on choice "${sourceChoiceId}"`,
    );
    const [addon] = sourceAddons.splice(addonIndex, 1);
    const targetAddons = target.addons ?? [];
    const to = Math.min(Math.max(targetIndex, 0), targetAddons.length);
    targetAddons.splice(to, 0, addon);
    addon.parentId = targetChoiceId;
    source.addons = sourceAddons;
    target.addons = targetAddons;
    await saveProject(projectId, app, storedProject.json);
    return { ok: true };
  },
});
