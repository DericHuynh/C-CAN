/**
 * Proof-of-done final-response guard for the CYOA agent.
 *
 * Extracted from the agent-chat plugin into its own module so it can be unit
 * tested. The framework's raw in-loop `Processor` seam (observe streamed
 * output / tool calls / final verdict, optionally `abort()`) is only
 * configurable at `runAgentLoop` call sites, which the HTTP chat handler does
 * not expose yet — `finalResponseGuard` is the version-matched, plugin-level
 * equivalent for proof-of-done enforcement on the interactive chat surface.
 */
import type { AgentLoopFinalResponseGuard } from "@agent-native/core/server";

/** Actions that durably mutate a CYOA project. */
export const MUTATING_ACTIONS = new Set([
  "publish-project",
  "unpublish-project",
  "rate-publication",
  "build-project",
  "clone-project",
  "add-addon",
  "add-addons",
  "update-addon",
  "create-project",
  "import-project-json",
  "duplicate-project",
  "delete-project",
  "update-project",
  "update-planning-entry",
  "update-project-settings",
  "add-row",
  "add-rows",
  "update-row",
  "delete-row",
  "move-row",
  "add-choice",
  "add-choices",
  "update-choice",
  "delete-choice",
  "move-choice",
  "add-score",
  "delete-score",
  "move-addon",
  "delete-addon",
  "add-point-type",
  "update-point-type",
  "delete-point-type",
  "add-group",
  "update-group",
  "delete-group",
  "add-global-requirement",
  "update-global-requirement",
  "delete-global-requirement",
  "add-image",
  "add-image-from-source",
  "generate-image-previews",
  "update-image",
  "delete-image",
  "patch-app-document",
]);

/** Words a user is likely to use when asking for durable CYOA work. */
export const MUTATION_INTENT_RE =
  /\b(publish|unpublish|rate|create|add|import|build|make|write|edit|update|change|modify|delete|remove|rename|move|duplicate|copy|set|fill|complete)\b/i;

/** Completion claims that need evidence — an action succeeded this turn. */
export const COMPLETION_CLAIM_RE =
  /\b(published|unpublished|rated|done|created|added|imported|built|wrote|updated|edited|deleted|removed|moved|duplicated|saved|finished|completed)\b/i;

/**
 * Reject a text-only "done" answer when the user asked for durable work and
 * no mutating project action succeeded this turn. Returns a corrective retry, or
 * `null` when the answer is acceptable (no work requested, no completion
 * claim, or a mutating action already succeeded).
 */
export const finalResponseGuard: AgentLoopFinalResponseGuard = ({
  text,
  requestText,
  toolCalls,
  toolResults,
  executionMode,
}) => {
  if (!requestText || executionMode === "plan") return null;
  const askedForWork = MUTATION_INTENT_RE.test(requestText);
  if (!askedForWork) return null;
  const claimsCompletion = COMPLETION_CLAIM_RE.test(text ?? "");
  if (!claimsCompletion) return null;
  const attempted = new Set(
    toolCalls.filter((call) => MUTATING_ACTIONS.has(call.name)).map((call) => call.name),
  );
  const mutationSucceeded = toolResults.some((result) => {
    if (!attempted.has(result.name) || result.isError !== false) return false;
    if (
      [
        "build-project",
        "clone-project",
        "add-addon",
        "add-addons",
        "update-addon",
        "delete-addon",
      ].includes(result.name)
    ) {
      try {
        const data = JSON.parse(result.content);
        if ("committed" in data) return data.committed === true;
        return data.ok === true; // Legacy positional addon deletion.
      } catch {
        return false;
      }
    }
    return true;
  });
  if (mutationSucceeded) return null;
  return {
    retryMessage:
      "Your answer claims project work was completed (created, added, imported, updated, deleted, …), but no mutating project action succeeded this turn. If an action failed or its result is missing, re-read the affected project and reconcile its state before retrying; never blindly repeat a possibly committed write. Report unresolved failures honestly. Otherwise perform the requested change through the project actions (add-row, add-choice, import-project-json, patch-app-document, update-*, delete-*, …), then report what changed based on the action results. Never claim work you did not do.",
    fallbackMessage:
      "I could not verify that the requested project change was made. Check the project state with get-project / list-project-changes and try again.",
    maxRetries: 2,
    expandToolSurface: true,
  };
};
