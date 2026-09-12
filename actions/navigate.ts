import { pathForView } from "../shared/app-routes.js";
import { projectTargetSchema } from "../shared/project-target.js";
import { getPublication } from "../server/publishing/repository.js";
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
    target: projectTargetSchema
      .optional()
      .describe(
        "Generated target from inspect-project or list-addons. Use alone, or matching explicit fields.",
      ),
    view: z.string().optional().describe("View name to navigate to"),
    path: z.string().optional().describe("URL path to navigate to"),
    threadId: z.string().optional().describe("Chat thread ID to open"),
    projectId: z.string().optional(),
    publicationId: z
      .string()
      .optional()
      .describe(
        "Published CYOA id; view=play for the standalone player, otherwise Explorer details",
      ),
    mode: z.enum(["viewer", "editor", "visual-editor"]).optional(),
    rowId: z.string().optional(),
    choiceId: z.string().optional(),
    addonId: z.string().optional(),
  }),
  http: false,
  run: async (input, ctx) => {
    const args = { ...input };
    if (input.target)
      for (const [key, value] of Object.entries(input.target)) {
        if (value === undefined) continue;
        if (
          (args as Record<string, unknown>)[key] !== undefined &&
          (args as Record<string, unknown>)[key] !== value
        )
          throw new Error(
            `Navigation parameters conflicted: ${key}. Use either path or a generated target.`,
          );
        (args as Record<string, unknown>)[key] = value;
      }
    if (
      args.path &&
      (args.projectId ||
        args.publicationId ||
        args.view ||
        args.mode ||
        args.rowId ||
        args.choiceId ||
        args.addonId)
    )
      throw new Error(
        "Navigation parameters conflicted. Use either path alone or a generated target.",
      );
    if (args.publicationId) {
      if (args.projectId || args.path || args.mode)
        throw new Error("Use publicationId separately from projectId/path/mode.");
      const release = await getPublication(args.publicationId, true, ctx);
      const rows = release.app?.rows ?? [];
      const row = args.rowId ? rows.find((row) => row.id === args.rowId) : undefined;
      const choices = (row ? [row] : rows).flatMap((row) => row.objects);
      const choice = args.choiceId
        ? choices.find((choice) => choice.id === args.choiceId)
        : undefined;
      const addons = (choice ? [choice] : choices).flatMap((choice) => choice.addons ?? []);
      if (
        (args.rowId && !row) ||
        (args.choiceId && !choice) ||
        (args.addonId && !addons.some((addon) => addon.id === args.addonId))
      )
        throw new Error("Unknown published CYOA target.");
      const query = new URLSearchParams();
      for (const key of ["rowId", "choiceId", "addonId"] as const)
        if (args[key]) query.set(key, args[key]!);
      args.path = `/${args.view === "play" ? "play" : "explorer"}/${encodeURIComponent(args.publicationId)}${query.size ? `?${query}` : ""}`;
      args.view = undefined;
    } else if (args.projectId) {
      if (args.path || args.view) throw new Error("Use either projectId or path/view.");
      const context = await projectContext.run({ ...args, projectId: args.projectId }, ctx);
      if (context.missing.length) throw new Error(`Unknown target: ${context.missing.join(", ")}`);
      const params = new URLSearchParams();
      for (const key of ["rowId", "choiceId", "addonId"] as const)
        if (context.target?.[key] || args[key])
          params.set(key, context.target?.[key] || args[key]!);
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
    const viewPath = pathForView(args.view ?? "chat");
    return {
      status: "navigation-requested",
      resolvedUrl:
        args.path ??
        (viewPath === "/" && args.threadId?.trim()
          ? `/chat/${encodeURIComponent(args.threadId.trim())}`
          : viewPath),
      message:
        "Navigation requested; use preview-project to verify viewer readiness and capture pixels.",
    };
  },
});
