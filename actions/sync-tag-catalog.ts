import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { syncTagCatalog } from "../server/tags/repository.js";
export default defineAction({
  description:
    "Import up to 320 tags directly from e621 into the shared public tag repository. Pass nextCursor as afterId to continue; null means complete. Fetches provider metadata only and cannot insert arbitrary or private tags.",
  schema: z.object({ afterId: z.number().int().nonnegative().default(0) }),
  run: ({ afterId }) => syncTagCatalog(afterId),
});
