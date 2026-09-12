import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Figma-style inline text editor for the V-Editor canvas.
 *
 * Double-clicking a title/description makes the element itself contenteditable
 * (like figma-alt's editor-chrome bridge), so text is edited exactly in place
 * with the CYOA's own styling — no panel, no layout jump. Follows the Figma
 * conventions used there: Enter inserts a line break, Escape commits, and
 * blurring (clicking away) commits.
 */
export function InlineTextEditor({
  as = "p",
  html,
  style,
  className,
  onCommit,
}: {
  /** Element to render — matches the element being edited (h2/h3/p). */
  as?: "h2" | "h3" | "p";
  /** Initial rendered HTML (from `renderHtml`) to seed the editable. */
  html: string;
  /** Text styling from the CYOA cascade (font/size/color/padding/...). */
  style?: React.CSSProperties;
  /** Extra classes to match the replaced element (e.g. `font-semibold`). */
  className?: string;
  /** Committed as plain text (tags stripped) when the session ends. */
  onCommit: (value: string) => void;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const committed = useRef(false);

  // Seed the rendered content once. Never re-seed: React doesn't manage the
  // editable's children, so in-progress edits survive parent re-renders.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.innerHTML !== html) el.innerHTML = html;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus and select all on mount so typing replaces the whole text (like
  // double-clicking a Figma text layer). Deferred a frame so it wins the race
  // against Radix menu-close focus restoration when editing starts from a
  // context-menu item.
  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
    return () => window.cancelAnimationFrame(raf);
  }, []);

  function commit() {
    if (committed.current) return;
    committed.current = true;
    onCommit(ref.current?.textContent ?? "");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    // Figma convention: Escape commits and exits the session.
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      commit();
      ref.current?.blur();
      return;
    }
    // Figma convention: Enter inserts a line break instead of committing.
    // Insert a literal "\n" (like figma-alt's insertLineBreak) rather than
    // letting the browser build <div>/<br> blocks — those collapse away when
    // the committed text is read back as textContent.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      document.execCommand("insertText", false, "\n");
    }
  }

  const Tag = as as React.ElementType;
  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      role="textbox"
      aria-multiline="true"
      aria-label="Edit text"
      onBlur={commit}
      onKeyDown={handleKeyDown}
      // Keep the canvas row/choice click handlers from stealing the event.
      onMouseDown={(event: React.MouseEvent<HTMLElement>) => event.stopPropagation()}
      onClick={(event: React.MouseEvent<HTMLElement>) => event.stopPropagation()}
      onDoubleClick={(event: React.MouseEvent<HTMLElement>) => event.stopPropagation()}
      onContextMenu={(event: React.MouseEvent<HTMLElement>) => event.stopPropagation()}
      className={cn(
        "cursor-text rounded-sm bg-primary/5 caret-primary outline-none ring-2 ring-primary/70",
        className,
      )}
      style={style}
    />
  );
}
