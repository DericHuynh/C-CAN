import { useSession } from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { ReviewThreadPanel } from "@agent-native/core/client/review";
import { useShareQuery, type ShareButtonSharesResponse } from "@agent-native/core/client/sharing";
import { useNavigate, useSearchParams } from "react-router";
import { projectPath } from "@shared/project-routes";

import type { ProjectDetail } from "@/features/projects/use-projects";

export function ProjectReviewPanel({ project }: { project: ProjectDetail }) {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { session } = useSession();
  const { query: access } = useShareQuery<ShareButtonSharesResponse>("project", project.id);
  const canEdit = ["owner", "admin", "editor"].includes(access.data?.role ?? "");
  const canComment = !!session && !!access.data?.role;
  const selectedId = params.get("addonId") || params.get("choiceId") || params.get("rowId");
  return (
    <ReviewThreadPanel
      resourceType="project"
      resourceId={project.id}
      title={t("projectHistory.review")}
      showComposer={canComment}
      canReply={canComment}
      canResolve={canEdit}
      showComposerTargetPicker={canComment}
      composerAgentLabel={t("projectHistory.queue")}
      canDeleteComment={(comment) => comment.canDelete === true}
      composerTargetId={selectedId}
      composerContextLabel={selectedId ?? project.title}
      composerAnchor={{
        rowId: params.get("rowId"),
        choiceId: params.get("choiceId"),
        addonId: params.get("addonId"),
      }}
      onSelectThread={(thread) => {
        const anchor = thread.root.anchor as Record<string, unknown> | null;
        const next = new URLSearchParams({ tab: "rows" });
        for (const key of ["rowId", "choiceId", "addonId"]) {
          if (typeof anchor?.[key] === "string") next.set(key, anchor[key]);
        }
        if (next.size > 1) navigate(`${projectPath(project.id, "editor")}?${next}`);
      }}
    />
  );
}
