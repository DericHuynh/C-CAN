import { expect, it } from "vite-plus/test";
import { createDefaultApp, createDefaultChoice, createDefaultRow } from "./cyoa.js";
import {
  ballotSchema,
  explorerFiltersFromParams,
  normalizeTags,
  publicationMatch,
  publicDocument,
  summarizeRatings,
} from "./publications.js";
const item = {
  title: "Crystal Kingdom",
  author: "Example creator",
  description: "A magical forest adventure",
  tags: ["fantasy"],
};
it("matches typos and adjacent transpositions while requiring every query word", () => {
  expect(publicationMatch("crsytal kingdm", item)).not.toBeNull();
  expect(publicationMatch("fant", item)).not.toBeNull();
  expect(publicationMatch("crystal space", item)).toBeNull();
  expect(publicationMatch("crystal", item)).toBeLessThan(publicationMatch("crsytal", item)!);
});
it("normalizes and deduplicates public tags", () => {
  expect(normalizeTags(["Fantasy", " fantasy ", "Ｓｐａｃｅ"])).toEqual(["fantasy", "space"]);
});
it("keeps overall independent, counts zero and excludes omitted categories", () => {
  const scores = summarizeRatings([
    { overall: 0, writing: 5, gameplay: 5, presentation: null },
    { overall: 2, writing: null, gameplay: 1, presentation: null },
  ]);
  expect(scores.overall).toEqual({ count: 2, average: 1, distribution: [1, 0, 1, 0, 0, 0] });
  expect(scores.writing.average).toBe(5);
  expect(scores.presentation).toEqual({
    count: 0,
    average: null,
    distribution: [0, 0, 0, 0, 0, 0],
  });
  expect(ballotSchema.safeParse({ overall: 5.1 }).success).toBe(false);
  expect(ballotSchema.safeParse({ overall: -1 }).success).toBe(false);
  expect(ballotSchema.safeParse({ writing: 5 }).success).toBe(false);
});
it("strips nested planning drafts without altering the saved authoring document", () => {
  const app = createDefaultApp();
  const row = createDefaultRow(app, 0),
    choice = createDefaultChoice(app, 0);
  Object.assign(row, { planning: { notes: "Private row note" } });
  Object.assign(choice, { planning: { draft: "Private unpublished text" } });
  row.objects = [choice];
  app.rows = [row];
  const release = publicDocument(app);
  expect(JSON.stringify(release)).not.toContain("Private");
  expect(JSON.stringify(app)).toContain("Private");
  expect(release.rows[0].objects[0].id).toBe(choice.id);
});

it("retains valid Explorer filters when a URL field is invalid", () => {
  expect(
    explorerFiltersFromParams(
      new URLSearchParams(
        "q=crystal&content=nsfw&tag=fantasy&excludeTag=space&page=invalid&sort=rating",
      ),
    ),
  ).toEqual({
    query: "crystal",
    content: "nsfw",
    tags: ["fantasy"],
    excludeTags: ["space"],
    page: 1,
    sort: "rating",
  });
  expect(
    explorerFiltersFromParams(new URLSearchParams("q=crystal&content=unknown&page=2")).query,
  ).toBe("crystal");
});
