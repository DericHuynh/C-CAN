import { insertProject } from "../server/projects/repository.js";
import { projectCreated } from "../server/projects/events.js";
import { projectAudit } from "../server/projects/audit.js";
import { randomUUID } from "node:crypto";

import { defineAction } from "@agent-native/core/action";
import { notify } from "@agent-native/core/notifications";
import { completeRun, startRun, updateRunProgress } from "@agent-native/core/progress";
import { z } from "zod";

import { aclImportImages, normalizeApp, parseProjectDocument } from "../shared/cyoa.js";
import { externalizeAppImages } from "../server/media/blob-images.js";
import { newProjectRow } from "../server/projects/repository.js";
import { toProjectDetail } from "../server/projects/presentation.js";

export default defineAction({
  audit: projectAudit,
  description:
    "Import a CYOA document: accepts raw JSON as a string or a parsed object, normalizes it against the app defaults, stores it as a new project, and moves any embedded (data-URL) images to blob storage so the document only keeps URL references.",
  schema: z.object({
    title: z.string().optional().describe("List title for the imported project"),
    description: z.string().optional().describe("Optional description"),
    json: z
      .union([z.string(), z.record(z.string(), z.unknown())])
      .describe("The CYOA document, as a JSON string or a parsed object"),
  }),
  run: async ({ title, description, json }, ctx) => {
    const owner = ctx?.userEmail ?? "unknown";
    let run;
    try {
      run = await startRun({
        owner,
        title: `Import "${title ?? "Untitled"}"`,
        step: "Parsing",
        metadata: { action: "import-project-json" },
      });
    } catch {
      // Progress tracking is best-effort — never fail the import on it.
    }

    try {
      const parsed = parseProjectDocument(json);
      const app = aclImportImages(normalizeApp(parsed));

      if (run) {
        try {
          await updateRunProgress(run.id, owner, {
            percent: 40,
            step: "Moving images to blob storage",
          });
        } catch {
          // best-effort
        }
      }
      // Image uploads must succeed before the document is written to SQL.
      const externalized = await externalizeAppImages(app);

      if (run) {
        try {
          await updateRunProgress(run.id, owner, { percent: 85, step: "Storing project" });
        } catch {
          // best-effort
        }
      }

      const row = newProjectRow({
        id: randomUUID(),
        title,
        description,
        json: JSON.stringify(app),
        ownerEmail: ctx?.userEmail ?? null,
        orgId: ctx?.orgId ?? null,
      });
      await insertProject(row);
      projectCreated(row.id, "import", ctx);

      if (run) {
        try {
          await completeRun(run.id, owner, "succeeded");
        } catch {
          // best-effort
        }
      }

      // Bell notification so long imports (e.g. the 17 MB example) surface even
      // when the caller moved on. Best-effort: never fail the import on it.
      if (ctx?.userEmail) {
        try {
          await notify(
            {
              severity: "info",
              title: "CYOA imported",
              body: `"${row.title || "Untitled"}" imported (${Math.round(
                JSON.stringify(app).length / 1024,
              )} kB${externalized > 0 ? `, ${externalized} image${externalized === 1 ? "" : "s"} moved to blob storage` : ""}).`,
            },
            { owner: ctx.userEmail },
          );
        } catch {
          // Notifications are best-effort.
        }
      }
      return toProjectDetail(row, app);
    } catch (error) {
      if (run) {
        try {
          await completeRun(run.id, owner, "failed");
        } catch {
          // Progress tracking must not replace the original import error.
        }
      }
      throw error;
    }
  },
});
