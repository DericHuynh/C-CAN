import { describe, expect, it } from "vite-plus/test";
import {
  createDefaultApp,
  createDefaultRow,
  createDefaultChoice,
  createDefaultAddon,
  normalizeApp,
} from "./cyoa";
import {
  planningEntries,
  planningDraft,
  planningKey,
  planningSearchText,
  planningUrl,
} from "./planning";

describe("planning outline", () => {
  it("uses stable IDs for rows, choices, and addons and preserves their data on roundtrip", () => {
    const app = createDefaultApp();
    const row = createDefaultRow(app, 0);
    const choice = createDefaultChoice(app, 0);
    const addon = createDefaultAddon(app);
    addon.planning = { title: "Conditional lore", notes: "Holy undead research", revision: 1 };
    choice.addons = [addon];
    row.objects = [choice];
    app.rows = [row];
    const entries = planningEntries(normalizeApp(JSON.parse(JSON.stringify(app))));
    expect(entries.map((entry) => entry.kind)).toEqual(["row", "choice", "addon"]);
    expect(entries[2].parentKey).toBe(entries[1].key);
    expect(planningSearchText(entries[2])).toContain("holy undead research");
    expect(planningDraft(entries[2]).title).toBe("Conditional lore");
    expect(planningKey({ rowId: "a:b", choiceId: "c" })).not.toBe(
      planningKey({ rowId: "a", choiceId: "b:c" }),
    );
  });
  it("encodes deep links without losing author-chosen IDs", () => {
    const target = { rowId: "row & one", choiceId: "choice/#", addonId: "addon ?" };
    const url = new URL(planningUrl("project/a", target, "rows"), "https://example.com");
    expect(url.pathname).toBe("/projects/project%2Fa/editor");
    for (const [key, value] of Object.entries(target))
      expect(url.searchParams.get(key)).toBe(value);
  });
  it("indexes a 3,000-choice document without copying prose into outline entry objects", () => {
    const app = createDefaultApp();
    app.rows = Array.from({ length: 375 }, (_, index) => {
      const row = createDefaultRow(app, index);
      row.objects = Array.from({ length: 8 }, (_, i) => {
        const choice = createDefaultChoice(app, i);
        choice.text = "Story content ".repeat(60);
        return choice;
      });
      return row;
    });
    const entries = planningEntries(app);
    expect(entries).toHaveLength(3375);
    expect(entries[1].entity).toBe(app.rows[0].objects[0]);
    expect(planningSearchText(entries[1])).toContain("story content");
  });
});
