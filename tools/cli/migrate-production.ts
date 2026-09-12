import { closeDbExec, runMigrations, withMigrationRuntime } from "@agent-native/core/db";
import { runFrameworkReleaseMigrations } from "@agent-native/core/server";
import { migrations } from "../../server/db/migrations.js";

try {
  await withMigrationRuntime(async () => {
    await runFrameworkReleaseMigrations(null);
    await runMigrations(migrations, { table: "iccplus_migrations" })(null);
  });
} finally {
  await closeDbExec();
}
