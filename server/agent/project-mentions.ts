import { getOrgContext } from "@agent-native/core/org";
import type { MentionProvider } from "@agent-native/core/server";
import { searchProjectTitles } from "../projects/queries.js";

export const projectMentions: MentionProvider = {
  label: "Projects",
  async search(query, event) {
    if (!event) return [];
    const { email, orgId } = await getOrgContext(event);
    if (!email) return [];
    const result = await searchProjectTitles(
      { query: query.slice(0, 200), limit: 8 },
      { userEmail: email, orgId },
    );
    return result.projects.map((project) => ({
      id: `project:${project.id}`,
      label: project.title.slice(0, 200) || "Untitled CYOA",
      refType: "project",
      refId: project.id,
      refPath: `/projects/${encodeURIComponent(project.id)}/editor`,
    }));
  },
};
