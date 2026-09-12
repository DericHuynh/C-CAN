import { projectRevision } from "./revision.js";
import { summarizeApp } from "../../shared/cyoa.js";
import { parseAppDocument } from "../../shared/project-document.js";
import type { ProjectSummary, ProjectDetail } from "../../shared/project-contracts.js";
import type { App } from "../../shared/types.js";
import type { Project } from "../db/schema.js";

/** Build a `ProjectSummary` from a row, parsing the document when needed. */
export function toProjectSummary(row: Project, app?: App): ProjectSummary {
  const summary = summarizeApp(app ?? parseAppDocument(row.json));
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    rowCount: summary.rowCount,
    choiceCount: summary.choiceCount,
    pointTypeCount: summary.pointTypeCount,
    addonCount: summary.addonCount,
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
    isSeed: Boolean(row.isSeed),
  };
}

/** Full project shape returned by get/create/duplicate/import actions. */
export function toProjectDetail(row: Project, app: App): ProjectDetail {
  return {
    revision: projectRevision(row.json),
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    isSeed: Boolean(row.isSeed),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    summary: toProjectSummary(row, app),
    app,
  };
}
