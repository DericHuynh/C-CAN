import { describe, expect, it } from "vite-plus/test";
import { createDefaultApp } from "@shared/cyoa";
import { applyViewerPreferences, parseViewerPreferences } from "./viewer-preferences";

describe("reader preferences", () => {
  it("accepts only player controls and clamps invalid dimensions and intervals", () => {
    expect(
      parseViewerPreferences({
        rows: [],
        objectsPerRow: "col-1",
        smallerScreenPx: -1,
        backPackWidth: 999999,
        buildAutoSaveInterval: 0,
        preloadImages: "true",
        cropperPosition: NaN,
      }),
    ).toEqual({ smallerScreenPx: 0, backPackWidth: 16384, buildAutoSaveInterval: 1 });
    expect(parseViewerPreferences(null)).toEqual({});
    expect(parseViewerPreferences([])).toEqual({});
  });

  it("changes presentation without mutating the author document or selection rules", () => {
    const app = createDefaultApp();
    const original = structuredClone(app);
    const result = applyViewerPreferences(app, {
      backPackWidth: 900,
      allowDeselect: true,
      isSingleFile: true,
      preloadImages: true,
    });
    expect(result.styling.backPackWidth).toBe(900);
    expect(result.viewerSettings?.allowDeselect).toBe(true);
    expect(result.viewerSettings?.isSingleFile).toBe(true);
    expect(result.preloadImages).toBe(true);
    expect(result.rows).toBe(app.rows);
    expect(result.pointTypes).toBe(app.pointTypes);
    expect(app).toEqual(original);
  });
});
