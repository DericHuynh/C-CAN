import { projectAudit } from "./_project-audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound, getProjectOrThrow, saveProject } from "./_project-store.js";

export default defineAction({
  audit: projectAudit,
  description:
    "Delete a point type and remove every score that referenced it across all rows, keeping the document consistent.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    pointTypeId: z.string().describe("Point type id"),
  }),
  run: async ({ projectId, pointTypeId }) => {
    const { app } = await getProjectOrThrow(projectId);
    const index = app.pointTypes.findIndex((p) => p.id === pointTypeId);
    assertFound(index !== -1, `Point type "${pointTypeId}" not found in project "${projectId}"`);
    app.pointTypes.splice(index, 1);
    for (const row of [...app.rows, ...(app.backpack ?? [])]) {
      for (const choice of row.objects ?? []) {
        choice.scores = (choice.scores ?? []).filter((s) => s.id !== pointTypeId);
        for (const addon of choice.addons ?? []) {
          if (addon.isSelectable) {
            addon.scores = (addon.scores ?? []).filter((s) => s.id !== pointTypeId);
          }
        }
      }
    }
    await saveProject(projectId, app);
    return { ok: true };
  },
});
