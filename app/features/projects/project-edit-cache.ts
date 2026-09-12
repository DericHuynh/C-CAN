import type { ProjectDetail } from "@shared/project-contracts";
import { sameValue } from "@shared/collaboration-merge";
import { readLivePath, writeLivePath } from "@/features/editor/live-fields";

/** Only touch the fields sent by this mutation, preserving newer peer updates. */
export function applyProjectEditCache(
  project: ProjectDetail,
  name: string,
  variables: Record<string, unknown>,
): ProjectDetail {
  const patch =
    name === "update-project"
      ? Object.fromEntries(
          ["title", "description"]
            .filter((key) => variables[key] !== undefined)
            .map((key) => [key, variables[key]]),
        )
      : (variables.patch as Record<string, unknown>);
  let result = project;
  const collections: Record<string, [string, string]> = {
    "update-row": ["rows", "rowId"],
    "update-point-type": ["pointTypes", "pointTypeId"],
    "update-group": ["groups", "groupId"],
    "update-image": ["images", "imageId"],
    "update-global-requirement": ["globalRequirements", "requirementId"],
  };
  for (const [field, value] of Object.entries(patch ?? {})) {
    let path: string[];
    if (name === "update-project") path = [field];
    else if (name === "update-project-settings")
      path =
        field === "description"
          ? [field]
          : field === "title"
            ? ["app", "viewerConfig", "title"]
            : ["app", field];
    else if (name === "update-choice")
      path = ["app", "rows", String(variables.rowId), "objects", String(variables.choiceId), field];
    else {
      const collection = collections[name];
      if (!collection) continue;
      path = ["app", collection[0], String(variables[collection[1]]), field];
    }
    if (field === "id" || field === "index") continue;
    const base = variables.base as Record<string, unknown> | undefined;
    if (
      base &&
      field in base &&
      !sameValue(readLivePath(result, path), base[field]) &&
      !sameValue(readLivePath(result, path), value)
    )
      continue;
    const next =
      name === "update-project-settings" &&
      field === "viewerConfig" &&
      value &&
      typeof value === "object"
        ? { ...result.app.viewerConfig, ...value }
        : value;
    result = writeLivePath(result, path, next);
  }
  return result;
}
