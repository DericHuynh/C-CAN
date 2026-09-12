import { describe, it, expect } from "vite-plus/test";

import {
  COMPLETION_CLAIM_RE,
  finalResponseGuard,
  MUTATING_ACTIONS,
  MUTATION_INTENT_RE,
} from "./final-response-guard.js";

type GuardContext = Parameters<typeof finalResponseGuard>[0];

function ctx(overrides: Partial<GuardContext> = {}): GuardContext {
  return {
    messages: [],
    requestText: "create a CYOA with three rows",
    assistantContent: [],
    text: "Done — I created the project.",
    toolCalls: [],
    toolResults: [],
    retryCount: 0,
    executionMode: "act" as const,
    ...overrides,
  };
}

describe("finalResponseGuard", () => {
  it("rejects a text-only completion claim when no mutating action ran", () => {
    const result = finalResponseGuard(ctx());
    expect(result).not.toBeNull();
    expect(typeof result).toBe("object");
    const retry = result as { retryMessage: string; maxRetries: number };
    expect(retry.retryMessage).toContain("no mutating project action succeeded");
    expect(retry.maxRetries).toBeGreaterThanOrEqual(1);
  });

  it("accepts the answer when a mutating action ran this turn", () => {
    const result = finalResponseGuard(
      ctx({
        toolCalls: [
          { name: "get-project", input: { id: "x" } },
          { name: "add-row", input: { projectId: "x" } },
        ],
        toolResults: [{ name: "add-row", content: '{"id":"new-row"}', isError: false }],
      }),
    );
    expect(result).toBeNull();
  });

  it("rejects a completion claim when only read actions ran", () => {
    // A read-only turn that happens to describe work is not a lie — but the
    // guard requires *some* evidence path; read-only calls are not evidence.
    // The model should still not claim completion, so this stays a rejection
    // unless a mutating action actually ran. Read-only calls alone → retry.
    const result = finalResponseGuard(
      ctx({ toolCalls: [{ name: "get-project", input: { id: "x" } }] }),
    );
    expect(result).not.toBeNull();
  });

  it.each(
    [
      [],
      [{ name: "add-row", content: "Conflict", isError: true }],
      [{ name: "get-project", content: "{}", isError: false }],
      [{ name: "create-project", content: "{}", isError: false }],
    ].map((toolResults) => ({ toolResults })),
  )("requires a successful result from an attempted mutation: %j", ({ toolResults }) => {
    const result = finalResponseGuard(
      ctx({
        toolCalls: [{ name: "add-row", input: {} }],
        toolResults,
      }),
    );
    expect(result).toMatchObject({ retryMessage: expect.stringContaining("never blindly repeat") });
  });

  it("does not force a write in plan mode", () => {
    expect(finalResponseGuard(ctx({ executionMode: "plan" }))).toBeNull();
  });

  it("accepts a completion claim that makes no sense to gate (no mutation intent)", () => {
    const result = finalResponseGuard(ctx({ requestText: "what is a CYOA?" }));
    expect(result).toBeNull();
  });

  it("accepts an answer with no completion claim", () => {
    const result = finalResponseGuard(ctx({ text: "Here are three ideas for rows." }));
    expect(result).toBeNull();
  });

  it("accepts a negative completion claim (explicitly did not do the work)", () => {
    const result = finalResponseGuard(
      ctx({ text: "I did not create anything — I need more information first." }),
    );
    expect(result).toBeNull();
  });

  it("does not fire without a request text", () => {
    const result = finalResponseGuard(ctx({ requestText: undefined }));
    expect(result).toBeNull();
  });

  it("does not fire for requests that only mention read-only work", () => {
    const result = finalResponseGuard(
      ctx({ requestText: "list my projects and summarize them", text: "Here's the summary." }),
    );
    expect(result).toBeNull();
  });

  it("does not fire when the mutating action name is in the catalog but wasn't called", () => {
    // Regression: "move" appears in the intent regex AND is a mutating action;
    // a claim with no call must still be rejected.
    const result = finalResponseGuard(
      ctx({ requestText: "move that choice to another row", text: "Done, moved it." }),
    );
    expect(result).not.toBeNull();
  });
});

describe("guard constants", () => {
  it("covers every mutating project action", () => {
    const expected = [
      "create-project",
      "import-project-json",
      "duplicate-project",
      "delete-project",
      "update-project",
      "update-project-settings",
      "add-row",
      "add-rows",
      "update-row",
      "delete-row",
      "move-row",
      "add-choice",
      "add-choices",
      "update-choice",
      "delete-choice",
      "move-choice",
      "add-score",
      "delete-score",
      "move-addon",
      "delete-addon",
      "add-point-type",
      "update-point-type",
      "delete-point-type",
      "add-group",
      "update-group",
      "delete-group",
      "add-global-requirement",
      "update-global-requirement",
      "delete-global-requirement",
      "add-image",
      "add-image-from-source",
      "update-planning-entry",
      "generate-image-previews",
      "update-image",
      "delete-image",
      "patch-app-document",
    ];
    for (const name of expected) {
      expect(MUTATING_ACTIONS.has(name), `missing ${name}`).toBe(true);
    }
  });

  it("matches common authoring verbs", () => {
    for (const phrase of [
      "create a project",
      "add a choice",
      "import this json",
      "delete that row",
      "move the choice",
      "update the point type",
    ]) {
      expect(MUTATION_INTENT_RE.test(phrase), phrase).toBe(true);
    }
  });

  it("matches completion claims", () => {
    for (const phrase of ["Done.", "I created it.", "Finished — added 3 rows.", "Saved."]) {
      expect(COMPLETION_CLAIM_RE.test(phrase), phrase).toBe(true);
    }
  });
});
