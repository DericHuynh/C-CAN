import { and, desc, sql } from "@agent-native/core/db/schema";
import { accessFilter } from "@agent-native/core/sharing";
import { getDb } from "../db/index.js";
import { projects, projectShares } from "../db/schema.js";
import type { ProjectAccessContext } from "./repository.js";

/** Metadata-only discovery shared by project search and the mention provider. */
export async function searchProjectTitles(
  { query, limit }: { query: string; limit: number },
  ctx?: ProjectAccessContext,
) {
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
}

/** List access is enforced in SQL, before documents are parsed for summaries. */
export async function listAccessibleProjects(ctx?: ProjectAccessContext) {
  return getDb()
    .select()
    .from(projects)
    .where(
      accessFilter(
        projects,
        projectShares,
        ctx ? { ...ctx, orgId: ctx.orgId ?? undefined } : undefined,
      ),
    )
    .orderBy(desc(projects.updatedAt));
}
