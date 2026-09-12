import { useLiveFieldStatus } from "@/features/editor/LiveProjectFields";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSession } from "@agent-native/core/client/hooks";
import { useCollaborativeDoc, usePresence } from "@agent-native/core/client/collab";
import { PresenceBar, emailToColor, emailToName } from "@agent-native/toolkit/collab-ui";
import { projectCollabId } from "@shared/project-collaboration";
import { projectPath } from "@shared/project-routes";
import { TAB_ID } from "@/lib/tab-id";
import { Button } from "@/components/ui/button";

export function ProjectPresence({ projectId }: { projectId: string }) {
  const { session } = useSession();
  const liveStatus = useLiveFieldStatus();
  const location = useLocation();
  const navigate = useNavigate();
  const collab = useCollaborativeDoc({
    docId: session ? projectCollabId(projectId) : null,
    requestSource: TAB_ID,
    user: session
      ? {
          email: session.email,
          name: emailToName(session.email),
          color: emailToColor(session.email),
        }
      : undefined,
  });
  const { others, setPresence } = usePresence(collab.awareness, collab.ydoc?.clientID);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setPresence({
      viewport: {
        projectId,
        updatedAt: Date.now(),
        mode: location.pathname.endsWith("/visual-editor")
          ? "visual-editor"
          : location.pathname.endsWith("/viewer")
            ? "viewer"
            : "editor",
        tab: params.get("tab"),
        rowId: params.get("rowId"),
        choiceId: params.get("choiceId"),
        addonId: params.get("addonId"),
      },
    });
  }, [location.pathname, location.search, projectId, setPresence, collab.awareness]);
  if (!session) return null;
  if (collab.initialization.status === "error")
    return (
      <Button variant="ghost" size="sm" onClick={collab.retry}>
        Reconnect collaborators
      </Button>
    );
  return (
    <div aria-label="Project collaborators" className="flex items-center gap-2">
      {collab.isLoading ? (
        <span className="text-xs text-muted-foreground" role="status">
          Connecting collaborators…
        </span>
      ) : null}
      {!collab.isLoading && (
        <span
          role="status"
          className="text-xs text-muted-foreground"
          title={
            liveStatus.error ??
            "Keystrokes are shared live; changes to existing content save automatically."
          }
        >
          {liveStatus.error
            ? "Live changes pending"
            : liveStatus.saving
              ? "Saving changes…"
              : "Live editing"}
        </span>
      )}
      {liveStatus.error && (
        <Button variant="ghost" size="sm" onClick={liveStatus.retry}>
          Retry save
        </Button>
      )}
      <PresenceBar
        activeUsers={collab.activeUsers}
        currentUserEmail={session.email}
        agentPresent={collab.agentPresent}
        agentActive={collab.agentActive}
        onAvatarClick={(user) => {
          // A peer can have multiple tabs, or a just-closed tab can linger in
          // awareness briefly. Follow their most recently published location.
          const peer = others
            .filter((peer) => (user ? peer.user.email === user.email : peer.isAgent))
            .sort(
              (a, b) => viewportTime(b.presence.viewport) - viewportTime(a.presence.viewport),
            )[0];
          const viewport = peer?.presence.viewport;
          if (!viewport || typeof viewport !== "object") return;
          const target = viewport as Record<string, unknown>;
          if (target.projectId !== projectId) return;
          const mode =
            target.mode === "visual-editor" || target.mode === "viewer" ? target.mode : "editor";
          const params = new URLSearchParams();
          for (const key of ["tab", "rowId", "choiceId", "addonId"])
            if (typeof target[key] === "string") params.set(key, target[key]);
          navigate({ pathname: projectPath(projectId, mode), search: params.toString() });
        }}
      />
    </div>
  );
}

function viewportTime(viewport: unknown) {
  if (!viewport || typeof viewport !== "object") return 0;
  const value = (viewport as Record<string, unknown>).updatedAt;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
