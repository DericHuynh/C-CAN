import { z } from "zod";
import type { App } from "./types";
import { projectEntities, resolveEntity, entityTarget } from "./project-workflow";
import { viewerTargetSchema } from "./viewer-feedback";
import { projectPath } from "./project-routes";

export const projectTargetSchema = viewerTargetSchema.extend({
  projectId: z.string().min(1).max(200),
  mode: z.enum(["viewer", "editor", "visual-editor"]).optional(),
});
export function resolveProjectTarget(app: App, input: z.infer<typeof viewerTargetSchema>) {
  const entries = projectEntities(app);
  const row = input.rowId ? resolveEntity(entries, input.rowId, "row") : undefined;
  const choice = input.choiceId ? resolveEntity(entries, input.choiceId, "choice") : undefined;
  const addon = input.addonId ? resolveEntity(entries, input.addonId, "addon") : undefined;
  const deepest = addon ?? choice ?? row;
  const target = deepest ? entityTarget(deepest) : {};
  if ((row && target.rowId !== row.id) || (choice && target.choiceId !== choice.id))
    throw new Error(
      "Navigation parameters conflicted: the row, choice and addon do not share a parent.",
    );
  return target;
}
export function targetPath(
  projectId: string,
  target: z.infer<typeof viewerTargetSchema>,
  mode: "viewer" | "editor" | "visual-editor" = "viewer",
) {
  const query = new URLSearchParams(target);
  return `${projectPath(projectId, mode)}${query.size ? `?${query}` : ""}`;
}
