import { defineAction } from "@agent-native/core/action";
import { readAppState, readAppStateForCurrentTab } from "@agent-native/core/application-state";
import { z } from "zod";
import { assertAccess } from "@agent-native/core/sharing";
import { readViewerCapture, requestViewerCapture } from "./_viewer-capture.js";

export default defineAction({
  description:
    "Get a picture of the current CYOA viewer or visual editor, plus visible row/choice IDs and build selection count. Requires an open browser tab. Use navigate first to visit a target, then call view-screen to confirm it. If pending, call again with requestId and browserTabId. Images require a vision-capable model; never claim visual inspection on a text-only model.",
  schema: z.object({
    requestId: z.uuid().optional(),
    browserTabId: z
      .string()
      .regex(/^[\w-]{1,96}$/)
      .optional(),
  }),
  run: async ({ requestId, browserTabId }, ctx) => {
    if (!ctx?.userEmail) throw new Error("Sign in to capture the viewer.");
    if (requestId) {
      if (!browserTabId)
        throw new Error("Pass the browserTabId returned with the capture request.");
      return { ...(await readViewerCapture(requestId, browserTabId, ctx)), browserTabId };
    }
    const navigation = z
      .object({
        projectId: z.string(),
        browserTabId: z.string(),
        path: z.string(),
        mode: z.enum(["viewer", "veditor", "visual-editor"]),
      })
      .safeParse(
        browserTabId
          ? await readAppState(`navigation:${browserTabId}`)
          : await readAppStateForCurrentTab("navigation", { fallbackToGlobal: false }),
      );
    if (!navigation.success)
      throw new Error("Open a project in Viewer or Visual editor before requesting a screenshot.");
    await assertAccess("project", navigation.data.projectId, "viewer", {
      userEmail: ctx?.userEmail,
      orgId: ctx?.orgId ?? undefined,
    });
    const request = await requestViewerCapture(navigation.data, ctx);
    // A bounded inline wait; slow/offline tabs have an explicit retry handle.
    for (let attempt = 0; attempt < 16; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const result = await readViewerCapture(request.requestId, request.browserTabId, ctx);
      if (result.status !== "pending") return { ...result, browserTabId: request.browserTabId };
    }
    return {
      status: "pending",
      requestId: request.requestId,
      browserTabId: request.browserTabId,
      message:
        "Waiting for the viewer tab. Keep it open and call capture-viewer again with requestId and browserTabId. Do not treat this as a screenshot.",
    };
  },
});
