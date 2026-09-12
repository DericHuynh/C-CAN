import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { getProjectOrThrow, saveProject } from "../server/projects/repository.js";
import { mergeProjectEdit } from "../server/projects/collaboration.js";
import { readLivePath, writeLivePath } from "../shared/live-project-path.js";
import { sameValue } from "../shared/collaboration-merge.js";
import { assertFound } from "../shared/assert.js";
import { projectAudit } from "../server/projects/audit.js";

const roots = new Set([
  "rows",
  "$choices",
  "pointTypes",
  "groups",
  "images",
  "globalRequirements",
  "words",
  "variables",
  "soundEffects",
  "rowDesignGroups",
  "objectDesignGroups",
  "$categories",
  "styling",
  "viewerConfig",
  "customCSS",
  "defaultRowTitle",
  "defaultChoiceTitle",
  "defaultBeforePoint",
  "defaultAfterPoint",
  "$metadata",
]);
export default defineAction({
  description:
    "Persist a batch of live field edits to existing CYOA content. Baselines protect concurrent agent saves; all fields commit atomically.",
  agentTool: false,
  audit: projectAudit,
  schema: z.object({
    projectId: z.string(),
    fields: z
      .array(
        z.object({
          path: z.array(z.string()).min(1).max(12),
          base: z.unknown(),
          value: z.unknown(),
        }),
      )
      .max(200),
  }),
  run: async ({ projectId, fields }, ctx) => {
    const { row, app: original } = await getProjectOrThrow(projectId, ctx, "editor");
    let app = original;
    const metadata: Record<string, string> = {};
    const applied = [];
    for (const field of fields) {
      assertFound(
        roots.has(field.path[0]) &&
          !["id", "index", "idx"].includes(field.path[field.path.length - 1] ?? ""),
        "This field requires an explicit editor action.",
      );
      const isMetadata = field.path[0] === "$metadata";
      assertFound(
        !isMetadata ||
          (field.path.length === 2 && ["title", "description"].includes(field.path[1])),
        "Invalid metadata field.",
      );
      const current = isMetadata
        ? (row[field.path[1] as "title" | "description"] ?? "")
        : readLivePath(app, field.path);
      assertFound(
        current !== undefined,
        "The edited field no longer exists. Reopen the latest project.",
      );
      // Incomplete number inputs stay in the shared draft until they are valid.
      assertFound(
        typeof field.value === typeof current &&
          Array.isArray(field.value) === Array.isArray(current),
        "The edited field has an invalid value type.",
      );
      const value = mergeProjectEdit(field.base, field.value, current);
      if (!sameValue(current, value)) {
        if (isMetadata) metadata[field.path[1]] = String(value);
        else app = writeLivePath(app, field.path, value);
      }
      applied.push({ path: field.path, value });
    }
    if (app !== original || Object.keys(metadata).length)
      await saveProject(
        projectId,
        app,
        row.json,
        Object.keys(metadata).length ? metadata : undefined,
      );
    return { fields: applied };
  },
});
