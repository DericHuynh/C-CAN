/** Compatibility entry point for the local verification scripts.
 * Usage: node scripts/tmp-make-copy.mjs --source-id <project-id>
 * Copies always receive a fresh ID; no existing project is deleted/replaced.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { "source-id": { type: "string" } } });
if (!values["source-id"]?.trim()) throw new Error("Pass --source-id <project-id>.");
const result = spawnSync(
  fileURLToPath(new URL("../node_modules/.bin/agent-native", import.meta.url)),
  ["script", "make-project-copy", "--id", values["source-id"]],
  { cwd: fileURLToPath(new URL("../", import.meta.url)), stdio: "inherit" },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
