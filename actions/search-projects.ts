import { searchProjectTitles } from "../server/projects/queries.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

export default defineAction({
  description:
    "Search accessible project titles with a bounded metadata-only result, without loading any CYOA documents or images.",
  schema: z.object({
    query: z.string().max(200).default(""),
    limit: z.number().int().min(1).max(50).default(8),
  }),
  readOnly: true,
  run: searchProjectTitles,
});
