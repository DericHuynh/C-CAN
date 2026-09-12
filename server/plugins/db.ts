import { runMigrations } from "@agent-native/core/db";
import { seedIfEmpty } from "../db/seed.js";
import { migrations } from "../db/migrations.js";
export { migrations } from "../db/migrations.js";

const migrationsPlugin = runMigrations(migrations, { table: "iccplus_migrations" });

/**
 * Compose migrations + demo seeding in one plugin: Nitro runs plugins
 * concurrently, so a standalone seed plugin could race the migration that
 * creates the `projects` table. Running the seed after awaiting the
 * migrations guarantees the table exists.
 */
export default async (nitroApp: Parameters<typeof migrationsPlugin>[0]) => {
  await migrationsPlugin(nitroApp);
  if (process.env.NODE_ENV !== "production") await seedIfEmpty();
};
