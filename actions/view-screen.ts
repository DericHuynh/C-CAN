/**
 * See what the user is currently looking at on screen.
 *
 * Reads and returns the current navigation state from application state.
 *
 * Usage:
 *   pnpm action view-screen
 */

import { defineAction } from "@agent-native/core/action";
import { readAppState, readAppStateForCurrentTab } from "@agent-native/core/application-state";
import { z } from "zod";
import projectContext from "./get-project-context.js";
import captureViewer from "./capture-viewer.js";
import { viewerObservationSchema } from "../shared/viewer-feedback.js";

export default defineAction({
  description:
    "See the current page and selected CYOA row/choice/addon, with fresh access-checked project context. Call this before acting on what the user is looking at.",
  schema: z.object({
    screenshot: z
      .boolean()
      .optional()
      .describe(
        "Capture a fresh picture of the open viewer. Use a vision-capable model for image feedback.",
      ),
  }),
  http: false,
  readOnly: true,
  run: async (args, ctx) => {
    const navigation = await readAppStateForCurrentTab("navigation", { fallbackToGlobal: false });

    const screen: Record<string, unknown> = {};
    if (navigation) screen.navigation = navigation;
    const parsed = z
      .object({
        projectId: z.string(),
        rowId: z.string().optional(),
        choiceId: z.string().optional(),
        addonId: z.string().optional(),
      })
      .safeParse(navigation);
    if (parsed.success) {
      // Never hydrate records directly from app state: it is client-controlled
      // and may refer to a project whose access has since been revoked.
      screen.context = await projectContext.run(parsed.data, ctx);
      if (
        typeof navigation?.browserTabId === "string" &&
        /^[\w-]{1,96}$/.test(navigation.browserTabId)
      ) {
        const viewer = await readAppState(`viewer-observation:${navigation.browserTabId}`);
        const observed = viewerObservationSchema.safeParse(viewer);
        if (
          observed.success &&
          viewer?.projectId === parsed.data.projectId &&
          viewer.path === navigation.path
        )
          screen.viewer = {
            ...observed.data,
            observedAt: typeof viewer.observedAt === "number" ? viewer.observedAt : null,
          };
      }
    }

    if (args.screenshot) Object.assign(screen, await captureViewer.run({}, ctx));

    if (Object.keys(screen).length === 0) {
      return "No application state found. Is the app running?";
    }
    return screen;
  },
});
