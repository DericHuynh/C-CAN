import { fail } from "@agent-native/core/action";
import { z } from "zod";
import {
  CollaborationConflict,
  mergeCollaborativeValue,
} from "../../shared/collaboration-merge.js";
import { agentTouchDocument } from "@agent-native/core/collab";
import { getRequestRunContext, recordChange } from "@agent-native/core/server";
import { projectCollabId } from "../../shared/project-collaboration.js";

export function noteProjectEdit(project: {
  id: string;
  ownerEmail: string | null;
  orgId: string | null;
}) {
  const projectId = project.id;
  // Action events are scoped to their caller. Explicit resource scope also
  // delivers a sharee's save to the owner and other invited editors/viewers.
  recordChange({
    source: "collab",
    type: "project-saved",
    docId: projectCollabId(projectId),
    resourceType: "project",
    resourceId: projectId,
    owner: project.ownerEmail ?? undefined,
    orgId: project.orgId ?? undefined,
  });
  if (!getRequestRunContext()?.runId) return;
  agentTouchDocument(projectCollabId(projectId), {
    metadata: {
      viewport: { projectId, mode: "editor" },
    },
  });
}

export const editBaseSchema = z
  .record(z.string(), z.unknown())
  .optional()
  .describe(
    "Values read before editing, for the fields in patch. Disjoint changes merge; conflicting edits return 409.",
  );

export function mergeProjectEdit<T>(base: T, local: T, current: T): T {
  try {
    return mergeCollaborativeValue(base, local, current);
  } catch (error) {
    if (error instanceof CollaborationConflict)
      fail(error.message, { statusCode: 409, errorCode: "project_edit_conflict" });
    throw error;
  }
}

export function mergeProjectPatch(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
  base?: Record<string, unknown>,
) {
  if (!base) return patch; // Existing agent callers remain compatible.
  return Object.fromEntries(
    Object.entries(patch).map(([key, value]) => [
      key,
      mergeProjectEdit({ [key]: base[key] }, { [key]: value }, { [key]: current[key] })[key],
    ]),
  );
}
