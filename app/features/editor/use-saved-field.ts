import { useEffect, useId, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { mergeCollaborativeValue, sameValue } from "@shared/collaboration-merge";
import { useDraftRegistry } from "./DraftCollaboration";
import { useLiveFields, useLiveFieldVersion } from "./LiveProjectFields";
import { canShareLiveValue, readLivePath, type LivePath } from "./live-fields";
import { useEditorProject } from "./EditorProjectContext";

/** Reconcile shared saved values, retaining local edits and flagging overlaps. */
export function useSavedField<T>(
  value: T | (() => T),
  path?: LivePath | null,
): [T, Dispatch<SetStateAction<T>>] {
  const project = useEditorProject();
  const canonical = project && path ? readLivePath(project.app, path) : undefined;
  const initial = typeof value === "function" ? (value as () => T)() : value;
  // Legacy documents can contain null where the form intentionally supplies a
  // string/default. Only use the raw baseline when its shape matches the input.
  const saved =
    canonical !== undefined &&
    typeof canonical === typeof initial &&
    Array.isArray(canonical) === Array.isArray(initial) &&
    (canonical !== null || initial === null)
      ? (canonical as T)
      : initial;
  const [state, setState] = useState({ saved, draft: saved, conflict: false });
  const id = useId();
  const registry = useDraftRegistry();
  const live = useLiveFields();
  useLiveFieldVersion(live);
  const attached = useRef(live);
  const connectionConflict = useRef(false);
  const attaching = !!live && attached.current !== live;
  const buffered = attaching && !sameValue(state.draft, state.saved);
  useEffect(() => {
    if (!attaching || !live || !path) return;
    attached.current = live;
    if (!buffered) return;
    const remote = live.read(path, saved);
    if (sameValue(remote, saved) || sameValue(remote, state.draft))
      live.write(path, saved, state.draft);
    else {
      connectionConflict.current = true;
      setState((previous) => ({ ...previous, conflict: true }));
    }
  }, [attaching, buffered, live, JSON.stringify(path), saved]);
  let current = state;
  if (!sameValue(saved, state.saved)) {
    let conflict = state.conflict;
    const draft =
      live && path && live.has(path, saved)
        ? live.read(path, saved)
        : mergeCollaborativeValue(state.saved, state.draft, saved, "", () => {
            conflict = true;
          });
    current = { saved, draft, conflict: conflict && !sameValue(draft, saved) };
    setState(current);
  }
  useEffect(() => {
    if (current.conflict)
      registry?.set(
        id,
        (keep) => {
          const value = keep
            ? current.draft
            : connectionConflict.current && live && path
              ? live.read(path, current.saved)
              : current.saved;
          connectionConflict.current = false;
          if (live && path) live.write(path, current.saved, value);
          setState((previous) => ({ ...previous, draft: value, conflict: false }));
        },
        connectionConflict.current && live && path ? live.read(path, current.saved) : current.saved,
        current.draft,
      );
    else registry?.delete(id);
    return () => registry?.delete(id);
  }, [registry, id, current.conflict, current.saved, current.draft]);
  const draft =
    !buffered &&
    !connectionConflict.current &&
    live &&
    path &&
    canShareLiveValue(current.draft) &&
    canShareLiveValue(saved) &&
    live.has(path, saved)
      ? live.read(path, saved)
      : current.draft;
  if (
    !sameValue(draft, current.draft) ||
    (current.conflict && !connectionConflict.current && live && path && live.has(path, saved))
  )
    setState({
      ...current,
      draft,
      conflict:
        !connectionConflict.current && live && path && live.has(path, saved)
          ? false
          : current.conflict,
    });
  const latest = useRef({ draft, saved, live, path });
  latest.current = { draft, saved, live, path };
  return [
    draft,
    (next) => {
      const {
        draft: currentDraft,
        saved: currentSaved,
        live: currentLive,
        path: currentPath,
      } = latest.current;
      const value = typeof next === "function" ? (next as (value: T) => T)(currentDraft) : next;
      latest.current.draft = value;
      if (currentLive && currentPath) currentLive.write(currentPath, currentSaved, value);
      setState((previous) => ({
        ...previous,
        draft: value,
      }));
    },
  ];
}

export function useSavedRecord(saved: Record<string, unknown>, path?: LivePath) {
  return useSavedField(saved, path);
}
