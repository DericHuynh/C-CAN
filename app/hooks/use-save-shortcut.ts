import { useEffect, type RefObject } from "react";

/** Shift+S saves the active editor without consuming ordinary capital-S input. */
export function useSaveShortcut(
  scope: RefObject<HTMLElement | null>,
  onSave: () => void,
  enabled = true,
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        !event.shiftKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.key.toLowerCase() !== "s"
      )
        return;
      const target = event.target instanceof Element ? event.target : null;
      if (
        target?.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
        )
      )
        return;
      const overlay = target?.closest('[role="dialog"], [role="alertdialog"]');
      if (overlay && !scope.current?.contains(overlay)) return;
      if (!scope.current || scope.current.closest('[hidden], [aria-hidden="true"]')) return;
      event.preventDefault();
      if (enabled && !event.repeat) onSave();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [scope, onSave, enabled]);
}
