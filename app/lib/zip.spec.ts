import { describe, expect, it } from "vite-plus/test";
import { inlineZipImages, zipProjectEntry, unzip } from "./zip";

describe("ICCPlus ZIP import", () => {
  it("chooses project.json ahead of manifests, including a containing directory", () => {
    const files = new Map([
      ["manifest.json", new Uint8Array([1])],
      ["export/project.json", new Uint8Array([2])],
    ]);
    expect(zipProjectEntry(files)[0]).toBe("export/project.json");
    expect(() =>
      zipProjectEntry(
        new Map([
          ["a.json", new Uint8Array()],
          ["b.json", new Uint8Array()],
        ]),
      ),
    ).toThrow(/project.json/);
  });

  it("resolves all image locations relative to project.json, including AVIF and resources", () => {
    const ref = "./images/art.avif";
    const doc = {
      rows: [
        {
          objects: [
            { imageVariants: [{ image: ref }], addons: [{ styling: { addonBorderImage: ref } }] },
          ],
        },
      ],
      images: [{ id: "art", image: ref }],
      pointTypes: [{ negativeImage: ref }],
      viewerConfig: { loadingBgImage: ref },
    };
    inlineZipImages(
      doc,
      new Map([["export/images/art.avif", new Uint8Array([0, 1, 2])]]),
      "export/project.json",
    );
    const url = "data:image/avif;base64,AAEC";
    expect(doc.images[0].image).toBe(url);
    expect(doc.rows[0].objects[0].imageVariants[0].image).toBe(url);
    expect(doc.rows[0].objects[0].addons[0].styling.addonBorderImage).toBe(url);
    expect(doc.pointTypes[0].negativeImage).toBe(url);
    expect(doc.viewerConfig.loadingBgImage).toBe(url);
  });

  it("rejects a truncated ZIP", async () => {
    await expect(unzip(new ArrayBuffer(10))).rejects.toThrow(/valid zip/);
  });
});
