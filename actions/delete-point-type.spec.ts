import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  createDefaultAddon,
  createDefaultApp,
  createDefaultChoice,
  createDefaultPointType,
  createDefaultRow,
  createDefaultScore,
} from "../shared/cyoa.js";
import { getProjectOrThrow, saveProject } from "./_project-store.js";
import deletePointType from "./delete-point-type.js";

vi.mock("./_project-store.js", () => ({
  getProjectOrThrow: vi.fn(),
  saveProject: vi.fn(),
  assertFound: (value: unknown, message: string) => {
    if (!value) throw new Error(message);
  },
}));

beforeEach(() => vi.clearAllMocks());

describe("delete-point-type", () => {
  it("removes referencing scores from choices and addons in both normal and backpack rows", async () => {
    const app = createDefaultApp();
    const deleted = createDefaultPointType(app, "Deleted currency");
    const kept = createDefaultPointType(app, "Kept currency");
    app.pointTypes = [deleted, kept];
    const makeRow = () => {
      const row = createDefaultRow(app, 0);
      const choice = createDefaultChoice(app, 0);
      const addon = {
        ...createDefaultAddon(app),
        parentId: choice.id,
        isSelectable: true as const,
        groups: [],
        multipleUseVariable: 0,
        isActive: false,
        scores: [createDefaultScore(deleted.id), createDefaultScore(kept.id)],
      };
      choice.scores = [createDefaultScore(deleted.id), createDefaultScore(kept.id)];
      choice.addons = [addon];
      row.objects = [choice];
      return row;
    };
    app.rows = [makeRow()];
    app.backpack = [makeRow()];
    vi.mocked(getProjectOrThrow).mockResolvedValue({ app } as Awaited<
      ReturnType<typeof getProjectOrThrow>
    >);

    await deletePointType.run({ projectId: "project-test", pointTypeId: deleted.id });

    expect(app.pointTypes).toEqual([kept]);
    for (const row of [...app.rows, ...app.backpack]) {
      const choice = row.objects[0];
      expect(choice.scores.map((score) => score.id)).toEqual([kept.id]);
      expect(choice.addons[0].scores.map((score: { id: string }) => score.id)).toEqual([kept.id]);
    }
    expect(saveProject).toHaveBeenCalledExactlyOnceWith("project-test", app);
  });
});
