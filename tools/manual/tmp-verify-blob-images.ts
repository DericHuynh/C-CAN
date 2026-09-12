/**
 * Dev helper: verify G6 blob externalization through the local provider.
 * Run: pnpm exec tsx tools/manual/tmp-verify-blob-images.ts
 */
import "../../server/plugins/file-upload.js"; // registers the local disk provider
import { listFileUploadProviders } from "@agent-native/core/file-upload";

import { externalizeAppImages } from "../../server/media/blob-images.js";

console.log(
  "providers:",
  listFileUploadProviders()
    .map((p) => `${p.id} (${p.isConfigured() ? "configured" : "not"})`)
    .join(", "),
);

const app = {
  images: [
    {
      id: "i1",
      name: "tiny png",
      image:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      imageIsURL: false,
    },
    { id: "i2", name: "remote", image: "https://example.com/cat.png", imageIsURL: true },
  ],
};

const moved = await externalizeAppImages(app as never);
console.log("externalized:", moved);
console.log("i1:", app.images[0].image.slice(0, 80), "| imageIsURL:", app.images[0].imageIsURL);
console.log("i2 unchanged:", app.images[1].image === "https://example.com/cat.png");
