import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { publicationStatus } from "../server/publishing/repository.js";
export default defineAction({
  description:
    "Read an accessible project's publishing controls and saved release metadata. Only its owner receives publishing controls.",
  schema: z.object({ projectId: z.string().min(1) }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ projectId }, ctx) => publicationStatus(projectId, ctx),
});
