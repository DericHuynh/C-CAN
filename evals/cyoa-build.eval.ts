/**
 * Eval: the agent builds a small CYOA project through actions.
 *
 * Requires a configured model provider key (the eval runner resolves the
 * app's engine). Run with:
 *
 *   pnpm script eval-cyoa
 */
import { defineEval, contains, usesTool } from "@agent-native/core/eval";

export default defineEval({
  name: "builds a 2-row CYOA project through actions",
  input: {
    prompt:
      "Create a new CYOA project called 'Eval Quest'. Then add two rows — 'The Gate' and 'The Path' — and give each row two choices with titles.",
  },
  threshold: 0.7,
  scorers: [
    usesTool("create-project"),
    usesTool("add-row"),
    usesTool("add-choice"),
    contains(["Eval Quest", "The Gate", "The Path"]),
  ],
});
