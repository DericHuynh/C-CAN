/** Create an isolated verification copy through the app's access-checked action.
 * Usage: pnpm script make-project-copy --id <source-project-id>
 * The framework CLI resolves the user/org identity; set AGENT_USER_EMAIL when
 * the local session owner is ambiguous. Only the new ID/title are printed.
 */
import { getRequestOrgId, getRequestUserEmail } from "@agent-native/core/server";
import "../server/plugins/project-resources.js";
import duplicateProject from "../actions/duplicate-project.js";

export default async function makeProjectCopy(args: Record<string, unknown>) {
  if (typeof args.id !== "string" || !args.id.trim())
    throw new Error("Pass --id <source-project-id>.");
  const project = await duplicateProject.run(
    { id: args.id },
    {
      caller: "cli",
      userEmail: getRequestUserEmail(),
      orgId: getRequestOrgId(),
    },
  );
  return { id: project.id, title: project.title };
}
