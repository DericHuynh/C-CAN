/**
 * Navigate the UI to a view.
 *
 * Writes a navigate command to application state which the UI reads and auto-deletes.
 *
 * Usage:
 *   pnpm action navigate --view=chat
 *   pnpm action navigate --path=/some/route
 *
 * Options:
 *   --view   View name to navigate to
 *   --path   URL path to navigate to
 *   --threadId Chat thread ID to open on the chat route
 */

import { defineAction } from "@agent-native/core/action";
import { writeAppStateForCurrentTab } from "@agent-native/core/application-state";
import { z } from "zod";
import projectContext from "./get-project-context.js";
import { projectPath } from "../shared/project-routes.js";

export default defineAction({
  description:
    "Navigate the UI to a specific view or path. Use projectId with mode and optional rowId/choiceId/addonId to jump within a CYOA without changing its build. Discover IDs with get-project-summary. Hidden targets remain locked; the viewer reports them. Commands target the current browser tab.",
  schema: z.object({
    view: z.string().optional().describe("View name to navigate to"),
    path: z.string().optional().describe("URL path to navigate to"),
    threadId: z.string().optional().describe("Chat thread ID to open"),
    projectId: z.string().optional(),
    mode: z.enum(["viewer", "editor", "visual-editor"]).optional(),
    rowId: z.string().optional(),
    choiceId: z.string().optional(),
    addonId: z.string().optional(),
  }),
  http: false,
  run: async (args, ctx) => {
    if (args.projectId) {
      if (args.path || args.view) throw new Error("Use either projectId or path/view.");
      const context = await projectContext.run({ ...args, projectId: args.projectId }, ctx);
      if (context.missing.length) throw new Error(`Unknown target: ${context.missing.join(", ")}`);
      const params = new URLSearchParams();
      for (const key of ["rowId", "choiceId", "addonId"] as const)
        if (args[key]) params.set(key, args[key]!);
      args.path = `${projectPath(args.projectId, args.mode ?? "viewer")}${params.size ? `?${params}` : ""}`;
    } else if (args.rowId || args.choiceId || args.addonId || args.mode) {
      throw new Error("A projectId is required for a CYOA target.");
    }
    if (
      args.path &&
      (!args.path.startsWith("/") || args.path.startsWith("//") || /[\\\r\n]/.test(args.path))
    )
      throw new Error("Navigation requires an app-local path.");
    if (!args.view && !args.path) {
      throw new Error("At least --view or --path is required.");
    }
    const nav: Record<string, string> = {};
    if (args.view) nav.view = args.view;
    if (args.path) nav.path = args.path;
    if (args.threadId) nav.threadId = args.threadId;
    nav._writeId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await writeAppStateForCurrentTab("navigate", nav);
    return `Navigating to ${args.view || args.path}`;
  },
});
