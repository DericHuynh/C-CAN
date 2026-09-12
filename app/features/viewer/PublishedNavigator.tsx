import { useEffect, type RefObject, type Ref } from "react";
import { useImperativeHandle } from "react";
import { useLocation, useNavigate } from "react-router";
import type { ViewerTarget } from "@shared/viewer-feedback";
import type { ViewerNavigatorHandle } from "./ViewerNavigator";
import { focusViewerTarget } from "./viewer-feedback";

/** Honor public deep links without adding navigation chrome to the playable document. */
export function PublishedNavigator({
  rootRef,
  ref,
}: {
  rootRef: RefObject<HTMLDivElement | null>;
  ref?: Ref<ViewerNavigatorHandle>;
}) {
  const location = useLocation(),
    navigate = useNavigate();
  function jump(target: ViewerTarget) {
    const query = new URLSearchParams(location.search);
    for (const key of ["rowId", "choiceId", "addonId"] as const) {
      query.delete(key);
      if (target[key]) query.set(key, target[key]!);
    }
    navigate(`${location.pathname}?${query}`, { preventScrollReset: true });
    if (rootRef.current) focusViewerTarget(rootRef.current, target);
  }
  useImperativeHandle(ref, () => ({ jump }));
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const target = Object.fromEntries(
      ["rowId", "choiceId", "addonId"].flatMap((key) =>
        query.get(key) ? [[key, query.get(key)!]] : [],
      ),
    );
    if (rootRef.current) focusViewerTarget(rootRef.current, target);
  }, [location.key, location.search, rootRef]);
  return null;
}
