import type { App } from "./types.js";

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

export interface ProjectDetail {
  canEdit?: boolean;
  revision?: string;
  id: string;
  title: string;
  description: string;
  isSeed: boolean;
  createdAt: string;
  updatedAt: string;
  summary: ProjectSummary;
  app: App;
}
