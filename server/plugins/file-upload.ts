/** Composition root for the local blob provider. Use a persistent mounted volume in production. */
import { registerFileUploadProvider } from "@agent-native/core/file-upload";
import { defineNitroPlugin } from "@agent-native/core/server";
import { localUploadProvider } from "../storage/local-uploads.js";

registerFileUploadProvider(localUploadProvider);
export default defineNitroPlugin(() => {});
