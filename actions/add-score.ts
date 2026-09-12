import { projectAudit } from "../server/projects/audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { createDefaultScore } from "../shared/cyoa.js";
import { assertFound } from "../shared/assert.js";
import { getProjectOrThrow, saveProject } from "../server/projects/repository.js";

export default defineAction({
  audit: projectAudit,
  description:
    "Attach a score for a point type to a choice (default value 1). Returns the created score.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    rowId: z.string().describe("Row id"),
    choiceId: z.string().describe("Choice id"),
    pointTypeId: z.string().describe("Point type id to score against"),
    value: z.number().optional().describe("Score value; defaults to 1"),
  }),
  run: async ({ projectId, rowId, choiceId, pointTypeId, value }, ctx) => {
    const { app, row: storedProject } = await getProjectOrThrow(projectId, ctx, "editor");
    const pointType = app.pointTypes.find((p) => p.id === pointTypeId);
    assertFound(pointType, `Point type "${pointTypeId}" not found in project "${projectId}"`);
    const row = app.rows.find((r) => r.id === rowId);
    assertFound(row, `Row "${rowId}" not found in project "${projectId}"`);
    const choice = row.objects.find((c) => c.id === choiceId);
    assertFound(choice, `Choice "${choiceId}" not found in row "${rowId}"`);
    const score = createDefaultScore(pointTypeId, value ?? 1);
    choice.scores.push(score);
    await saveProject(projectId, app, storedProject.json);
    return { score };
  },
});
