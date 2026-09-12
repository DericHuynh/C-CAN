import { explorerFiltersFromParams } from "@shared/publications";
import { pathForView } from "@shared/app-routes";
import { projectMode, projectPath } from "@shared/project-routes";

export interface NavigationState {
  view: string;
  path?: string;
  threadId?: string;
  projectId?: string;
  publicationId?: string;
  query?: string;
  tags?: string[];
  excludeTags?: string[];
  content?: string;
  sort?: string;
  page?: number;
  mode?: string;
  tab?: string;
  rowId?: string;
  choiceId?: string;
  addonId?: string;
  imageId?: string;
}

export function navigationForLocation({
  pathname,
  search = "",
  hash = "",
}: {
  pathname: string;
  search?: string;
  hash?: string;
}): NavigationState {
  const threadId = threadIdFromPath(pathname);
  const match = pathname.match(/^\/projects\/([^/]+)(?:\/(editor|visual-editor|viewer))?\/?$/);
  let projectId: string | undefined;
  try {
    projectId = match ? decodeURIComponent(match[1]) : undefined;
  } catch {
    /* Invalid URL id. */
  }
  const params = new URLSearchParams(search);
  const publishedMatch = pathname.match(/^\/(?:explorer|play)\/([^/]+)\/?$/);
  let publicationId: string | undefined;
  try {
    publicationId = publishedMatch ? decodeURIComponent(publishedMatch[1]) : undefined;
  } catch {
    /* Malformed path. */
  }

  return {
    view: viewForPath(pathname),
    path: `${pathname}${search}${hash}`,
    ...(threadId ? { threadId } : {}),
    ...(pathname === "/explorer" ? explorerFiltersFromParams(params) : {}),
    ...(publicationId
      ? {
          publicationId,
          ...Object.fromEntries(
            ["rowId", "choiceId", "addonId"]
              .filter((key) => params.has(key))
              .map((key) => [key, params.get(key)]),
          ),
        }
      : {}),
    ...(projectId
      ? {
          projectId,
          mode: projectMode(match?.[2] ?? params.get("mode")),
          tab: params.get("tab") === "plan" ? "rows" : params.get("tab") || "rows",
          ...Object.fromEntries(
            ["rowId", "choiceId", "addonId", "imageId"]
              .filter((key) => params.has(key))
              .map((key) => [key, params.get(key)]),
          ),
        }
      : {}),
  };
}

function threadIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/chat\/([^/]+)/);
  if (!match) return null;
  try {
    const value = decodeURIComponent(match[1]).trim();
    return value || null;
  } catch {
    return null;
  }
}

export function viewForPath(pathname: string): string {
  if (pathname.startsWith("/play/")) return "play";
  if (pathname === "/explorer" || pathname.startsWith("/explorer/")) return "explorer";
  if (isChatPath(pathname)) return "chat";
  if (pathname.startsWith("/database")) return "database";
  if (pathname.startsWith("/extensions")) return "extensions";
  if (pathname.startsWith("/observability")) return "observability";
  if (pathname.startsWith("/agent")) return "agent";
  if (pathname === "/settings" || pathname.startsWith("/settings/") || pathname === "/team")
    return "settings";
  if (pathname === "/projects" || pathname.startsWith("/projects/")) return "projects";
  return "chat";
}

export function pathForCommand(command: NavigationState): string {
  if (command.publicationId) {
    const params = new URLSearchParams();
    for (const key of ["rowId", "choiceId", "addonId"] as const)
      if (command[key]) params.set(key, command[key]!);
    return `/${command.view === "play" ? "play" : "explorer"}/${encodeURIComponent(command.publicationId)}${params.size ? `?${params}` : ""}`;
  }
  if (command.view === "projects" && command.projectId?.trim()) {
    const params = new URLSearchParams();
    if (command.tab) params.set("tab", command.tab === "plan" ? "rows" : command.tab);
    for (const key of ["rowId", "choiceId", "addonId", "imageId"] as const)
      if (command[key]) params.set(key, command[key]!);
    const query = params.toString();
    return `${projectPath(command.projectId.trim(), command.mode)}${query ? `?${query}` : ""}`;
  }
  const path = pathForView(command?.view);
  if (path !== "/") return path;
  const threadId = typeof command?.threadId === "string" ? command.threadId.trim() : "";
  return threadId ? `/chat/${encodeURIComponent(threadId)}` : "/";
}

function isChatPath(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/chat/");
}
