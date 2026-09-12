import { emit, registerEvent } from "@agent-native/core/event-bus";
import type { ActionRunContext } from "@agent-native/core/action";
import { z } from "zod";
import { PLAN_STATUSES, type PlanStatus, type PlanningTarget } from "../../shared/planning.js";

const createdSchema = z.object({
  projectId: z.string(),
  orgId: z.string().nullable(),
  source: z.enum(["create", "import", "duplicate"]),
});
const statusSchema = z.object({
  projectId: z.string(),
  orgId: z.string().nullable(),
  rowId: z.string(),
  choiceId: z.string().optional(),
  addonId: z.string().optional(),
  previousStatus: z.enum(PLAN_STATUSES),
  status: z.enum(PLAN_STATUSES),
  revision: z.number().int().positive(),
  applied: z.boolean(),
});

// Module-load registration also works for CLI/native actions, not just HTTP.
registerEvent({
  name: "cyoa.project.created",
  description:
    "A project was successfully created, imported or duplicated. Scoped to the caller; contains IDs and source metadata only. Read fresh project context before acting. Event-triggered automation writes do not emit this event.",
  payloadSchema: createdSchema,
  example: { projectId: "example-project", orgId: null, source: "import" },
});
registerEvent({
  name: "cyoa.planning.status-changed",
  description:
    "A saved row/choice/addon draft moved between draft, review and ready. Scoped to the editor who made the change, with no prose or notes. Read get-project-plan under the automation creator's access. Event-triggered automation writes do not re-trigger it.",
  payloadSchema: statusSchema,
  example: {
    projectId: "example-project",
    orgId: null,
    rowId: "example-row",
    previousStatus: "draft",
    status: "review",
    revision: 1,
    applied: false,
  },
});

function emitForCaller(name: string, payload: Record<string, unknown>, ctx?: ActionRunContext) {
  // The bus's owner is the actor, never the source project's owner. A shared
  // editor must not trigger someone else's jobs. No identity means no event.
  if (!ctx?.userEmail || ctx.automation || ctx.caller === "automation") return;
  try {
    emit(name, { ...payload, orgId: ctx.orgId ?? null }, { owner: ctx.userEmail });
  } catch {
    // A subscriber problem must not turn a committed write into an apparent
    // failure (and induce a duplicate mutation on retry).
    console.warn(`[cyoa-events] Could not publish ${name} after a successful write.`);
  }
}

export function projectCreated(
  projectId: string,
  source: "create" | "import" | "duplicate",
  ctx?: ActionRunContext,
) {
  emitForCaller("cyoa.project.created", { projectId, source }, ctx);
}

export function planningStatusChanged(
  projectId: string,
  target: PlanningTarget,
  previousStatus: PlanStatus,
  status: PlanStatus,
  revision: number,
  applied: boolean,
  ctx?: ActionRunContext,
) {
  if (previousStatus === status) return;
  emitForCaller(
    "cyoa.planning.status-changed",
    { projectId, ...target, previousStatus, status, revision, applied },
    ctx,
  );
}
