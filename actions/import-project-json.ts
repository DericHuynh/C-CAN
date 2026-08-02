import { randomUUID } from "node:crypto";

import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import { projects } from "../server/db/schema.js";
import { normalizeApp } from "../shared/cyoa.js";
import { newProjectRow, toProjectDetail } from "./_project-store.js";

export default defineAction({
  description:
    "Import a CYOA document: accepts raw JSON as a string or a parsed object, normalizes it against the app defaults, and stores it as a new project.",
  schema: z.object({
    title: z.string().optional().describe("List title for the imported project"),
    description: z.string().optional().describe("Optional description"),
    json: z
      .union([z.string(), z.record(z.string(), z.unknown())])
      .describe("The CYOA document, as a JSON string or a parsed object"),
  }),
  run: async ({ title, description, json }) => {
    const parsed: unknown = typeof json === "string" ? parseJson(json) : json;
    const app = normalizeApp(parsed);
    const row = newProjectRow({
      id: randomUUID(),
      title,
      description,
      json: JSON.stringify(app),
    });
    const db = getDb();
    await db.insert(projects).values(row);
    return toProjectDetail(row, app);
  },
});

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON provided for import: could not parse the supplied string.");
  }
}
