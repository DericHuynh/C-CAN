import { randomUUID } from "node:crypto";
import {
  readAppState,
  readAppStateForCurrentTab,
  writeAppStateForCurrentTab,
} from "@agent-native/core/application-state";
import type { ActionRunContext } from "@agent-native/core/action";
import { z } from "zod";
import { getProjectOrThrow } from "../projects/repository.js";
import { projectRevision } from "../projects/revision.js";
import { resolveProjectTarget, targetPath } from "../../shared/project-target.js";
import { viewerTargetSchema, viewerObservationSchema } from "../../shared/viewer-feedback.js";
import { validateProject } from "../../shared/project-validation.js";
import { requestViewerCapture, readViewerCapture } from "./capture.js";

export const previewOptionsSchema = viewerTargetSchema.extend({
  capture: z
    .boolean()
    .optional()
    .describe("Defaults true. False opens and checks readiness without pixels."),
  buildCode: z
    .string()
    .max(1000)
    .optional()
    .describe(
      "Optional isolated test state; empty string means fresh start. This is a supplied state, not proof of a reachable path.",
    ),
});
export async function previewProject(
  input: z.infer<typeof previewOptionsSchema> & { projectId: string },
  ctx?: ActionRunContext,
) {
  const { app, row } = await getProjectOrThrow(input.projectId, ctx, "viewer");
  const target = resolveProjectTarget(app, input);
  const revision = projectRevision(row.json);
  const report = validateProject(app);
  const validation = {
    errors: report.errors,
    warnings: report.warnings,
    issues: report.issues.slice(0, 20),
    omittedIssues: Math.max(0, report.issues.length - 20),
    limitations: report.limitations,
  };
  const navigation = await readAppStateForCurrentTab("navigation", { fallbackToGlobal: false });
  const tab = z
    .string()
    .regex(/^[\w-]{1,96}$/)
    .safeParse(navigation?.browserTabId);
  const base = { projectId: input.projectId, target, revision, validation };
  if (!tab.success)
    return {
      ...base,
      status: "unavailable",
      reason: "browser-tab-unavailable",
      message:
        "Open this app in a browser tab connected to the agent, then retry preview-project. No screenshot was captured.",
    };
  const url = new URL(targetPath(input.projectId, target), "https://local.invalid");
  url.searchParams.set("preview", randomUUID());
  if (input.buildCode !== undefined) url.searchParams.set("buildCode", input.buildCode);
  const path = url.pathname + url.search;
  if (path.length > 3800)
    throw new Error(
      "Preview URL exceeds the capture limit. Use shorter target IDs or a shorter test buildCode.",
    );
  // Keep Core's tab routing and browser base-path handling. No global command.
  await writeAppStateForCurrentTab("navigate", { path, _writeId: randomUUID() });
  const expectedSuffix = path;
  let reason = "viewer-not-ready";
  let observed: z.infer<typeof viewerObservationSchema> | undefined;
  let actualPath: string | undefined;
  for (let attempt = 0; attempt < 24; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const raw = await readAppState(`viewer-observation:${tab.data}`);
    const parsed = viewerObservationSchema.safeParse(raw);
    if (
      parsed.success &&
      raw?.projectId === input.projectId &&
      parsed.data.path.endsWith(expectedSuffix)
    ) {
      if (parsed.data.documentRevision !== revision) {
        reason = "viewer-stale";
        continue;
      }
      observed = parsed.data;
      actualPath = parsed.data.path;
      break;
    }
    const current = await readAppState(`navigation:${tab.data}`);
    reason =
      current?.view === "chat"
        ? "still-on-chat"
        : current?.projectId !== input.projectId
          ? "navigation-not-completed"
          : "viewer-not-ready";
  }
  const resolvedUrl = actualPath ?? path;
  if (!observed)
    return {
      ...base,
      resolvedUrl,
      status: "pending",
      reason,
      message:
        "No screenshot captured. Viewer readiness was not confirmed within 12 seconds. Keep the tab open and retry preview-project; do not repeat content mutations.",
    };
  if (
    observed.targetStatus === "hidden" ||
    observed.targetStatus === "missing" ||
    observed.targetStatus === "offscreen"
  )
    return {
      ...base,
      resolvedUrl,
      status: "unavailable",
      reason:
        observed.targetStatus === "hidden"
          ? "target-hidden-or-locked"
          : `target-${observed.targetStatus}`,
      observation: observed,
      message:
        "Target is not visible. Inspect requirements or supply an explicit test buildCode; no screenshot was captured.",
    };
  if (input.capture === false)
    return { ...base, resolvedUrl, status: "viewer-ready", observation: observed };
  const request = await requestViewerCapture(
    {
      projectId: input.projectId,
      browserTabId: tab.data,
      path: resolvedUrl,
      documentRevision: revision,
    },
    ctx,
  );
  for (let attempt = 0; attempt < 16; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const result = await readViewerCapture(request.requestId, tab.data, ctx);
    if (result.status !== "pending")
      return { ...base, resolvedUrl, browserTabId: tab.data, ...result };
  }
  return {
    ...base,
    resolvedUrl,
    status: "pending",
    reason: "browser-capture-pending",
    requestId: request.requestId,
    browserTabId: tab.data,
    message:
      "Viewer is ready; pixels are still pending. Resume with capture-viewer(requestId, browserTabId). Do not replay committed mutations.",
  };
}
