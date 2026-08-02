import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getProjectOrThrow } from "./_project-store.js";

export default defineAction({
  description:
    "Export a project's CYOA document as a parsed JSON object (ready to download or copy).",
  schema: z.object({
    id: z.string().describe("Project id"),
  }),
  http: { method: "GET" },
  run: async ({ id }) => {
    const { app } = await getProjectOrThrow(id);
    return { json: app };
  },
});
