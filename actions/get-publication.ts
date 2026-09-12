import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { getPublication } from "../server/publishing/repository.js";
export default defineAction({
  description:
    "Read a published ICYOA and its independent overall/category rating averages and 0–5 distributions. Optionally load the playable snapshot; never returns private drafts or voter identities.",
  schema: z.object({ id: z.string().min(1), includeDocument: z.boolean().default(false) }),
  http: { method: "GET" },
  readOnly: true,
  requiresAuth: false,
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  link: ({ args }) => ({
    url: `/explorer/${encodeURIComponent(String(args.id))}`,
    label: "Open ICYOA",
    view: "explorer",
  }),
  run: async ({ id, includeDocument }, ctx) => getPublication(id, includeDocument, ctx),
});
