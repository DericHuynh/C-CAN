/**
 * Run the CYOA agent eval suite.
 *
 * Requires a configured model provider key (the runner resolves the app's
 * engine — DeepSeek via the registered plugin, or whichever engine/key the
 * environment provides). Eval cases live in `evals/*.eval.ts`.
 *
 *   pnpm script eval-cyoa
 *   pnpm script eval-cyoa --pattern=build
 */
import { formatReport, runEvalSuite } from "@agent-native/core/eval";

export default async function evalCyoa(args: Record<string, unknown>) {
  const pattern = typeof args.pattern === "string" ? args.pattern : undefined;
  const { report, files } = await runEvalSuite({ pattern });
  const rendered = formatReport(report);
  console.log(rendered);
  return {
    files,
    passed: report.passed,
    failed: report.failed,
    skipped: report.skipped,
  };
}
