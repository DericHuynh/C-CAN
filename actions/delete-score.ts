import { projectAudit } from "../server/projects/audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertFound } from "../shared/assert.js";
import { getProjectOrThrow, saveProject } from "../server/projects/repository.js";

export default defineAction({
  audit: projectAudit,
  description: "Remove a score from a choice, matched by the score's id.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    rowId: z.string().describe("Row id"),
    choiceId: z.string().describe("Choice id"),
    scoreId: z.string().describe("Score id (the point type id it was created for)"),
  }),
  run: async ({ projectId, rowId, choiceId, scoreId }, ctx) => {
    const { app, row: storedProject } = await getProjectOrThrow(projectId, ctx, "editor");
    const row = app.rows.find((r) => r.id === rowId);
    assertFound(row, `Row "${rowId}" not found in project "${projectId}"`);
    const choice = row.objects.find((c) => c.id === choiceId);
    assertFound(choice, `Choice "${choiceId}" not found in row "${rowId}"`);
    const index = choice.scores.findIndex((s) => s.id === scoreId);
    assertFound(index !== -1, `Score "${scoreId}" not found in choice "${choiceId}"`);
    choice.scores.splice(index, 1);
    await saveProject(projectId, app, storedProject.json);
    return { ok: true };
  },
});
