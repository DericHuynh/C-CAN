import { useProjectEdit } from "./use-project-edit";
import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import type { ProjectDetail } from "@shared/project-contracts";
export type { ProjectSummary, ProjectDetail } from "@shared/project-contracts";

/** Creation actions share one stable result contract. */
export function extractProjectId(
  result: Pick<ProjectDetail, "id"> | null | undefined,
): string | undefined {
  return result?.id;
}

/* ------------------------------------------------------------------ */
/* Queries                                                            */
/* ------------------------------------------------------------------ */

export function useProjects() {
  return useActionQuery("list-projects");
}

export function useProject(id: string | undefined) {
  return useActionQuery("get-project", { id: id ?? "" }, { enabled: Boolean(id) });
}

/* ------------------------------------------------------------------ */
/* Project mutations                                                  */
/* ------------------------------------------------------------------ */

export function useCreateProject() {
  return useActionMutation("create-project");
}

export function useUpdateProject() {
  return useProjectEdit("update-project");
}

export function useDeleteProject() {
  return useActionMutation("delete-project");
}

export function useDuplicateProject() {
  return useActionMutation("duplicate-project");
}

export function useImportProjectJson() {
  return useActionMutation("import-project-json");
}

export function useExportProjectJson() {
  return useActionMutation("export-project-json");
}

/* ------------------------------------------------------------------ */
/* Row mutations                                                      */
/* ------------------------------------------------------------------ */

export function useAddRow() {
  return useActionMutation("add-row");
}

export function useUpdateRow() {
  return useProjectEdit("update-row");
}

export function useDeleteRow() {
  return useActionMutation("delete-row");
}

export function useMoveRow() {
  return useActionMutation("move-row");
}

/* ------------------------------------------------------------------ */
/* Choice mutations                                                   */
/* ------------------------------------------------------------------ */

export function useAddChoice() {
  return useActionMutation("add-choice");
}

export function useUpdateChoice() {
  return useProjectEdit("update-choice");
}

export function useDeleteChoice() {
  return useActionMutation("delete-choice");
}

export function useMoveChoice() {
  return useActionMutation("move-choice");
}

export function useMoveAddon() {
  return useActionMutation("move-addon");
}

export function useDeleteAddon() {
  return useActionMutation("delete-addon");
}

export function useAddScore() {
  return useActionMutation("add-score");
}

export function useDeleteScore() {
  return useActionMutation("delete-score");
}

/* ------------------------------------------------------------------ */
/* Point type mutations                                               */
/* ------------------------------------------------------------------ */

export function useAddPointType() {
  return useActionMutation("add-point-type");
}

export function useUpdatePointType() {
  return useProjectEdit("update-point-type");
}

export function useDeletePointType() {
  return useActionMutation("delete-point-type");
}

/* ------------------------------------------------------------------ */
/* Group mutations                                                    */
/* ------------------------------------------------------------------ */

export function useAddGroup() {
  return useActionMutation("add-group");
}

export function useUpdateGroup() {
  return useProjectEdit("update-group");
}

export function useDeleteGroup() {
  return useActionMutation("delete-group");
}

/* ------------------------------------------------------------------ */
/* Image resource mutations                                           */
/* ------------------------------------------------------------------ */

export function useAddImage() {
  return useActionMutation("add-image");
}

export function useUpdateImage() {
  return useProjectEdit("update-image");
}

export function useDeleteImage() {
  return useActionMutation("delete-image");
}

/* ------------------------------------------------------------------ */
/* Global requirement mutations                                       */
/* ------------------------------------------------------------------ */

export function useAddGlobalRequirement() {
  return useActionMutation("add-global-requirement");
}

export function useUpdateGlobalRequirement() {
  return useProjectEdit("update-global-requirement");
}

export function useDeleteGlobalRequirement() {
  return useActionMutation("delete-global-requirement");
}

/* ------------------------------------------------------------------ */
/* Project settings                                                   */
/* ------------------------------------------------------------------ */

export function useUpdateProjectSettings() {
  return useProjectEdit("update-project-settings");
}

export function useGenerateImagePreviews() {
  return useActionMutation("generate-image-previews", { skipActionQueryInvalidation: true });
}
