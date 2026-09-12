import { normalizeApp } from "./cyoa.js";
import type { App } from "./types.js";

/** Parse a serialized CYOA document, normalizing it against the defaults. */
export function parseAppDocument(json: string): App {
  try {
    return normalizeApp(JSON.parse(json));
  } catch (err) {
    throw new Error(
      `Project document is invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
