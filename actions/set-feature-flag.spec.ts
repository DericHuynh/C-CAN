import { expect, it } from "vite-plus/test";
import action from "./set-feature-flag";

it("advertises an Azure-compatible schema while retaining Core email validation", async () => {
  expect(JSON.stringify(action.tool.parameters)).not.toMatch(/\(\?[=!]|\(\?<[=!]/);
  expect(action.toolCallable).toBe(false);
  await expect(
    action.run({
      operation: "replace-rules",
      key: "example",
      rules: { mode: "rules", emails: ["not-an-email"] },
    }),
  ).rejects.toThrow(/email/i);
  await expect(action.run({ operation: "replace-rules", key: "example" })).rejects.toThrow();
});
