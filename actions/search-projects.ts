import { defineAction } from "@agent-native/core/action";
import { and, desc, sql } from "@agent-native/core/db/schema";
import { accessFilter } from "@agent-native/core/sharing";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import { projects, projectShares } from "../server/db/schema.js";

export default defineAction({
  description:
    "Search accessible project titles with a bounded metadata-only result, without loading any CYOA documents or images.",
  schema: z.object({
    query: z.string().max(200).default(""),
    limit: z.number().int().min(1).max(50).default(8),
  }),
  readOnly: true,
  run: async ({ query, limit }, ctx) => {
    const rows = await getDb()
      .select({ id: projects.id, title: projects.title })
      .from(projects)
      .where(
        and(
          accessFilter(
            projects,
            projectShares,
            ctx ? { ...ctx, orgId: ctx.orgId ?? undefined } : undefined,
          ),
          sql`${projects.title} LIKE ${`%${query}%`}`,
        ),
      )
      .orderBy(desc(projects.updatedAt))
      .limit(limit);
    return { projects: rows };
  },
});
