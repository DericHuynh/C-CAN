import { planningStatusChanged } from "../server/projects/events.js";
import { projectAudit } from "../server/projects/audit.js";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import {
  livePlanningText,
  planningDraft,
  planningEntries,
  planningKey,
  PLAN_STATUSES,
} from "../shared/planning.js";
import { assertFound } from "../shared/assert.js";
import { getProjectOrThrow, saveProject } from "../server/projects/repository.js";

export default defineAction({
  audit: projectAudit,
  description:
    "Save an editorial draft and notes for a row, choice, or addon. Drafts do not change viewer text until applyToContent is true. Pass expectedRevision from get-project-plan to detect conflicting draft edits. Applying checks that live text has not changed since the draft began. Mechanics and image notes are planning notes, not executable rules.",
  schema: z.object({
    projectId: z.string(),
    rowId: z.string(),
    choiceId: z.string().optional(),
    addonId: z.string().optional(),
    expectedRevision: z.number().int().nonnegative(),
    patch: z.object({
      title: z.string().max(10_000).optional(),
      text: z.string().max(2_000_000).optional(),
      notes: z.string().max(200_000).optional(),
      mechanics: z.string().max(200_000).optional(),
      imageNotes: z.string().max(200_000).optional(),
      status: z.enum(PLAN_STATUSES).optional(),
      imageStatus: z.enum(["needed", "research", "ready", "none"]).optional(),
    }),
    base: z.object({ title: z.string(), text: z.string() }).optional(),
    resetTextToCurrent: z.boolean().default(false),
    applyToContent: z.boolean().default(false),
  }),
  run: async (
    { projectId, expectedRevision, patch, applyToContent, base, resetTextToCurrent, ...target },
    ctx,
  ) => {
    const { app, row } = await getProjectOrThrow(projectId, ctx, "editor");
    const entry = planningEntries(app).find((item) => item.key === planningKey(target));
    assertFound(
      entry,
      "This planning item no longer exists. Reopen the outline to choose another item.",
    );
    const existing = planningDraft(entry);
    assertFound(
      existing.revision === expectedRevision,
      "This draft changed elsewhere. Your text is preserved locally; reload the saved draft before merging your changes.",
    );
    const draft = { ...existing, ...patch, revision: existing.revision + 1 };
    if (!existing.revision && base) {
      draft.baseTitle = base.title;
      draft.baseText = base.text;
    }
    if (resetTextToCurrent) {
      const live = livePlanningText(entry);
      Object.assign(draft, live, { baseTitle: live.title, baseText: live.text });
    }
    if (applyToContent) {
      assertFound(
        existing.revision > 0 || base || resetTextToCurrent,
        "Read the current draft baseline before applying text.",
      );
      const live = livePlanningText(entry);
      assertFound(
        live.title === draft.baseTitle && live.text === draft.baseText,
        "Live text changed since this draft began. Open the content editor to compare it before applying this draft.",
      );
      entry.entity.title = draft.title;
      if (entry.kind === "row") entry.row.titleText = draft.text;
      else entry.entity.text = draft.text;
      draft.baseTitle = draft.title;
      draft.baseText = draft.text;
    }
    entry.entity.planning = draft;
    await saveProject(projectId, app, row.json, undefined, { merge: false });
    planningStatusChanged(
      projectId,
      entry.target,
      existing.status,
      draft.status,
      draft.revision,
      Boolean(applyToContent),
      ctx,
    );
    return { draft, applied: applyToContent, target };
  },
});
