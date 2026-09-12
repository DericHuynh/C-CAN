import { projectMode, projectPath } from "@shared/project-routes";

export interface NavigationState {
  view: string;
  path?: string;
  threadId?: string;
  projectId?: string;
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
  return {
    view: viewForPath(pathname),
    path: `${pathname}${search}${hash}`,
    ...(threadId ? { threadId } : {}),
    ...(projectId
      ? {
          projectId,
          mode: projectMode(match?.[2] ?? params.get("mode")),
          tab: params.get("tab") || "rows",
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
  if (isChatPath(pathname)) return "chat";
  if (pathname.startsWith("/database")) return "database";
  if (pathname.startsWith("/extensions")) return "extensions";
  if (pathname.startsWith("/observability")) return "observability";
  if (pathname.startsWith("/agent")) return "agent";
  if (pathname === "/settings" || pathname === "/team") return "settings";
  if (pathname === "/projects" || pathname.startsWith("/projects/")) return "projects";
  return "chat";
}

function pathForView(view?: string): string {
  switch (view) {
    case "chat":
    case "home":
    case "ask":
      return "/";
    case "projects":
      return "/projects";
    case "database":
      return "/database";
    case "extensions":
      return "/extensions";
    case "observability":
      return "/observability";
    case "agent":
      return "/agent";
    case "settings":
      return "/settings";
    case "team":
      return "/settings#organization";
    default:
      return "/";
  }
}

export function pathForCommand(command: NavigationState): string {
  if (command.view === "projects" && command.projectId?.trim()) {
    const params = new URLSearchParams();
    if (command.tab) params.set("tab", command.tab);
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
