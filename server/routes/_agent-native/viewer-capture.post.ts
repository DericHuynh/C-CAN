/** Authenticated binary upload exception; app operations remain actions. */
import { createError, defineEventHandler } from "h3";
import { getSession, runWithRequestContext } from "@agent-native/core/server";
import { acceptViewerCapture } from "../../viewer/capture.js";
import {
  VIEWER_CAPTURE_MAX_BYTES,
  viewerObservationSchema,
} from "../../../shared/viewer-feedback.js";

export default defineEventHandler(async (event) => {
  const session = await getSession(event);
  if (!session?.email)
    throw createError({ statusCode: 401, statusMessage: "Sign in to upload viewer feedback." });
  const token = event.req.headers.get("X-Viewer-Capture");
  const rawObservation = event.req.headers.get("X-Viewer-Observation");
  if (!token || token.length > 12000 || !rawObservation || rawObservation.length > 24000)
    throw createError({ statusCode: 400, statusMessage: "Invalid capture metadata." });
  // Read the stream with a hard bound even when Content-Length is absent or forged.
  const reader = event.req.body?.getReader();
  if (!reader) throw createError({ statusCode: 400, statusMessage: "Missing screenshot." });
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > VIEWER_CAPTURE_MAX_BYTES) {
      await reader.cancel();
      throw createError({ statusCode: 413, statusMessage: "Screenshot too large." });
    }
    chunks.push(value);
  }
  return runWithRequestContext({ userEmail: session.email, orgId: session.orgId }, async () => {
    const observation = viewerObservationSchema.parse(
      JSON.parse(decodeURIComponent(rawObservation)),
    );
    return acceptViewerCapture(token, Buffer.concat(chunks), observation, {
      caller: "frontend",
      userEmail: session.email,
      orgId: session.orgId,
    });
  });
});
