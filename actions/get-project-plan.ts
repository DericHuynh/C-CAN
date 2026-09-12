import { projectAudit } from "./_project-audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import {
  planningDraft,
  planningEntries,
  planningKey,
  planningSearchText,
  PLAN_STATUSES,
} from "../shared/planning.js";
import { getProjectOrThrow } from "./_project-store.js";

export default defineAction({
  audit: projectAudit,
  description:
    "Read a bounded planning outline, searchable by title, id, prose, or notes. Supply rowId (and choiceId/addonId) to read one full draft with its revision, current text, and configured mechanics; use update-planning-entry to save. Omits other entries' prose and all image payloads.",
  http: { method: "GET" },
  readOnly: true,
  schema: z.object({
    projectId: z.string(),
    query: z.string().optional(),
    status: z.enum(PLAN_STATUSES).optional(),
    imageStatus: z.enum(["needed", "research", "ready", "none"]).optional(),
    offset: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    rowId: z.string().optional(),
    choiceId: z.string().optional(),
    addonId: z.string().optional(),
  }),
  run: async ({ projectId, query, status, imageStatus, offset, limit, ...target }, ctx) => {
    // Editorial work requires editor access even if the playable project is shared publicly.
    const { app } = await getProjectOrThrow(projectId, ctx, "editor");
    const all = planningEntries(app);
    const filtered = all.filter(
      (entry) =>
        (!status || planningDraft(entry).status === status) &&
        (!imageStatus || planningDraft(entry).imageStatus === imageStatus) &&
        (!query?.trim() || planningSearchText(entry).includes(query.trim().toLocaleLowerCase())),
    );
    const selected = target.rowId
      ? all.find((entry) => entry.key === planningKey({ ...target, rowId: target.rowId! }))
      : undefined;
    return {
      total: filtered.length,
      offset,
      entries: filtered.slice(offset, offset + limit).map((entry) => ({
        key: entry.key,
        kind: entry.kind,
        ...entry.target,
        title: planningDraft(entry).title,
        status: planningDraft(entry).status,
        imageStatus: planningDraft(entry).imageStatus,
        revision: planningDraft(entry).revision,
      })),
      entry: selected
        ? {
            ...selected.target,
            kind: selected.kind,
            draft: planningDraft(selected),
            currentTitle: selected.entity.title ?? "",
            currentText: selected.kind === "row" ? selected.row.titleText : selected.entity.text,
            requireds: selected.entity.requireds,
            scores: selected.entity.scores,
            image: selected.entity.image,
          }
        : null,
    };
  },
});
