import { eq } from "@agent-native/core/db/schema";
import { randomUUID } from "node:crypto";

import { getDb } from "./index.js";
import { projects } from "./schema.js";
import {
  createDefaultApp,
  createDefaultChoice,
  createDefaultPointType,
  createDefaultRow,
  createDefaultScore,
  summarizeApp,
} from "../../shared/cyoa.js";

/**
 * Idempotently seeds a demo CYOA project the first time the app boots with an
 * empty database, so the UI and the agent always have something to work with.
 * Called by `server/plugins/db.ts` AFTER migrations have created the tables.
 */
export async function seedIfEmpty(): Promise<void> {
  try {
    const db = getDb();
    const existing = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.isSeed, true))
      .limit(1);

    if (existing.length > 0) {
      return;
    }

    const app = createDefaultApp();
    app.viewerConfig.title = "Dungeon Delvers";

    const gold = createDefaultPointType(app, "Gold");
    gold.startingSum = 50;
    gold.beforeText = "Cost:";
    gold.afterText = "gold";
    app.pointTypes.push(gold);

    const mana = createDefaultPointType(app, "Mana");
    mana.startingSum = 20;
    mana.beforeText = "Cost:";
    mana.afterText = "mana";
    app.pointTypes.push(mana);

    // --- Row 1: Starting Kit -------------------------------------------------
    const row1 = createDefaultRow(app, 0);
    row1.title = "Starting Kit";
    row1.titleText = "Choose what to bring into the dungeon.";

    const torch = createDefaultChoice(app, 0);
    torch.title = "Torch";
    torch.text = "Sheds light in the dark. Costs 5 gold.";
    torch.scores.push(createDefaultScore(gold.id, -5));
    row1.objects.push(torch);

    const rope = createDefaultChoice(app, 1);
    rope.title = "Rope";
    rope.text = "Useful for climbing. Costs 3 gold.";
    rope.scores.push(createDefaultScore(gold.id, -3));
    row1.objects.push(rope);

    const potion = createDefaultChoice(app, 2);
    potion.title = "Healing Potion";
    potion.text = "Restores health. Costs 2 mana.";
    potion.scores.push(createDefaultScore(mana.id, -2));
    row1.objects.push(potion);

    app.rows.push(row1);

    // --- Row 2: Talents -------------------------------------------------------
    const row2 = createDefaultRow(app, 1);
    row2.title = "Talents";
    row2.titleText = "Pick your specialization.";

    const warrior = createDefaultChoice(app, 0);
    warrior.title = "Warrior";
    warrior.text = "Grants 20 bonus gold.";
    warrior.scores.push(createDefaultScore(gold.id, 20));
    row2.objects.push(warrior);

    const mage = createDefaultChoice(app, 1);
    mage.title = "Mage";
    mage.text = "Grants 10 bonus mana.";
    mage.scores.push(createDefaultScore(mana.id, 10));
    row2.objects.push(mage);

    const rogue = createDefaultChoice(app, 2);
    rogue.title = "Rogue";
    rogue.text = "Lucky escape. Costs 5 gold.";
    rogue.scores.push(createDefaultScore(gold.id, -5));
    row2.objects.push(rogue);

    app.rows.push(row2);

    const summary = summarizeApp(app);
    await db.insert(projects).values({
      id: randomUUID(),
      title: `Demo: ${summary.title}`,
      description:
        "A tiny sample CYOA created by the agent-native seed. Uses Gold and Mana point types. Chat with the agent to reshape it.",
      json: JSON.stringify(app),
      isSeed: true,
    });
  } catch (error) {
    // Seeding must never take down the app; failures are logged and ignored.
    console.error("[seed] failed to seed demo CYOA project:", error);
  }
}
