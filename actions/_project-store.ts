/**
 * Private data-access helpers shared by the CYOA project actions.
 *
 * Files starting with `_` are skipped by action discovery, so this module is
 * never exposed as an action itself. It owns the two things every mutation
 * needs: loading a project's row + parsed document, and persisting the
 * document back with a bumped `updatedAt`.
 */
import { eq } from "./_drizzle.js";

import { getDb } from "../server/db/index.js";
import { projects, type NewProject, type Project } from "../server/db/schema.js";
import { normalizeApp, summarizeApp, type AppSummary } from "../shared/cyoa.js";
import type { App } from "../shared/types.js";

/** Throw a helpful error when a lookup condition fails. */
export function assertFound(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/** Lightweight shape used by list views and mutation responses. */
export interface ProjectSummary {
  id: string;
  title: string;
  description: string;
  rowCount: number;
  choiceCount: number;
  pointTypeCount: number;
  addonCount: number;
  updatedAt: string;
  createdAt: string;
  isSeed: boolean;
}

/** Parse a serialized CYOA document, normalizing it against the defaults. */
export function parseAppDocument(json: string): App {
  try {
    return normalizeApp(JSON.parse(json));
  } catch (err) {
    throw new Error(
      `Project document is invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Load a project row and its parsed + normalized document. */
export async function getProjectOrThrow(projectId: string): Promise<{ row: Project; app: App }> {
  const db = getDb();
  const [row] = await db.select().from(projects).where(eq(projects.id, projectId));
  assertFound(row, `Project "${projectId}" not found`);
  return { row, app: parseAppDocument(row.json) };
}

/** Persist a document back to the project row and bump `updatedAt`. */
export async function saveProject(projectId: string, app: App): Promise<void> {
  const db = getDb();
  await db
    .update(projects)
    .set({ json: JSON.stringify(app), updatedAt: new Date().toISOString() })
    .where(eq(projects.id, projectId));
}

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
    isSeed: row.isSeed,
  };
}

/** Full project shape returned by get/create/duplicate/import actions. */
export function toProjectDetail(row: Project, app: App) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    isSeed: row.isSeed,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    summary: toProjectSummary(row, app),
    app,
  };
}

/** Assign 0-based indices to every row in `rows`. */
export function reindexRows(rows: { index: number }[]): void {
  rows.forEach((row, i) => {
    row.index = i;
  });
}

/** Assign 0-based indices to every choice in a row's `objects` array. */
export function reindexChoices(choices: { index: number }[]): void {
  choices.forEach((choice, i) => {
    choice.index = i;
  });
}

/** Values shared by every row insert (create/duplicate/import). */
export function newProjectRow(
  overrides: Partial<NewProject> & { id: string; json: string },
): Project {
  const now = new Date().toISOString();
  return {
    id: overrides.id,
    title: overrides.title ?? "Untitled CYOA",
    description: overrides.description ?? "",
    json: overrides.json,
    ownerEmail: overrides.ownerEmail ?? null,
    orgId: overrides.orgId ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    isSeed: overrides.isSeed ?? false,
  };
}
