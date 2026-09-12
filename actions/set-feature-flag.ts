import { defineAction } from "@agent-native/core/action";
import coreSetFeatureFlag from "@agent-native/core/feature-flags/actions/set-feature-flag";
import { z } from "zod";

// Azure rejects the lookarounds emitted by Zod's default email JSON Schema.
// Advertise plain email strings; Core still validates the exact email format,
// operation-specific fields, manager permissions and registered flag at runtime.
export default defineAction({
  description:
    "Manage a registered feature flag for the current scope. Organization owner/admin only.",
  schema: z.object({
    operation: z.enum(["enable-for-current-user", "off", "replace-rules"]),
    key: z.string(),
    rules: z
      .object({
        mode: z.enum(["off", "on", "rules"]),
        emails: z.array(z.string().describe("Email address")).max(500).optional(),
        orgIds: z.array(z.string().min(1).max(200)).max(500).optional(),
        percentage: z.number().int().min(0).max(100).optional(),
      })
      .optional(),
  }),
  toolCallable: false,
  audit: coreSetFeatureFlag.audit,
  run: (args, ctx) =>
    coreSetFeatureFlag.run(args as Parameters<typeof coreSetFeatureFlag.run>[0], ctx),
});
