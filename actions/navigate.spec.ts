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
