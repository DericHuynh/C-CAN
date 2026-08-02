import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getProjectOrThrow, toProjectDetail } from "./_project-store.js";

export default defineAction({
  description:
    "Get a single CYOA project: metadata, a summary of its contents, and the full parsed (normalized) document as `app`.",
  schema: z.object({
    id: z.string().describe("Project id"),
  }),
  http: { method: "GET" },
  run: async ({ id }) => {
    const { row, app } = await getProjectOrThrow(id);
    return toProjectDetail(row, app);
  },
});
