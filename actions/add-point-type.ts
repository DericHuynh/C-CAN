import { projectAudit } from "./_project-audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { createDefaultPointType } from "../shared/cyoa.js";
import { getProjectOrThrow, saveProject } from "./_project-store.js";

export default defineAction({
  audit: projectAudit,
  description:
    'Add a new point type to a project (default name "Points") and return it. Optional startingSum/beforeText/afterText override the defaults.',
  schema: z.object({
    projectId: z.string().describe("Project id"),
    name: z.string().optional().describe('Point type name; defaults to "Points"'),
    startingSum: z.number().optional().describe("Initial point total"),
    beforeText: z.string().optional().describe("Label shown before the value"),
    afterText: z.string().optional().describe("Label shown after the value"),
  }),
  run: async ({ projectId, name, startingSum, beforeText, afterText }) => {
    const { app } = await getProjectOrThrow(projectId);
    const pointType = createDefaultPointType(app, name ?? "Points");
    if (startingSum !== undefined) pointType.startingSum = startingSum;
    if (beforeText !== undefined) pointType.beforeText = beforeText;
    if (afterText !== undefined) pointType.afterText = afterText;
    app.pointTypes.push(pointType);
    await saveProject(projectId, app);
    return { pointType };
  },
});
