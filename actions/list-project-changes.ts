import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { sql } from "@agent-native/core/db/schema";

import { getDb } from "../server/db/index.js";

/**
 * The framework's tool ledger records every agent tool call
 * (tool_key = `actionName:{JSON args}`, with result_summary + completed_at).
 * Mutations carry the projectId in their args, so a LIKE filter on the key
 * recovers "what has been changed on this project and when".
 */
export default defineAction({
  description:
    "List the most recent agent tool calls that mutated a project (rows, choices, addons, images, settings, …) with their timestamps — i.e. 'what has changed on this project and when'. Useful after a long build to see which rows/choices were created or edited and verify the work landed, instead of re-reading the whole document.",
  readOnly: true,
  schema: z.object({
    projectId: z.string().describe("Project id"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Max entries to return (default 50)"),
  }),
  run: async ({ projectId, limit }) => {
    const db = getDb();
    const rows = await db.all(
      sql`SELECT thread_id, tool_key, result_summary, completed_at
          FROM agent_tool_ledger
          WHERE tool_key LIKE ${`%${projectId}%`}
          ORDER BY completed_at DESC
          LIMIT ${Math.min(limit ?? 50, 100)}`,
    );
    const changes = (rows ?? []).map((entry: any) => {
      const key: string = entry.tool_key ?? "";
      const colon = key.indexOf(":");
      return {
        action: colon === -1 ? key : key.slice(0, colon),
        threadId: entry.thread_id ?? null,
        completedAt: entry.completed_at ?? null,
        summary: String(entry.result_summary ?? "").slice(0, 500),
      };
    });
    return { projectId, changeCount: changes.length, changes };
  },
});
