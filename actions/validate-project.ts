import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { getProjectOrThrow } from "../server/projects/repository.js";
import { validateProject } from "../shared/project-validation.js";
import {
  buildCyoaIndex,
  isEnabled,
  loadBuildCode,
  computePointTotals,
} from "../shared/cyoa-engine.js";
import { projectEntities } from "../shared/project-workflow.js";
export default defineAction({
  description:
    "Validate broken references, contradictory requirements, dependency cycles and conservative currency bounds. Optional named build codes test fresh/light/shadow/ending states with the real requirement engine. Visibility in supplied states is reported explicitly; static analysis is not an exhaustive reachability proof.",
  schema: z.object({
    projectId: z.string(),
    offset: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    endingIds: z.array(z.string()).max(50).optional(),
    states: z
      .array(z.object({ name: z.string().max(100), buildCode: z.string().max(20000) }))
      .max(8)
      .optional(),
  }),
  http: { method: "GET" },
  readOnly: true,
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  run: async ({ projectId, offset = 0, limit = 50, endingIds = [], states = [] }, ctx) => {
    const { app } = await getProjectOrThrow(projectId, ctx, "viewer");
    const report = validateProject(app),
      idx = buildCyoaIndex(app),
      entries = projectEntities(app);
    const scenarios = [
      { name: "Fresh start", state: loadBuildCode("", app, idx) },
      ...states.map((s) => ({ name: s.name, state: loadBuildCode(s.buildCode, app, idx) })),
    ].map(({ name, state }) => ({
      name,
      endings: endingIds.map((id) => {
        const entry = entries.find((e) => e.id === id),
          row = entry?.rowId ? app.rows.find((r) => r.id === entry.rowId) : undefined;
        const parent =
          entry?.kind === "addon" ? entries.find((e) => e.id === entry.parentId) : undefined;
        return {
          id,
          status: !entry
            ? "missing"
            : isEnabled(entry.entity.requireds, idx, state) &&
                (!row || isEnabled(row.requireds, idx, state)) &&
                (!parent || isEnabled(parent.entity.requireds, idx, state))
              ? "requirements-met"
              : "locked",
          selected: state.activated.has(id),
        };
      }),
      currencies: [...computePointTotals(app, idx, state)].map(([id, value]) => ({
        id,
        total: value.total,
      })),
    }));
    return {
      ...report,
      references: undefined,
      issues: report.issues.slice(offset, offset + limit),
      totalIssues: report.issues.length,
      nextOffset: offset + limit < report.issues.length ? offset + limit : null,
      scenarios,
    };
  },
});
