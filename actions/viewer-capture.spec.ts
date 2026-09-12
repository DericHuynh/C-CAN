import { beforeEach, expect, it, vi } from "vite-plus/test";
import sharp from "sharp";
import { assertAccess } from "@agent-native/core/sharing";
import { uploadFile } from "@agent-native/core/file-upload";
import {
  acceptViewerCapture,
  readViewerCapture,
  requestViewerCapture,
} from "../server/viewer/capture.js";
import { VIEWER_CAPTURE_TTL, type ViewerObservation } from "../shared/viewer-feedback.js";

const fixture = vi.hoisted(() => ({
  states: new Map<string, Record<string, unknown>>(),
  tokens: new Map<string, string>(),
  blobs: new Map<string, Buffer>(),
}));
vi.mock("@agent-native/core/application-state", () => ({
  compareAndSetAppState: vi.fn(
    async (key: string, expected: unknown, next: Record<string, unknown>) => {
      if (fixture.states.get(key) !== expected) return false;
      fixture.states.set(key, next);
      return true;
    },
  ),
  readAppState: vi.fn(async (key: string) => fixture.states.get(key) ?? null),
  writeAppState: vi.fn(async (key: string, value: Record<string, unknown>) => {
    fixture.states.set(key, value);
  }),
}));
vi.mock("@agent-native/core/secrets", () => ({
  encryptSecretValue: (value: string) => {
    const token = `sealed-${fixture.tokens.size}`;
    fixture.tokens.set(token, value);
    return token;
  },
  decryptSecretValue: (value: string) => {
    const decoded = fixture.tokens.get(value);
    if (!decoded) throw new Error("Invalid sealed value");
    return decoded;
  },
}));
vi.mock("@agent-native/core/sharing", () => ({ assertAccess: vi.fn() }));
vi.mock("@agent-native/core/file-upload", () => ({
  uploadFile: vi.fn(async ({ data }: { data: Buffer }) => {
    fixture.blobs.set("image.bin", data);
    return { provider: "local", id: "image.bin", url: "/uploads/image.bin" };
  }),
}));
vi.mock("../server/storage/local-uploads.js", () => ({
  readUploadedFile: vi.fn(async (id: string) => ({
    data: fixture.blobs.get(id)!,
    mimeType: "application/octet-stream",
  })),
}));
const ctx = { caller: "tool" as const, userEmail: "reviewer@local.test", orgId: "org-a" };
const nav = { projectId: "p", browserTabId: "tab-a", path: "/projects/p/viewer?rowId=r" };
const observation: ViewerObservation = {
  path: nav.path,
  width: 2,
  height: 2,
  visibleRowIds: ["r"],
  visibleChoiceIds: [],
  targetStatus: "visible",
  target: { rowId: "r" },
  selectedCount: 0,
  warnings: [],
};
let jpeg: Buffer;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.useRealTimers();
  fixture.states.clear();
  fixture.tokens.clear();
  fixture.blobs.clear();
  vi.mocked(assertAccess).mockResolvedValue(undefined as never);
  jpeg = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } })
    .jpeg()
    .toBuffer();
});

it("delivers a real image result while app state stores only a sealed reference", async () => {
  const request = await requestViewerCapture(nav, ctx);
  await acceptViewerCapture(request.token, jpeg, observation, ctx);
  const result = await readViewerCapture(request.requestId, nav.browserTabId, ctx);
  expect(result.status).toBe("ready");
  expect("_agentImages" in result && result._agentImages?.[0].data).toBe(jpeg.toString("base64"));
  expect(JSON.stringify([...fixture.states.values()])).not.toContain(jpeg.toString("base64"));
  expect(fixture.blobs.get("image.bin")?.toString()).not.toContain(jpeg.toString("base64"));
  expect(uploadFile).toHaveBeenCalledWith(
    expect.objectContaining({
      recordAsset: false,
      mimeType: "application/octet-stream",
      ownerEmail: ctx.userEmail,
    }),
  );
});

it("requires the original user and organization at both upload and image retrieval", async () => {
  const request = await requestViewerCapture(nav, ctx);
  for (const other of [
    { ...ctx, userEmail: "other@local.test" },
    { ...ctx, orgId: "org-b" },
  ]) {
    await expect(acceptViewerCapture(request.token, jpeg, observation, other)).rejects.toThrow(
      "another session",
    );
  }
  expect(uploadFile).not.toHaveBeenCalled();
  await acceptViewerCapture(request.token, jpeg, observation, ctx);
  await expect(
    readViewerCapture(request.requestId, nav.browserTabId, { ...ctx, orgId: "org-b" }),
  ).rejects.toThrow("another session");
});

it("rechecks revoked project access before revealing stored pixels", async () => {
  const request = await requestViewerCapture(nav, ctx);
  await acceptViewerCapture(request.token, jpeg, observation, ctx);
  vi.mocked(assertAccess).mockRejectedValue(new Error("Forbidden"));
  await expect(readViewerCapture(request.requestId, nav.browserTabId, ctx)).rejects.toThrow(
    "Forbidden",
  );
});

it("rejects forged references, expired requests, mismatched paths and oversized images", async () => {
  const request = await requestViewerCapture(nav, ctx);
  await expect(acceptViewerCapture("forged", jpeg, observation, ctx)).rejects.toThrow(
    "Invalid sealed",
  );
  await expect(
    acceptViewerCapture(
      request.token,
      jpeg,
      { ...observation, path: "/projects/other/viewer" },
      ctx,
    ),
  ).rejects.toThrow("viewer moved");
  await expect(
    acceptViewerCapture(request.token, new Uint8Array(1_400_001), observation, ctx),
  ).rejects.toThrow("too large");
  await expect(
    acceptViewerCapture(request.token, jpeg, { ...observation, width: 3 }, ctx),
  ).rejects.toThrow("dimensions");
  vi.spyOn(Date, "now").mockReturnValueOnce(Date.now() + VIEWER_CAPTURE_TTL + 1);
  await expect(acceptViewerCapture(request.token, jpeg, observation, ctx)).rejects.toThrow(
    "expired",
  );
  expect(uploadFile).not.toHaveBeenCalled();
});

it("separates tabs and rejects late uploads after a newer capture request", async () => {
  const old = await requestViewerCapture(nav, ctx);
  const current = await requestViewerCapture(nav, ctx);
  expect((await readViewerCapture(old.requestId, nav.browserTabId, ctx)).status).toBe("superseded");
  expect((await readViewerCapture(current.requestId, "other-tab", ctx)).status).toBe("superseded");
  await expect(acceptViewerCapture(old.token, jpeg, observation, ctx)).rejects.toThrow(
    "superseded",
  );
  await acceptViewerCapture(current.token, jpeg, observation, ctx);
  await expect(acceptViewerCapture(current.token, jpeg, observation, ctx)).rejects.toThrow(
    "already uploaded",
  );
});
