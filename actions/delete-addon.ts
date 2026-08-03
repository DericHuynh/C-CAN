import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound, getProjectOrThrow, saveProject } from "./_project-store.js";

export default defineAction({
  description:
    "Remove an addon (by its array index) from a choice and save the updated choice.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    choiceId: z.string().describe("Choice holding the addon"),
    addonIndex: z.number().int().min(0).describe("0-based position of the addon in the choice's addons array"),
  }),
  run: async ({ projectId, choiceId, addonIndex }) => {
    const { app } = await getProjectOrThrow(projectId);
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
    await saveProject(projectId, app);
    return { ok: true };
  },
});
