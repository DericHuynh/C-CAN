import { useActionMutation } from "@agent-native/core/client/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { useEditorProject } from "@/features/editor/EditorProjectContext";
import { useDraftRegistry } from "@/features/editor/DraftCollaboration";
import { changedFields } from "@shared/collaboration-merge";
import type { ProjectDetail } from "@shared/project-contracts";
import { useLiveFields } from "@/features/editor/LiveProjectFields";
import { applyProjectEditCache } from "./project-edit-cache";

type EditAction =
  | "update-row"
  | "update-choice"
  | "update-point-type"
  | "update-group"
  | "update-image"
  | "update-global-requirement"
  | "update-project-settings"
  | "update-project";

/** Construct a field baseline from the document rendered when Save was clicked. */
export function prepareProjectEdit(
  name: EditAction,
  variables: Record<string, unknown>,
  project: ProjectDetail | null,
) {
  if (!project || (variables.projectId ?? variables.id) !== project.id) return variables;
  const app = project.app;
  let source: Record<string, unknown> | undefined;
  switch (name) {
    case "update-row":
      source = app.rows.find((row) => row.id === variables.rowId);
      break;
    case "update-choice":
      source = app.rows
        .find((row) => row.id === variables.rowId)
        ?.objects.find((choice) => choice.id === variables.choiceId);
      break;
    case "update-point-type":
      source = app.pointTypes.find((item) => item.id === variables.pointTypeId);
      break;
    case "update-group":
      source = app.groups.find((item) => item.id === variables.groupId);
      break;
    case "update-image":
      source = app.images.find((item) => item.id === variables.imageId);
      break;
    case "update-global-requirement":
      source = app.globalRequirements?.find((item) => item.id === variables.requirementId);
      break;
    case "update-project-settings":
      source = { ...app, title: app.viewerConfig.title, description: project.description };
      break;
    case "update-project":
      source = { title: project.title, description: project.description };
      break;
  }
  if (!source) return variables; // The action reports a deleted target; never recreate it here.
  const patch =
    name === "update-project"
      ? Object.fromEntries(
          ["title", "description"]
            .filter((key) => variables[key] !== undefined)
            .map((key) => [key, variables[key]]),
        )
      : (variables.patch as Record<string, unknown>);
  const changed = changedFields(source, patch);
  const base = Object.fromEntries(Object.keys(changed).map((key) => [key, source![key]]));
  return name === "update-project"
    ? { id: variables.id, ...changed, base }
    : { ...variables, patch: changed, base };
}

/** Uses Core's action mutation/invalidation lifecycle, with CYOA field baselines. */
export function useProjectEdit<N extends EditAction>(name: N) {
  const project = useEditorProject();
  const registry = useDraftRegistry();
  const queryClient = useQueryClient();
  const live = useLiveFields();
  const mutation = useActionMutation(name, {
    skipActionQueryInvalidation: true,
    onMutate: () => {
      registry?.assertReady();
    },
    onSuccess: async (_result, variables) => {
      const args = variables as Record<string, unknown>;
      const key = ["action", "get-project", { id: args.projectId ?? args.id }];
      // The action has committed. Install its changed fields immediately;
      // the authoritative full read (including normalization) runs in background.
      await queryClient.cancelQueries({ queryKey: key });
      const current = queryClient.getQueryData<ProjectDetail>(key);
      if (current) {
        const next = applyProjectEditCache(current, name, args);
        live?.acknowledge(current.app, next.app);
        queryClient.setQueryData(key, next);
      }
      void queryClient.invalidateQueries({ queryKey: ["action"] });
    },
  });
  type Variables = Parameters<typeof mutation.mutate>[0];
  const prepare = (variables: Variables) =>
    prepareProjectEdit(name, variables as Record<string, unknown>, project) as Variables;
  return {
    ...mutation,
    mutate: (...args: Parameters<typeof mutation.mutate>) => {
      args[0] = prepare(args[0]);
      return mutation.mutate(...args);
    },
    mutateAsync: (...args: Parameters<typeof mutation.mutateAsync>) => {
      args[0] = prepare(args[0]);
      return mutation.mutateAsync(...args);
    },
  };
}
