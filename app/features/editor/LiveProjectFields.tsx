import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useCollaborativeDoc, isReconcileLeadClient } from "@agent-native/core/client/collab";
import { useSession } from "@agent-native/core/client/hooks";
import { emailToColor, emailToName } from "@agent-native/toolkit/collab-ui";
import { projectCollabId } from "@shared/project-collaboration";
import { useLiveAutosave } from "./use-live-autosave";
import type { ProjectDetail } from "@shared/project-contracts";
import type { App } from "@shared/types";
import { TAB_ID } from "@/lib/tab-id";
import { createLiveFields, type LiveFields } from "./live-fields";
const Context = createContext<LiveFields | null>(null);
const StatusContext = createContext<{ error: string | null; saving: boolean; retry: () => void }>({
  error: null,
  saving: false,
  retry: () => {},
});
export const useLiveFieldStatus = () => useContext(StatusContext);
export const useLiveFields = () => useContext(Context);
const subscribeNothing = () => () => {};
const zero = () => 0;
export function useLiveFieldVersion(store: LiveFields | null) {
  return useSyncExternalStore(store?.subscribe ?? subscribeNothing, store?.version ?? zero, zero);
}
export function LiveProjectFields({
  project,
  children,
}: {
  project: ProjectDetail;
  children: ReactNode;
}) {
  const projectId = project.id;
  const { session } = useSession();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const status = (event: Event) => {
      const detail = (event as CustomEvent<{ docId: string; error: string | null }>).detail;
      if (detail?.docId === projectCollabId(projectId)) setError(detail.error);
    };
    window.addEventListener("agent-native:collab-update-status", status);
    return () => window.removeEventListener("agent-native:collab-update-status", status);
  }, [projectId]);
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
  const store = useMemo(
    () =>
      collab.ydoc && collab.initialization.status === "ready"
        ? createLiveFields(collab.ydoc, project.canEdit === true)
        : null,
    [collab.ydoc, collab.initialization.status, project.canEdit],
  );
  useEffect(() => () => store?.destroy(), [store]);
  useEffect(() => {
    collab.awareness?.setLocalStateField("canFlushDocument", project.canEdit === true);
  }, [collab.awareness, project.canEdit]);
  const previous = useRef(project);
  useEffect(() => {
    store?.acknowledge(previous.current.app, project.app, true);
    store?.acknowledge({ $metadata: previous.current }, { $metadata: project }, true);
    if (project.canEdit && isReconcileLeadClient(collab.awareness, collab.ydoc?.clientID)) {
      store?.reconcileSaved(previous.current.app, project.app);
      store?.reconcileSaved({ $metadata: previous.current }, { $metadata: project });
    }
    previous.current = project;
  }, [store, project, collab.awareness, collab.ydoc]);
  const version = useLiveFieldVersion(store);
  const autosave = useLiveAutosave(store, project, version);
  return (
    <Context.Provider value={store}>
      <StatusContext.Provider
        value={{
          error:
            error ??
            (autosave.status === "error"
              ? "Autosave could not finish. Your live draft is still available."
              : null),
          saving: autosave.status === "saving",
          retry: autosave.retry,
        }}
      >
        {children}
      </StatusContext.Provider>
    </Context.Provider>
  );
}
/** Only authoring previews use draft values. Public releases stay immutable. */
export function useLivePreview(app: App) {
  const store = useLiveFields();
  const version = useLiveFieldVersion(store);
  return useMemo(() => store?.preview(app) ?? app, [store, app, version]);
}
