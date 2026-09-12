import { describe, expect, it } from "vite-plus/test";
import { CollaborationConflict, mergeCollaborativeValue as merge } from "./collaboration-merge";

describe("structured collaboration", () => {
  it("merges separate fields and preserves unknown imported fields", () => {
    const base = {
      title: "Original",
      styling: { color: "red", size: 12 },
      extension: { enabled: true },
    };
    expect(
      merge(base, { ...base, title: "Local" }, { ...base, styling: { color: "blue", size: 12 } }),
    ).toEqual({ ...base, title: "Local", styling: { color: "blue", size: 12 } });
  });
  it("merges separate addons by stable ID even when another editor reorders them", () => {
    const base = [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ];
    expect(
      merge(
        base,
        [{ ...base[0], text: "Local" }, base[1]],
        [{ ...base[1], text: "Remote" }, base[0]],
      ),
    ).toEqual([
      { id: "b", text: "Remote" },
      { id: "a", text: "Local" },
    ]);
  });
  it("preserves simultaneous additions and independent deletions", () => {
    const base = [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ];
    expect(
      merge(base, [base[0], { id: "c", text: "C" }], [...base, { id: "d", text: "D" }]),
    ).toEqual([base[0], { id: "d", text: "D" }, { id: "c", text: "C" }]);
  });
  it("rejects deleting a remotely edited entity instead of resurrecting it", () => {
    const base = [{ id: "a", text: "A" }];
    expect(() => merge(base, [], [{ id: "a", text: "Edited" }])).toThrow(CollaborationConflict);
  });
  it("does not guess identities for duplicate IDs or anonymous requirements", () => {
    for (const base of [
      [
        { id: "a", text: "A" },
        { id: "a", text: "B" },
      ],
      [{ text: "A" }, { text: "B" }],
    ]) {
      expect(() =>
        merge(
          base,
          [{ ...base[0], text: "Local" }, base[1]],
          [base[0], { ...base[1], text: "Remote" }],
        ),
      ).toThrow(CollaborationConflict);
    }
  });
  it("rebases drafts around conflicting fields without dropping unrelated shared changes", () => {
    const conflicts: string[] = [];
    expect(
      merge(
        { title: "A", text: "B" },
        { title: "Local", text: "B" },
        { title: "Remote", text: "C" },
        "",
        (path) => conflicts.push(path),
      ),
    ).toEqual({ title: "Local", text: "C" });
    expect(conflicts).toEqual(["title"]);
  });
  it("keeps category types distinct when their numeric slots match", () => {
    const base = [
      { idx: 0, type: "word", name: "Words" },
      { idx: 0, type: "variable", name: "Flags" },
    ];
    expect(
      merge(
        base,
        [{ ...base[0], name: "Names" }, base[1]],
        [base[0], { ...base[1], name: "Switches" }],
      ),
    ).toEqual([
      { ...base[0], name: "Names" },
      { ...base[1], name: "Switches" },
    ]);
  });
});
