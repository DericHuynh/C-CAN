import {
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import type { AppSummary } from "@shared/cyoa";
import type { App, Choice, Row } from "@shared/types";

export interface ProjectSummary {
  id: string;
  title: string;
  description: string | null;
  rowCount: number;
  choiceCount: number;
  pointTypeCount: number;
  addonCount: number;
  updatedAt: string | number;
  createdAt: string | number;
  isSeed: boolean;
}

export interface ProjectDetail {
  id: string;
  title: string;
  description: string | null;
  isSeed: boolean;
  createdAt: string | number;
  updatedAt: string | number;
  summary: AppSummary;
  app: App;
}

/**
 * Loose result shape for mutations that create or return a project.
 * The underlying actions return whichever of these shapes the server
 * implementation picks; this type keeps callers resilient to `{ id }`,
 * `{ projectId }` or `{ project: { id } }`.
 */
export interface ProjectRefResult {
  id?: string;
  projectId?: string;
  project?: { id?: string };
}

/** Extract a project id from a create/duplicate/import mutation result. */
export function extractProjectId(
  result: ProjectRefResult | undefined | null,
): string | undefined {
  return result?.project?.id ?? result?.id ?? result?.projectId;
}

/* ------------------------------------------------------------------ */
/* Queries                                                            */
/* ------------------------------------------------------------------ */

export function useProjects() {
  return useActionQuery<{ projects: ProjectSummary[] }>("list-projects");
}

export function useProject(id: string | undefined) {
  return useActionQuery<ProjectDetail>(
    "get-project",
    { id: id ?? "" },
    { enabled: Boolean(id) },
  );
}

/* ------------------------------------------------------------------ */
/* Project mutations                                                  */
/* ------------------------------------------------------------------ */

export function useCreateProject() {
  return useActionMutation<
    ProjectRefResult,
    { title?: string; description?: string }
  >("create-project");
}

export function useUpdateProject() {
  return useActionMutation<
    ProjectRefResult,
    { id: string; title?: string; description?: string }
  >("update-project");
}

export function useDeleteProject() {
  return useActionMutation<ProjectRefResult, { id: string }>("delete-project");
}

export function useDuplicateProject() {
  return useActionMutation<ProjectRefResult, { id: string }>(
    "duplicate-project",
  );
}

export function useImportProjectJson() {
  return useActionMutation<
    ProjectRefResult,
    { title?: string; description?: string; json: string | object }
  >("import-project-json");
}

export function useExportProjectJson() {
  return useActionMutation<{ json: string | object }, { id: string }>(
    "export-project-json",
  );
}

/* ------------------------------------------------------------------ */
/* Row mutations                                                      */
/* ------------------------------------------------------------------ */

export function useAddRow() {
  return useActionMutation<
    { row?: Row },
    { projectId: string; index?: number }
  >("add-row");
}

export function useUpdateRow() {
  return useActionMutation<
    ProjectRefResult,
    { projectId: string; rowId: string; patch: Record<string, unknown> }
  >("update-row");
}

export function useDeleteRow() {
  return useActionMutation<
    ProjectRefResult,
    { projectId: string; rowId: string }
  >("delete-row");
}

export function useMoveRow() {
  return useActionMutation<
    ProjectRefResult,
    { projectId: string; rowId: string; index: number }
  >("move-row");
}

/* ------------------------------------------------------------------ */
/* Choice mutations                                                   */
/* ------------------------------------------------------------------ */

export function useAddChoice() {
  return useActionMutation<
    { choice?: Choice },
    { projectId: string; rowId: string; index?: number }
  >("add-choice");
}

export function useUpdateChoice() {
  return useActionMutation<
    ProjectRefResult,
    {
      projectId: string;
      rowId: string;
      choiceId: string;
      patch: Record<string, unknown>;
    }
  >("update-choice");
}

export function useDeleteChoice() {
  return useActionMutation<
    ProjectRefResult,
    { projectId: string; rowId: string; choiceId: string }
  >("delete-choice");
}

export function useMoveChoice() {
  return useActionMutation<
    ProjectRefResult,
    { projectId: string; rowId: string; choiceId: string; index: number }
  >("move-choice");
}

export function useAddScore() {
  return useActionMutation<
    ProjectRefResult,
    {
      projectId: string;
      rowId: string;
      choiceId: string;
      pointTypeId: string;
      value?: number;
    }
  >("add-score");
}

export function useDeleteScore() {
  return useActionMutation<
    ProjectRefResult,
    { projectId: string; rowId: string; choiceId: string; scoreId: string }
  >("delete-score");
}

/* ------------------------------------------------------------------ */
/* Point type mutations                                               */
/* ------------------------------------------------------------------ */

export function useAddPointType() {
  return useActionMutation<
    ProjectRefResult,
    {
      projectId: string;
      name?: string;
      startingSum?: number;
      beforeText?: string;
      afterText?: string;
    }
  >("add-point-type");
}

export function useUpdatePointType() {
  return useActionMutation<
    ProjectRefResult,
    { projectId: string; pointTypeId: string; patch: Record<string, unknown> }
  >("update-point-type");
}

export function useDeletePointType() {
  return useActionMutation<
    ProjectRefResult,
    { projectId: string; pointTypeId: string }
  >("delete-point-type");
}

/* ------------------------------------------------------------------ */
/* Group mutations                                                    */
/* ------------------------------------------------------------------ */

export function useAddGroup() {
  return useActionMutation<
    ProjectRefResult,
    { projectId: string; name?: string }
  >("add-group");
}

export function useUpdateGroup() {
  return useActionMutation<
    ProjectRefResult,
    { projectId: string; groupId: string; patch: Record<string, unknown> }
  >("update-group");
}

export function useDeleteGroup() {
  return useActionMutation<
    ProjectRefResult,
    { projectId: string; groupId: string }
  >("delete-group");
}

/* ------------------------------------------------------------------ */
/* Global requirement mutations                                       */
/* ------------------------------------------------------------------ */

export function useAddGlobalRequirement() {
  return useActionMutation<
    ProjectRefResult,
    { projectId: string; name?: string }
  >("add-global-requirement");
}

export function useUpdateGlobalRequirement() {
  return useActionMutation<
    ProjectRefResult,
    {
      projectId: string;
      requirementId: string;
      patch: Record<string, unknown>;
    }
  >("update-global-requirement");
}

export function useDeleteGlobalRequirement() {
  return useActionMutation<
    ProjectRefResult,
    { projectId: string; requirementId: string }
  >("delete-global-requirement");
}

/* ------------------------------------------------------------------ */
/* Project settings                                                   */
/* ------------------------------------------------------------------ */

export function useUpdateProjectSettings() {
  return useActionMutation<
    ProjectRefResult,
    { projectId: string; patch: Record<string, unknown> }
  >("update-project-settings");
}
