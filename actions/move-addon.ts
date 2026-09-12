import { projectAudit } from "./_project-audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound, getProjectOrThrow, saveProject } from "./_project-store.js";

export default defineAction({
  audit: projectAudit,
  description:
    "Move an addon (by its array index) from one choice to another, or reorder it within the same choice. The addon's parentId is rewritten to the target choice id.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    sourceChoiceId: z.string().describe("Choice currently holding the addon"),
    addonIndex: z
      .number()
      .int()
      .min(0)
      .describe("0-based position of the addon in the source choice's addons array"),
    targetChoiceId: z.string().describe("Choice the addon moves to"),
    targetIndex: z
      .number()
      .int()
      .min(0)
      .describe("0-based position in the target choice's addons array (after removal)"),
  }),
  run: async ({ projectId, sourceChoiceId, addonIndex, targetChoiceId, targetIndex }) => {
    const { app } = await getProjectOrThrow(projectId);
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
    await saveProject(projectId, app);
    return { ok: true };
  },
});
