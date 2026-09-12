import { describe, expect, it } from "vite-plus/test";
import * as Y from "yjs";
import { createLiveFields } from "./live-fields";

function peers() {
  const a = new Y.Doc(),
    b = new Y.Doc();
  const left = createLiveFields(a),
    right = createLiveFields(b);
  const sync = () => {
    const fromA = Y.encodeStateAsUpdate(a),
      fromB = Y.encodeStateAsUpdate(b);
    Y.applyUpdate(a, fromB, "remote");
    Y.applyUpdate(b, fromA, "remote");
  };
  return { a, b, left, right, sync };
}
describe("live project fields", () => {
  const path = ["rows", "opening", "title"];
  it("merges simultaneous first-keystroke edits without duplicating the seed", () => {
    const { left, right, sync } = peers();
    left.write(path, "Hello world", "Hello brave world");
    right.write(path, "Hello world", "Hello world!");
    sync();
    expect(left.read(path, "Hello world")).toBe("Hello brave world!");
    expect(right.read(path, "Hello world")).toBe("Hello brave world!");
  });
  it("preserves independent edits inside addons, including concurrent first open", () => {
    const { left, right, sync } = peers();
    const base = [
      { id: "a", text: "First" },
      { id: "b", text: "Second" },
    ];
    left.write(["$choices", "c", "addons"], base, [{ ...base[0], text: "First!" }, base[1]]);
    right.write(["$choices", "c", "addons"], base, [base[0], { ...base[1], text: "Second!" }]);
    sync();
    expect(left.read(["$choices", "c", "addons"], base)).toEqual([
      { id: "a", text: "First!" },
      { id: "b", text: "Second!" },
    ]);
    expect(right.read(["$choices", "c", "addons"], base)).toEqual(
      left.read(["$choices", "c", "addons"], base),
    );
  });
  it("previews only the matching saved generation and never resurrects deleted content", () => {
    const { left } = peers();
    const original = { rows: [{ id: "opening", title: "Original" }], images: [] };
    left.write(path, "Original", "Draft");
    expect(left.preview(original).rows[0].title).toBe("Draft");
    expect(original.rows[0].title).toBe("Original");
    expect(left.preview(original).images).toBe(original.images);
    expect(left.preview({ rows: [] })).toEqual({ rows: [] });
    expect(
      left.preview({ rows: [{ id: "opening", title: "Agent replacement" }] }).rows[0].title,
    ).toBe("Agent replacement");
  });
  it("keeps newer keystrokes when an earlier submitted save completes", () => {
    const { left, right, sync } = peers();
    left.write(path, "Original", "Submitted plus more typing");
    left.acknowledge(
      { rows: [{ id: "opening", title: "Original" }] },
      { rows: [{ id: "opening", title: "Submitted" }] },
    );
    sync();
    expect(right.read(path, "Submitted")).toBe("Submitted plus more typing");
  });
  it("restores live text from persisted Yjs state", () => {
    const { a, left } = peers();
    left.write(path, "Original", "Typed without clicking Save");
    const reconnected = new Y.Doc();
    Y.applyUpdate(reconnected, Y.encodeStateAsUpdate(a));
    const restored = createLiveFields(reconnected);
    expect(restored.read(path, "Original")).toBe("Typed without clicking Save");
  });
  it("autosaves only local edits, including valid numeric drafts, and keeps incomplete inputs local", () => {
    const { left, right, sync } = peers();
    left.write(["rows", "r", "title"], "Before", "After");
    left.write(["$draft", "rows", "r", "allowedChoices"], "0", "-");
    sync();
    const app = { rows: [{ id: "r", title: "Before", allowedChoices: 0 }] };
    expect(left.pending(app)).toEqual([
      { path: ["rows", "r", "title"], base: "Before", value: "After" },
    ]);
    expect(right.pending(app)).toEqual([]);
    left.write(["$draft", "rows", "r", "allowedChoices"], "0", "3");
    expect(left.pending(app)).toContainEqual({
      path: ["rows", "r", "allowedChoices"],
      base: 0,
      value: 3,
    });
  });
  it("reuses the shared text across repeated autosaves", () => {
    const { a, left } = peers();
    for (let i = 0; i < 20; i++) {
      left.write(path, String(i), String(i + 1));
      left.acknowledge(
        { rows: [{ id: "opening", title: String(i) }] },
        { rows: [{ id: "opening", title: String(i + 1) }] },
      );
    }
    expect(left.read(path, "20")).toBe("20");
    expect(a.getMap("cyoa-live-fields-v1").size).toBe(1);
  });
  it("keeps binary media out of collaboration storage", () => {
    const { a, left } = peers();
    expect(
      left.write(
        ["images", "i", "image"],
        "https://example.test/image.webp",
        "data:image/png;base64,AAAA",
      ),
    ).toBe(false);
    expect(a.getMap("cyoa-live-fields-v1").size).toBe(0);
  });
  it("reconciles a clean agent replacement before the next human keystroke", () => {
    const { left, right, sync } = peers();
    left.write(path, "Before", "Saved");
    left.acknowledge(
      { rows: [{ id: "opening", title: "Before" }] },
      { rows: [{ id: "opening", title: "Saved" }] },
    );
    sync();
    left.reconcileSaved(
      { rows: [{ id: "opening", title: "Saved" }] },
      { rows: [{ id: "opening", title: "Agent text" }] },
    );
    sync();
    left.write(path, "Agent text", "AAgent text");
    right.write(path, "Agent text", "Agent textB");
    sync();
    expect(left.read(path, "Agent text")).toBe("AAgent textB");
    expect(right.read(path, "Agent text")).toBe("AAgent textB");
  });
  it("does not reconcile agent text over an uncommitted human draft", () => {
    const { left } = peers();
    left.write(path, "Before", "Human draft");
    left.reconcileSaved(
      { rows: [{ id: "opening", title: "Before" }] },
      { rows: [{ id: "opening", title: "Agent text" }] },
    );
    expect(left.read(path, "Before")).toBe("Human draft");
    expect(left.has(path, "Agent text")).toBe(false);
  });
  it("never publishes updates from a read-only collaborator", () => {
    const doc = new Y.Doc(),
      readOnly = createLiveFields(doc, false);
    expect(readOnly.write(path, "Before", "Forbidden")).toBe(false);
    expect(doc.getMap("cyoa-live-fields-v1").size).toBe(0);
  });
  it("keeps surrogate pairs intact when replacing emoji", () => {
    const { left, right, sync } = peers();
    left.write(path, "A😀Z", "A😁Z");
    sync();
    expect(right.read(path, "A😀Z")).toBe("A😁Z");
  });
});
