import type { App, Row, Choice, Addon } from "./types";
import { projectPath } from "./project-routes";

export const PLAN_STATUSES = ["draft", "review", "ready"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];
export interface PlanningDraft {
  title: string;
  text: string;
  notes: string;
  mechanics: string;
  imageNotes: string;
  status: PlanStatus;
  imageStatus: "needed" | "research" | "ready" | "none";
  revision: number;
  baseTitle: string;
  baseText: string;
}
export interface PlanningTarget {
  rowId: string;
  choiceId?: string;
  addonId?: string;
}
export interface PlanningEntry {
  key: string;
  kind: "row" | "choice" | "addon";
  target: PlanningTarget;
  row: Row;
  entity: Row | Choice | Addon;
  parentKey?: string;
  depth: number;
}
export function planningKey(target: PlanningTarget): string {
  return JSON.stringify([target.rowId, target.choiceId ?? "", target.addonId ?? ""]);
}
export function planningEntries(app: App): PlanningEntry[] {
  const result: PlanningEntry[] = [];
  for (const row of [...app.rows].sort((a, b) => a.index - b.index)) {
    const target = { rowId: row.id };
    const key = planningKey(target);
    result.push({ key, kind: "row", target, row, entity: row, depth: 0 });
    for (const choice of [...row.objects].sort((a, b) => a.index - b.index)) {
      const childTarget = { ...target, choiceId: choice.id };
      const childKey = planningKey(childTarget);
      result.push({
        key: childKey,
        kind: "choice",
        target: childTarget,
        row,
        entity: choice,
        parentKey: key,
        depth: 1,
      });
      for (const addon of choice.addons ?? []) {
        const addonTarget = { ...childTarget, addonId: addon.id };
        result.push({
          key: planningKey(addonTarget),
          kind: "addon",
          target: addonTarget,
          row,
          entity: addon,
          parentKey: childKey,
          depth: 2,
        });
      }
    }
  }
  return result;
}
export function livePlanningText(entry: PlanningEntry) {
  return {
    title: String(entry.entity.title ?? ""),
    text: String(entry.kind === "row" ? (entry.row.titleText ?? "") : (entry.entity.text ?? "")),
  };
}
export function planningDraft(entry: PlanningEntry): PlanningDraft {
  const live = livePlanningText(entry);
  const saved = entry.entity.planning as Partial<PlanningDraft> | undefined;
  return {
    ...live,
    notes: "",
    mechanics: "",
    imageNotes: "",
    status: "draft",
    imageStatus: entry.entity.image ? "ready" : "needed",
    revision: 0,
    baseTitle: live.title,
    baseText: live.text,
    ...saved,
  };
}
/** Search prose and editorial notes once per document change, not on each editor keystroke. */
export function planningSearchText(entry: PlanningEntry): string {
  const draft = planningDraft(entry);
  return [
    entry.entity.id,
    entry.row.title,
    entry.entity.title,
    livePlanningText(entry).text,
    draft.title,
    draft.text,
    draft.notes,
    draft.mechanics,
    draft.imageNotes,
    JSON.stringify(entry.entity.requireds ?? []),
  ]
    .join(" ")
    .toLocaleLowerCase();
}
export function planningUrl(
  projectId: string,
  target: PlanningTarget,
  tab = "plan",
  mode = "editor",
): string {
  const params = new URLSearchParams({ tab, rowId: target.rowId });
  if (target.choiceId) params.set("choiceId", target.choiceId);
  if (target.addonId) params.set("addonId", target.addonId);
  return `${projectPath(projectId, mode)}?${params}`;
}
