import { expect, it } from "vite-plus/test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrations } from "./migrations";
import { projectShares } from "./schema";

it("upgrades legacy sharing rows to Core's current schema without losing access", async () => {
  const db = new PGlite();
  try {
    await db.exec(migrations.find((migration) => migration.version === 3)!.sql);
    await db.exec(
      "INSERT INTO project_shares (id,resource_id,principal_type,principal_id,role,created_by,created_at) VALUES ('grant','project','user','peer@example.test','editor','owner@example.test','2026-09-12')",
    );
    const upgrade = migrations.find(
      (migration) => migration.name === "project-share-notification-state",
    )!;
    await db.exec(upgrade.sql);
    await db.exec(upgrade.sql);
    const [grant] = await drizzle(db).select().from(projectShares);
    expect(grant).toMatchObject({
      id: "grant",
      principalId: "peer@example.test",
      role: "editor",
      notifiedAt: null,
    });
  } finally {
    await db.close();
  }
});
