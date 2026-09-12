import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { seedIfEmpty } from "../db/seed.js";
import initialize from "./db.js";

const { migrate } = vi.hoisted(() => ({ migrate: vi.fn() }));
vi.mock("@agent-native/core/db", () => ({ runMigrations: () => migrate }));
vi.mock("../db/seed.js", () => ({ seedIfEmpty: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => vi.unstubAllEnvs());

it("runs migrations without creating demo projects in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  await initialize({} as never);
  expect(migrate).toHaveBeenCalledOnce();
  expect(seedIfEmpty).not.toHaveBeenCalled();
});

it("waits for migrations before creating the local development example", async () => {
  vi.stubEnv("NODE_ENV", "development");
  migrate.mockImplementationOnce(async () => {
    expect(seedIfEmpty).not.toHaveBeenCalled();
  });
  await initialize({} as never);
  expect(seedIfEmpty).toHaveBeenCalledOnce();
});
