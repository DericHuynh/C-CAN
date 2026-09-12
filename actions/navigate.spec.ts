import { beforeEach, expect, it, vi } from "vite-plus/test";
import { writeAppStateForCurrentTab } from "@agent-native/core/application-state";
import context from "./get-project-context.js";
import navigate from "./navigate.js";

vi.mock("@agent-native/core/application-state", () => ({ writeAppStateForCurrentTab: vi.fn() }));
vi.mock("./get-project-context.js", () => ({
  default: { run: vi.fn(async () => ({ missing: [] })) },
}));
const ctx = { userEmail: "viewer@local.test", caller: "tool" as const };
beforeEach(() => vi.clearAllMocks());

it("validates the target and writes a canonical tab-scoped deep link", async () => {
  await navigate.run({ projectId: "p", rowId: "r & 1", choiceId: "c#2", addonId: "a" }, ctx);
  expect(context.run).toHaveBeenCalledWith(
    expect.objectContaining({ projectId: "p", choiceId: "c#2" }),
    ctx,
  );
  expect(writeAppStateForCurrentTab).toHaveBeenCalledWith(
    "navigate",
    expect.objectContaining({ path: "/projects/p/viewer?rowId=r+%26+1&choiceId=c%232&addonId=a" }),
  );
});
it("does not navigate when the target is missing or access is denied", async () => {
  vi.mocked(context.run).mockRejectedValueOnce(new Error("Forbidden"));
  await expect(navigate.run({ projectId: "p" }, ctx)).rejects.toThrow("Forbidden");
  vi.mocked(context.run).mockResolvedValueOnce({ missing: ["choice"] } as never);
  await expect(navigate.run({ projectId: "p", choiceId: "absent" }, ctx)).rejects.toThrow(
    "Unknown target",
  );
  expect(writeAppStateForCurrentTab).not.toHaveBeenCalled();
});
it.each(["https://example.com", "//example.com", "/\\example.com", "/projects\n"])(
  "rejects nonlocal or malformed navigation: %s",
  async (path) => {
    await expect(navigate.run({ path }, ctx)).rejects.toThrow("app-local");
    expect(writeAppStateForCurrentTab).not.toHaveBeenCalled();
  },
);
it("accepts generated targets and rejects conflicting inputs before execution", async () => {
  const result = await navigate.run({ target: { projectId: "p", addonId: "a" } }, ctx);
  expect(result.resolvedUrl).toBe("/projects/p/viewer?addonId=a");
  vi.clearAllMocks();
  await expect(
    navigate.run({ path: "/projects/p/viewer", target: { projectId: "p" } }, ctx),
  ).rejects.toThrow(/conflicted/);
  await expect(
    navigate.run({ projectId: "other", target: { projectId: "p" } }, ctx),
  ).rejects.toThrow(/conflicted/);
  expect(writeAppStateForCurrentTab).not.toHaveBeenCalled();
});
it("returns the actual resolved chat and team URLs", async () => {
  expect((await navigate.run({ view: "chat" }, ctx)).resolvedUrl).toBe("/");
  expect((await navigate.run({ view: "team" }, ctx)).resolvedUrl).toBe("/settings/organization");
});
