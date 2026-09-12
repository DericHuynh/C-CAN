import { createCollabPlugin } from "@agent-native/core/server";
import { collabProjectId, projectCollabId } from "../../shared/project-collaboration.js";

// Core awareness/transport for all CYOA modes. Structured edits use granular
// project actions, so never seed the full JSON into a second writable store.
export default createCollabPlugin({
  table: "projects",
  contentColumn: "json",
  autoSeed: false,
  resolveCollabDocumentId: projectCollabId,
  access: { mode: "resource", resourceType: "project", resolveResourceId: collabProjectId },
});
