import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getProjectOrThrow, toProjectSummary } from "./_project-store.js";

// Context is deliberately bounded. Unknown fields and media remain in the
// authored document; agents should patch only the fields they intend to edit.
function excerpt(value: unknown): unknown {
  if (typeof value === "string") {
    if (/^data:/i.test(value)) return "[embedded media omitted]";
    return value.length > 4000 ? `${value.slice(0, 4000)} [truncated]` : value;
  }
  return value;
}

function describeEntity(entity: Record<string, unknown>) {
  const budget = { chars: 12000, nodes: 256 };
  return Object.fromEntries(
    ["id", "index", "title", "titleText", "text", "requireds", "scores", "groups"]
      .filter((key) => key in entity)
      .map((key) => [key, boundedValue(entity[key], budget)]),
  );
}

function boundedValue(
  value: unknown,
  budget: { chars: number; nodes: number },
  depth = 0,
): unknown {
  if (--budget.nodes < 0 || budget.chars <= 0) return "[context budget exhausted]";
  if (depth > 5) return "[nested content omitted]";
  if (typeof value === "string") {
    const shortened = String(excerpt(value));
    const result =
      shortened.length > budget.chars
        ? `${shortened.slice(0, budget.chars)} [truncated]`
        : shortened;
    budget.chars -= result.length;
    return result;
  }
  if (Array.isArray(value)) {
    const items = value.slice(0, 30).map((item) => boundedValue(item, budget, depth + 1));
    if (value.length > 30) items.push(`[${value.length - 30} more items omitted]`);
    return items;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 30)
        .map(([key, item]) => [key, boundedValue(item, budget, depth + 1)]),
    );
  }
  return excerpt(value);
}

export default defineAction({
  description:
    "Read compact, fresh context for a project and optional selected row/choice/addon. Includes counts, selected prose, requirements and scores, without images or the full document. Long text/lists are marked when truncated. Use get-project-summary to discover IDs and get-project for exact full data only when necessary; never replace a document with this context result.",
  schema: z.object({
    projectId: z.string(),
    rowId: z.string().optional(),
    choiceId: z.string().optional(),
    addonId: z.string().optional(),
  }),
  readOnly: true,
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  run: async ({ projectId, rowId, choiceId, addonId }, ctx) => {
    const { row: project, app } = await getProjectOrThrow(projectId, ctx, "viewer");
    const row = rowId
      ? app.rows.find((item) => item.id === rowId)
      : app.rows.find((item) =>
          item.objects?.some((choice) =>
            choiceId
              ? choice.id === choiceId
              : choice.addons?.some((addon) => addon.id === addonId),
          ),
        );
    const choice = row?.objects?.find((item) =>
      choiceId ? item.id === choiceId : item.addons?.some((addon) => addon.id === addonId),
    );
    const addon = choice?.addons?.find((item) => item.id === addonId);
    return {
      project: {
        ...toProjectSummary(project, app),
        title: excerpt(project.title),
        description: excerpt(project.description),
      },
      selection: {
        ...(row ? { row: describeEntity(row), choiceCount: row.objects?.length ?? 0 } : {}),
        ...(choice
          ? { choice: describeEntity(choice), addonCount: choice.addons?.length ?? 0 }
          : {}),
        ...(addon ? { addon: describeEntity(addon) } : {}),
      },
      missing: [
        rowId && !row ? "row" : null,
        choiceId && !choice ? "choice" : null,
        addonId && !addon ? "addon" : null,
      ].filter(Boolean),
    };
  },
});
