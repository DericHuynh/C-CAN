import { readdirSync } from "node:fs";
import { expect, it, vi } from "vite-plus/test";

// Framework discovery imports scripts to inspect their exports. Importing a
// maintenance CLI must never migrate/close the live database or create content.
const getDb = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("Database accessed during script discovery");
  }),
);
vi.mock("../server/db/index.js", () => ({ getDb }));
vi.mock("@agent-native/core/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@agent-native/core/db")>()),
  closeDbExec: () => {
    throw new Error("Database closed during script discovery");
  },
  runMigrations: () => {
    throw new Error("Migrations invoked during script discovery");
  },
}));
const scripts = readdirSync(new URL("../scripts/", import.meta.url)).filter(
  (name) => name.endsWith(".ts") && !name.endsWith(".spec.ts"),
);
for (const file of scripts) {
  it(`discovers ${file} without executing it`, async () => {
    const script = await import(`../scripts/${file.slice(0, -3)}.ts`);
    expect(script.default).toBeTypeOf("function");
    expect(getDb).not.toHaveBeenCalled();
  }, 15000);
}
