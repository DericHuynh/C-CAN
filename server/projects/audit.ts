import type { ActionAuditConfig } from "@agent-native/core/audit";

/** Resource labels connect action history to a project without copying its
 * potentially image-heavy input into the audit table. Core owns capture and
 * caller/organization scoping; a target never grants access to an event. */
export const projectAudit: ActionAuditConfig = {
  recordInputs: false,
  target: (args, result) => {
    const output = result as { id?: string; projectId?: string } | null;
    const id = output?.projectId ?? output?.id ?? args.projectId ?? args.id;
    return typeof id === "string" ? { type: "project", id } : undefined;
  },
};
