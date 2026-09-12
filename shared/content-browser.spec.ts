import { describe, it, expect } from "vite-plus/test";
import {
  describeContent,
  filterContent,
  emptyContentFilter,
  type ContentFilter,
} from "./content-browser";
const items = [
  {
    id: "a",
    name: "Forest portrait",
    tags: ["forest", "safe"],
    image: "image-a",
    createdAt: "2026-09-01T12:00:00Z",
    description: "A quiet dawn",
  },
  {
    id: "b",
    name: "Night portrait",
    tags: ["night"],
    createdAt: "2026-09-10T12:00:00Z",
    requireds: [{ reqId: "a" }],
  },
  { id: "c", name: "Legacy portrait", tags: ["forest"], image: "data:image/png;base64,SECRET" },
];
const entries = items.map((item, index) => ({ item, index, meta: describeContent(item, index) }));
const ids = (filter: Partial<ContentFilter>) =>
  filterContent(entries, { ...emptyContentFilter, ...filter }).map((e) => e.item.id);
describe("content browsing", () => {
  it("searches prose, fuzzy names, exact phrases, exclusions and tags", () => {
    expect(ids({ query: '"quiet dawn"' })).toEqual(["a"]);
    expect(ids({ query: "foerst -legacy" })).toEqual(["a"]);
    expect(ids({ query: "portrait tag:forest -legacy" })).toEqual(["a"]);
    expect(ids({ query: '"quiet down"' })).toEqual([]);
    expect(ids({ query: "SECRET" })).toEqual([]);
  });
  it("combines filters and excludes undated imports only when dates are required", () => {
    expect(ids({ tag: "forest", has: "image" })).toEqual(["a", "c"]);
    expect(ids({ from: "2026-09-02", to: "2026-09-12" })).toEqual(["b"]);
    expect(ids({ has: "requirements" })).toEqual(["b"]);
    expect(ids({ has: "no-image" })).toEqual(["b"]);
  });
  it("sorts without modifying document order or losing original mutation indexes", () => {
    expect(ids({ sort: "name" })).toEqual(["a", "c", "b"]);
    expect(ids({ sort: "newest" })).toEqual(["b", "a", "c"]);
    expect(filterContent(entries, { ...emptyContentFilter, query: "night" })[0].index).toBe(1);
    expect(entries.map((e) => e.item.id)).toEqual(["a", "b", "c"]);
  });
  it("indexes word replacements, nested addon prose and variable state", () => {
    expect(describeContent({ id: "word", replaceText: "Moonlight" }, 0).text).toContain(
      "moonlight",
    );
    expect(describeContent({ objects: [{ addons: [{ text: "Moonlight" }] }] }, 0).text).toContain(
      "moonlight",
    );
    expect(describeContent({ isTrue: false }, 0).type).toBe("False");
    expect(
      describeContent({ createdAt: 17, tags: "bad", objects: [null] }, 0).createdAt,
    ).toBeUndefined();
  });
});
