import { useQueryClient } from "@tanstack/react-query";
import { appBasePath, appPath } from "@agent-native/core/client/api-path";
import { useAgentRouteState } from "@agent-native/core/client/navigation";
import { useLocation, useNavigate } from "react-router";

import { TAB_ID } from "@/lib/tab-id";

import {
  navigationForLocation,
  pathForCommand,
  type NavigationState,
} from "@/lib/navigation-state";

export function useNavigationState() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useAgentRouteState<NavigationState>({
    browserTabId: TAB_ID,
    requestSource: TAB_ID,
    getNavigationState: (location) => {
      const state = navigationForLocation(location);
      return { ...state, browserTabId: TAB_ID, path: appPath(state.path!) };
    },
    getCommandPath: (command) => routerPath(command.path || pathForCommand(command)),
    onNavigate: (_command, path) => {
      if (path.includes("preview="))
        void queryClient.invalidateQueries({ queryKey: ["action", "get-project"] });
      // Core deliberately skips unchanged URLs. Commit a new location key so
      // an explicit "show that choice again" can refocus an offscreen target.
      if (path === `${location.pathname}${location.search}${location.hash}`)
        navigate(path, { replace: true });
    },
  });
}

function routerPath(path: string): string {
  const basePath = appBasePath();
  if (!basePath) return path;
  if (path === basePath) return "/";
  if (path.startsWith(`${basePath}/`)) {
    return path.slice(basePath.length) || "/";
  }
  return path;
}
