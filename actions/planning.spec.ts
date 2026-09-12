import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  createDefaultApp,
  createDefaultRow,
  createDefaultChoice,
  createDefaultAddon,
} from "../shared/cyoa.js";
import { planningDraft, planningEntries } from "../shared/planning.js";
import { getProjectOrThrow, saveProject } from "./_project-store.js";
import update from "./update-planning-entry.js";
import read from "./get-project-plan.js";
import { planningStatusChanged } from "../server/agent/project-events.js";

vi.mock("../server/agent/project-events.js", () => ({ planningStatusChanged: vi.fn() }));

vi.mock("./_project-store.js", () => ({
  getProjectOrThrow: vi.fn(),
  saveProject: vi.fn(),
  assertFound: (value: unknown, message: string) => {
    if (!value) throw new Error(message);
  },
}));
function fixture() {
  const app = createDefaultApp();
  const row = createDefaultRow(app, 0);
  row.title = "The Undead";
  const choice = createDefaultChoice(app, 0);
  choice.title = "Wisdom Focused";
  choice.text = "Original prose";
  const addon = createDefaultAddon(app);
  addon.title = "Lich alternative";
  addon.text = "Original addon";
  choice.addons = [addon];
  row.objects = [choice];
  app.rows = [row];
  vi.mocked(getProjectOrThrow).mockResolvedValue({ app, row: { json: "original-json" } } as never);
  return {
    app,
    row,
    choice,
    addon,
    args: {
      projectId: "project-test",
      rowId: row.id,
      choiceId: choice.id,
      expectedRevision: 0,
      patch: {},
      applyToContent: false,
      resetTextToCurrent: false,
    },
  };
}
beforeEach(() => vi.resetAllMocks());
describe("integrated planning actions", () => {
  it("publishes a status transition only after saving under the caller's editor access", async () => {
    const { args } = fixture();
    const ctx = { caller: "tool" as const, userEmail: "editor@example.test", orgId: "org-a" };
    vi.mocked(saveProject).mockImplementationOnce(async () => {
      expect(planningStatusChanged).not.toHaveBeenCalled();
      return "updated";
    });
    await update.run({ ...args, patch: { status: "review" } }, ctx);
    expect(getProjectOrThrow).toHaveBeenCalledWith(args.projectId, ctx, "editor");
    expect(planningStatusChanged).toHaveBeenCalledWith(
      args.projectId,
      { rowId: args.rowId, choiceId: args.choiceId },
      "draft",
      "review",
      1,
      false,
      ctx,
    );
  });

  it("does not publish status changes when durable saving fails", async () => {
    const { args } = fixture();
    vi.mocked(saveProject).mockRejectedValueOnce(new Error("Conflict"));
    await expect(update.run({ ...args, patch: { status: "review" } })).rejects.toThrow("Conflict");
    expect(planningStatusChanged).not.toHaveBeenCalled();
  });
  it("saves drafts without modifying playable prose or mechanics", async () => {
    const { args, choice } = fixture();
    const result = await update.run({
      ...args,
      patch: { text: "Draft prose", mechanics: "NOT Cursed", notes: "Review lore" },
    });
    expect(choice.text).toBe("Original prose");
    expect(result.draft).toMatchObject({
      text: "Draft prose",
      revision: 1,
      baseText: "Original prose",
    });
    expect(saveProject).toHaveBeenCalledWith("project-test", expect.anything(), "original-json");
  });
  it("applies draft title and prose while preserving notes, IDs, and configured rules", async () => {
    const { args, choice } = fixture();
    const requireds = choice.requireds;
    await update.run({
      ...args,
      patch: { text: "Draft prose", title: "New title", mechanics: "Cost 4" },
    });
    await update.run({ ...args, expectedRevision: 1, applyToContent: true });
    expect(choice).toMatchObject({ id: args.choiceId, title: "New title", text: "Draft prose" });
    expect(choice.requireds).toBe(requireds);
    expect(choice.planning).toMatchObject({
      baseText: "Draft prose",
      mechanics: "Cost 4",
      revision: 2,
    });
  });
  it("rejects stale draft revisions", async () => {
    const { args } = fixture();
    await update.run({ ...args, patch: { notes: "Another author" } });
    await expect(update.run({ ...args, patch: { notes: "Stale editor" } })).rejects.toThrow(
      /changed elsewhere/,
    );
    expect(saveProject).toHaveBeenCalledOnce();
  });
  it("protects live text changed after drafting, including before the first save", async () => {
    const { args, choice } = fixture();
    choice.text = "Changed elsewhere";
    await expect(
      update.run({
        ...args,
        base: { title: choice.title, text: "Original prose" },
        patch: { text: "My draft" },
        applyToContent: true,
      }),
    ).rejects.toThrow(/Live text changed/);
    expect(saveProject).not.toHaveBeenCalled();
    expect(choice.text).toBe("Changed elsewhere");
  });
  it("can restart from current text while keeping planning notes", async () => {
    const { args, choice } = fixture();
    await update.run({ ...args, patch: { text: "Draft prose", imageNotes: "Candidate source" } });
    choice.text = "New live prose";
    const result = await update.run({ ...args, expectedRevision: 1, resetTextToCurrent: true });
    expect(result.draft).toMatchObject({
      text: "New live prose",
      baseText: "New live prose",
      imageNotes: "Candidate source",
    });
  });
  it("drafts an addon independently from its parent choice", async () => {
    const { args, addon, choice } = fixture();
    await update.run({ ...args, addonId: addon.id, patch: { text: "Conditional lore" } });
    expect(addon.planning.text).toBe("Conditional lore");
    expect(addon.text).toBe("Original addon");
    expect(choice.planning).toBeUndefined();
  });
  it("reads bounded summaries, searches notes, and opens only one full draft", async () => {
    const { args, app } = fixture();
    await update.run({ ...args, patch: { notes: "Lore research marker" } });
    const result = await read.run({
      projectId: args.projectId,
      offset: 0,
      limit: 1,
      query: "research marker",
      rowId: args.rowId,
      choiceId: args.choiceId,
    });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).not.toHaveProperty("text");
    expect(result.entry!.draft.notes).toBe("Lore research marker");
    expect(result.entry!.draft).toEqual(planningDraft(planningEntries(app)[1]));
  });
});
