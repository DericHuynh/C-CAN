import { afterEach, expect, it, vi } from "vite-plus/test";
import { getEvent, subscribe, unsubscribe } from "@agent-native/core/event-bus";
import { planningStatusChanged, projectCreated } from "./events.js";

const subscriptions: string[] = [];
afterEach(() => {
  subscriptions.splice(0).forEach(unsubscribe);
  vi.restoreAllMocks();
});
const ctx = { caller: "frontend" as const, userEmail: "editor@example.test", orgId: "org-a" };
function listen(event: string) {
  const handler = vi.fn();
  subscriptions.push(subscribe(event, handler));
  return handler;
}

it.each(["cyoa.project.created", "cyoa.planning.status-changed"])(
  "registers a discoverable typed trigger: %s",
  async (name) => {
    const event = getEvent(name)!;
    expect(event.description).toBeTruthy();
    expect(await event.payloadSchema["~standard"].validate(event.example)).not.toHaveProperty(
      "issues",
    );
    expect(await event.payloadSchema["~standard"].validate({ projectId: "p" })).toHaveProperty(
      "issues",
    );
  },
);

it("scopes project creation to the caller and omits project content", () => {
  const handler = listen("cyoa.project.created");
  projectCreated("new-project", "duplicate", ctx);
  expect(handler).toHaveBeenCalledWith(
    { projectId: "new-project", source: "duplicate", orgId: "org-a" },
    expect.objectContaining({ owner: ctx.userEmail, eventId: expect.any(String) }),
  );
});

it("emits status transitions with exact parent IDs and revision", () => {
  const handler = listen("cyoa.planning.status-changed");
  planningStatusChanged(
    "p",
    { rowId: "r", choiceId: "c", addonId: "a" },
    "draft",
    "review",
    2,
    false,
    ctx,
  );
  expect(handler).toHaveBeenCalledWith(
    {
      projectId: "p",
      rowId: "r",
      choiceId: "c",
      addonId: "a",
      orgId: "org-a",
      previousStatus: "draft",
      status: "review",
      revision: 2,
      applied: false,
    },
    expect.objectContaining({ owner: ctx.userEmail }),
  );
  planningStatusChanged("p", { rowId: "r" }, "review", "review", 3, false, ctx);
  expect(handler).toHaveBeenCalledOnce();
});

it("suppresses anonymous and automation-origin writes to avoid recursive jobs", () => {
  const created = listen("cyoa.project.created");
  const status = listen("cyoa.planning.status-changed");
  for (const caller of [
    undefined,
    { caller: "cli" as const },
    { ...ctx, caller: "automation" as const },
    { ...ctx, automation: { triggerId: "trigger", triggerName: "review" } },
  ]) {
    projectCreated("p", "create", caller);
    planningStatusChanged("p", { rowId: "r" }, "draft", "review", 1, false, caller);
  }
  expect(created).not.toHaveBeenCalled();
  expect(status).not.toHaveBeenCalled();
});

it("keeps committed work successful if a subscriber fails", () => {
  const handler = listen("cyoa.project.created");
  handler.mockImplementation(() => {
    throw new Error("subscriber unavailable");
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect(() => projectCreated("p", "create", ctx)).not.toThrow();
});
