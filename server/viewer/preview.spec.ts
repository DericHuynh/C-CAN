import { beforeEach, afterEach, expect, it, vi } from "vite-plus/test";
import { previewProject } from "./preview";
import {
  readAppState,
  readAppStateForCurrentTab,
  writeAppStateForCurrentTab,
} from "@agent-native/core/application-state";
import { getProjectOrThrow, newProjectRow } from "../projects/repository";
import { projectRevision } from "../projects/revision";
import { requestViewerCapture, readViewerCapture } from "./capture";
import { normalizeApp } from "../../shared/cyoa";
vi.mock("@agent-native/core/application-state", () => ({
  readAppState: vi.fn(),
  readAppStateForCurrentTab: vi.fn(),
  writeAppStateForCurrentTab: vi.fn(),
}));
vi.mock("../projects/repository", async (original) => ({
  ...(await original<typeof import("../projects/repository")>()),
  getProjectOrThrow: vi.fn(),
}));
vi.mock("./capture", () => ({ requestViewerCapture: vi.fn(), readViewerCapture: vi.fn() }));
const app = normalizeApp({
  rows: [{ id: "r", title: "Intro", objects: [{ id: "c", addons: [{ id: "a" }] }] }],
});
const json = JSON.stringify(app),
  ctx = { userEmail: "viewer@local.test", caller: "tool" as const };
let path = "",
  status = "visible",
  revision = projectRevision(json);
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  path = "";
  status = "visible";
  revision = projectRevision(json);
  vi.mocked(getProjectOrThrow).mockResolvedValue({ app, row: newProjectRow({ id: "p", json }) });
  vi.mocked(readAppStateForCurrentTab).mockResolvedValue({ browserTabId: "tab", view: "chat" });
  vi.mocked(writeAppStateForCurrentTab).mockImplementation(async (_key, value) => {
    path = String(value.path);
  });
  vi.mocked(readAppState).mockImplementation(async (key) =>
    key.startsWith("navigation")
      ? { view: "chat" }
      : {
          projectId: "p",
          path,
          documentRevision: revision,
          width: 800,
          height: 600,
          visibleRowIds: ["r"],
          visibleChoiceIds: ["c"],
          targetStatus: status,
          selectedCount: 0,
          warnings: [],
        },
  );
  vi.mocked(requestViewerCapture).mockResolvedValue({
    requestId: "request",
    browserTabId: "tab",
  } as never);
  vi.mocked(readViewerCapture).mockResolvedValue({
    status: "ready",
    requestId: "request",
    _agentImages: [{ data: "pixels", mediaType: "image/jpeg" }],
  } as never);
});
afterEach(() => vi.useRealTimers());
it("opens from chat, infers parents, checks the saved revision and returns pixels", async () => {
  const pending = previewProject({ projectId: "p", addonId: "a", buildCode: "" }, ctx);
  await vi.runAllTimersAsync();
  const result = await pending;
  expect(result.status).toBe("ready");
  expect(result).toHaveProperty("_agentImages");
  expect(path).toContain("/projects/p/viewer?rowId=r&choiceId=c&addonId=a&preview=");
  expect(path).toContain("buildCode=");
  expect(requestViewerCapture).toHaveBeenCalledWith(
    expect.objectContaining({ projectId: "p", documentRevision: revision }),
    ctx,
  );
});
it("never captures stale documents or hidden targets", async () => {
  revision = "stale";
  const pending = previewProject({ projectId: "p" }, ctx);
  await vi.runAllTimersAsync();
  expect(await pending).toMatchObject({ status: "pending", reason: "viewer-stale" });
  revision = projectRevision(json);
  status = "hidden";
  const hidden = previewProject({ projectId: "p", addonId: "a" }, ctx);
  await vi.runAllTimersAsync();
  expect(await hidden).toMatchObject({ status: "unavailable", reason: "target-hidden-or-locked" });
  expect(requestViewerCapture).not.toHaveBeenCalled();
});
it("reports an unavailable browser and rejects conflicting parents before navigation", async () => {
  vi.mocked(readAppStateForCurrentTab).mockResolvedValue(null);
  expect(await previewProject({ projectId: "p" }, ctx)).toMatchObject({
    reason: "browser-tab-unavailable",
  });
  await expect(
    previewProject({ projectId: "p", rowId: "absent", addonId: "a" }, ctx),
  ).rejects.toThrow();
  expect(writeAppStateForCurrentTab).not.toHaveBeenCalled();
});
