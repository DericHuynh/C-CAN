import type { App } from "@shared/types";
import { projectStoragePath } from "@shared/project-routes";

export interface ViewerPreferences {
  objectsPerRow?: string;
  smallerScreenPx?: number;
  minimizeTemplate?: boolean;
  enableHalfRow?: boolean;
  buildAutoSaveIsOn?: boolean;
  buildAutoSaveInterval?: number;
  preloadImages?: boolean;
  allowDeselect?: boolean;
  isSingleFile?: boolean;
  showMusicPlayer?: boolean;
  cropperPosition?: number;
  backPackWidth?: number;
}

export function parseViewerPreferences(raw: unknown): ViewerPreferences {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of [
    "minimizeTemplate",
    "enableHalfRow",
    "buildAutoSaveIsOn",
    "preloadImages",
    "allowDeselect",
    "isSingleFile",
    "showMusicPlayer",
  ]) {
    if (typeof source[key] === "boolean") result[key] = source[key];
  }
  for (const [key, min, max] of [
    ["smallerScreenPx", 0, 1280],
    ["buildAutoSaveInterval", 1, 1440],
    ["cropperPosition", 0, 8],
    ["backPackWidth", 240, 16384],
  ] as const) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value))
      result[key] = Math.max(min, Math.min(max, value));
  }
  if (["default", "col-6", "col-4", "col-3"].includes(String(source.objectsPerRow)))
    result.objectsPerRow = source.objectsPerRow;
  return result as ViewerPreferences;
}

export function applyViewerPreferences(app: App, preferences: ViewerPreferences): App {
  const { allowDeselect, isSingleFile, backPackWidth, ...fields } =
    parseViewerPreferences(preferences);
  return {
    ...app,
    ...fields,
    styling: backPackWidth === undefined ? app.styling : { ...app.styling, backPackWidth },
    viewerSettings: {
      ...app.viewerSettings,
      ...(allowDeselect === undefined ? {} : { allowDeselect }),
      ...(isSingleFile === undefined ? {} : { isSingleFile }),
    },
  };
}

export function viewerPreferencesKey(): string {
  return `iccplus-viewer:${typeof window === "undefined" ? "cyoa" : projectStoragePath(window.location.pathname)}`;
}
