import { describe, it, expect, vi, afterEach } from "vitest";

import { DEEPSEEK_API_KEY_ENV } from "../agent/deepseek-engine.js";

/**
 * The chat model picker marks an engine "configured" only when its
 * requiredEnvVars[0] appears in /_agent-native/env-status. That endpoint only
 * reports keys this app registers via createCoreRoutesPlugin({ envKeys }), so
 * dropping the DeepSeek key from this plugin silently re-breaks the picker —
 * this test is the regression guard.
 */
describe("core-routes plugin envKeys", () => {
  afterEach(() => {
    vi.doUnmock("@agent-native/core/server");
    vi.resetModules();
  });

  it("registers the DeepSeek API key on the env-status allowlist", async () => {
    const createSpy = vi.fn((opts: any) => opts);
    vi.doMock("@agent-native/core/server", () => ({
      createCoreRoutesPlugin: createSpy,
    }));
    vi.resetModules();
    await import("./core-routes.js");

    expect(createSpy).toHaveBeenCalledTimes(1);
    const options = createSpy.mock.calls[0][0] as { envKeys?: unknown[] };
    expect(options.envKeys).toContainEqual({
      key: DEEPSEEK_API_KEY_ENV,
      label: "DeepSeek API Key",
      required: true,
      helpText: expect.any(String),
    });
  });
});
