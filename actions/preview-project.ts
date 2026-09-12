import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { previewOptionsSchema, previewProject } from "../server/viewer/preview.js";
export default defineAction({
  description:
    "Open a project viewer, resolve row/choice/addon parents, wait for the latest saved revision, and capture the rendered viewport with DOM QA. Works from chat. Optional buildCode opens an isolated test state. Reports exact pending/unavailable reasons; never treats a navigation request as a screenshot. Resume pending pixels with capture-viewer.",
  schema: previewOptionsSchema.extend({ projectId: z.string() }),
  run: previewProject,
});
