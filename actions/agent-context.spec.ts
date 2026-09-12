import { beforeEach, expect, it, vi } from "vite-plus/test";
import { readAppState } from "@agent-native/core/application-state";
import { queryAuditEvents } from "@agent-native/core/audit";
import { assertAccess } from "@agent-native/core/sharing";
import { createDefaultApp, createDefaultChoice, createDefaultRow } from "../shared/cyoa.js";
import { getProjectOrThrow, newProjectRow } from "../server/projects/repository.js";
import context from "./get-project-context.js";
import viewScreen from "./view-screen.js";
import changes from "./list-project-changes.js";
import { projectAudit } from "../server/projects/audit.js";

vi.mock("@agent-native/core/application-state", () =>
  (() => {
    const read = vi.fn();
    return { readAppState: read, readAppStateForCurrentTab: read };
  })(),
);
vi.mock("@agent-native/core/audit", () => ({ queryAuditEvents: vi.fn() }));
vi.mock("@agent-native/core/sharing", async (original) => ({
  ...(await original<typeof import("@agent-native/core/sharing")>()),
  assertAccess: vi.fn(),
}));
vi.mock("../server/projects/repository.js", async (original) => ({
  ...(await original<typeof import("../server/projects/repository.js")>()),
  getProjectOrThrow: vi.fn(),
}));

const ctx = { userEmail: "editor@local.test", orgId: "org-a", caller: "frontend" as const };
beforeEach(() => vi.clearAllMocks());

it("hydrates the selected choice without loading its siblings into agent context", async () => {
  const app = createDefaultApp();
  const choice = {
    ...createDefaultChoice(app, 0),
    id: "c",
    title: "Selected",
    text: "x".repeat(5000),
    image: "data:image/png;base64," + "a".repeat(100000),
  };
  app.rows = [
    {
      ...createDefaultRow(app, 0),
      id: "r",
      title: "Row",
      objects: [choice, { ...createDefaultChoice(app, 0), id: "hidden-sibling", title: "Sibling" }],
    },
  ];
  vi.mocked(getProjectOrThrow).mockResolvedValue({
    row: newProjectRow({ id: "p", json: "{}" }),
    app,
  });
  vi.mocked(readAppState).mockResolvedValue({
    view: "projects",
    projectId: "p",
    choiceId: "c",
    mode: "veditor",
  });
  const result = await viewScreen.run({}, ctx);
  expect(getProjectOrThrow).toHaveBeenCalledWith("p", ctx, "viewer");
  const serialized = JSON.stringify(result);
  expect(serialized).toContain('"title":"Selected"');
  expect(serialized).toContain("[truncated]");
  expect(serialized).not.toContain("base64");
  expect(serialized).not.toContain("hidden-sibling");
  expect(serialized.length).toBeLessThan(7000);
});

it("fails closed when a stale browser location points at an inaccessible project", async () => {
  vi.mocked(readAppState).mockResolvedValue({ projectId: "private" });
  vi.mocked(getProjectOrThrow).mockRejectedValue(new Error("Forbidden"));
  await expect(viewScreen.run({}, ctx)).rejects.toThrow("Forbidden");
});

it("does not resolve a choice from a different row when both IDs were specified", async () => {
  const app = createDefaultApp();
  app.rows = [{ ...createDefaultRow(app, 0), id: "r", objects: [] }];
  vi.mocked(getProjectOrThrow).mockResolvedValue({
    row: newProjectRow({ id: "p", json: "{}" }),
    app,
  });
  expect(
    (await context.run({ projectId: "p", rowId: "r", choiceId: "missing" }, ctx)).missing,
  ).toEqual(["choice"]);
});

it("discovers an addon's parent row and choice when navigating by addon ID", async () => {
  const app = createDefaultApp();
  const choice = {
    ...createDefaultChoice(app, 0),
    id: "c",
    addons: [
      {
        id: "a",
        title: "Details",
        text: "",
        image: "",
        template: 1,
        requireds: [],
        isSelectable: false as const,
      },
    ],
  };
  app.rows = [{ ...createDefaultRow(app, 0), id: "r", objects: [choice] }];
  vi.mocked(getProjectOrThrow).mockResolvedValue({
    row: newProjectRow({ id: "p", json: "{}" }),
    app,
  });
  const result = await context.run({ projectId: "p", addonId: "a" }, ctx);
  expect(result.missing).toEqual([]);
  expect(result.selection.row?.id).toBe("r");
  expect(result.selection.choice?.id).toBe("c");
  expect(result.selection.addon?.id).toBe("a");
});

it("queries exact resource audit IDs under the caller's scope, including wildcard-like IDs", async () => {
  vi.mocked(queryAuditEvents).mockResolvedValue([]);
  await changes.run({ projectId: "p%_", limit: 10 }, ctx);
  expect(assertAccess).toHaveBeenCalledWith("project", "p%_", "viewer", ctx);
  expect(queryAuditEvents).toHaveBeenCalledWith(
    { userEmail: ctx.userEmail, orgId: ctx.orgId },
    { targetType: "project", targetId: "p%_", limit: 10 },
  );
});

it("does not read audit events after project access is denied", async () => {
  vi.mocked(assertAccess).mockRejectedValueOnce(new Error("Forbidden"));
  await expect(changes.run({ projectId: "private" }, ctx)).rejects.toThrow("Forbidden");
  expect(queryAuditEvents).not.toHaveBeenCalled();
});

it("labels duplication with the new project and omits large audit inputs", () => {
  expect(
    projectAudit.target?.(
      { id: "source" },
      { id: "copy" },
      { status: "success", caller: "frontend" },
    ),
  ).toEqual({ type: "project", id: "copy" });
  expect(projectAudit.recordInputs).toBe(false);
});
