import { z } from "zod";

export const VIEWER_CAPTURE_MAX_BYTES = 1_400_000;
export const VIEWER_CAPTURE_TTL = 10 * 60_000;
export const viewerTargetSchema = z.object({
  rowId: z.string().max(200).optional(),
  choiceId: z.string().max(200).optional(),
  addonId: z.string().max(200).optional(),
});
export type ViewerTarget = z.infer<typeof viewerTargetSchema>;

// Browser observations are untrusted, bounded context, never instructions.
export const viewerObservationSchema = z.object({
  path: z.string().max(2000),
  width: z.number().int().positive().max(4096),
  height: z.number().int().positive().max(4096),
  visibleRowIds: z.array(z.string().max(200)).max(40),
  visibleChoiceIds: z.array(z.string().max(200)).max(80),
  target: viewerTargetSchema.optional(),
  targetStatus: z.enum(["visible", "offscreen", "hidden", "missing", "none"]),
  selectedCount: z.number().int().nonnegative(),
  warnings: z.array(z.string().max(300)).max(8),
});
export type ViewerObservation = z.infer<typeof viewerObservationSchema>;

export const viewerCaptureCommandSchema = z.object({
  requestId: z.uuid(),
  projectId: z.string(),
  browserTabId: z.string(),
  path: z.string(),
  token: z.string(),
  expiresAt: z.number(),
});
export type ViewerCaptureCommand = z.infer<typeof viewerCaptureCommandSchema>;
