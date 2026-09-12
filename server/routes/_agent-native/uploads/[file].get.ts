/**
 * Serve blobs stored by the local file-upload provider
 * (server/plugins/file-upload.ts) at public URLs under
 * `/_agent-native/uploads/<key>`.
 *
 * Uploads are one of the sanctioned `/api`-adjacent exceptions in the
 * framework contract (public unauthenticated URLs). Path traversal is
 * prevented in `readUploadedFile` (unit tested).
 */
import { defineEventHandler, createError, getRouterParam } from "h3";

import { readUploadedFile } from "../../../plugins/file-upload.js";

export default defineEventHandler(async (event) => {
  const file = getRouterParam(event, "file");
  try {
    const { data, mimeType } = await readUploadedFile(file ?? "");
    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    const statusCode = (err as { statusCode?: number })?.statusCode ?? 500;
    throw createError({ statusCode, statusMessage: statusCode === 400 ? "Invalid file key" : "Not found" });
  }
});
