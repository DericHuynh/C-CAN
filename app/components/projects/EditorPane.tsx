import { useEffect, useId, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useSaveShortcut } from "@/hooks/use-save-shortcut";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Detail-pane chrome for the master/detail editors: a sticky card with a
 * title, the editor form, and Cancel / Save actions in the footer.
 *
 * The card sticks to the top of its column on wide screens and scrolls
 * internally so long forms (e.g. the choice editor's accordion) never push
 * the master list off the page.
 */
export function EditorPane({
  title,
  description,
  children,
  busy,
  saveLabel = "Save",
  canSave = true,
  onCancel,
  onSave,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  busy?: boolean;
  saveLabel?: string;
  canSave?: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const titleId = useId();
  const headingRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  useSaveShortcut(cardRef, onSave, !busy && canSave);
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const isNarrow = window.matchMedia("(max-width: 1023px)").matches;
    const updateHeight = () => {
      const available = window.innerHeight - Math.max(0, card.getBoundingClientRect().top) - 16;
      card.style.setProperty("--editor-available-height", `${Math.max(240, available)}px`);
    };
    updateHeight();
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateHeight) : null;
    observer?.observe(card);
    window.addEventListener("resize", updateHeight);
    window.addEventListener("scroll", updateHeight, true);
    if (isNarrow) {
      headingRef.current?.focus({ preventScroll: true });
      headingRef.current?.scrollIntoView({ block: "start" });
    }
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateHeight);
      window.removeEventListener("scroll", updateHeight, true);
      // Closing a stacked form should return to its opener. Navigating to a
      // different control has already moved focus and must not be interrupted.
      if (
        isNarrow &&
        previousFocus !== document.body &&
        previousFocus?.isConnected &&
        (document.activeElement === document.body || card.contains(document.activeElement))
      ) {
        previousFocus.focus({ preventScroll: true });
        previousFocus.scrollIntoView({ block: "nearest" });
      }
    };
  }, []);

  return (
    <Card
      ref={cardRef}
      data-editor-pane
      role="region"
      aria-labelledby={titleId}
      aria-busy={Boolean(busy)}
      className="lg:sticky lg:top-0 lg:flex lg:max-h-[var(--editor-available-height)] lg:flex-col lg:overflow-hidden"
    >
      <CardHeader
        ref={headingRef}
        tabIndex={-1}
        className="shrink-0 scroll-mt-4 focus:outline-none"
      >
        <CardTitle id={titleId} className="text-base">
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent data-editor-scroll className="min-h-0 space-y-4 lg:overflow-y-auto">
        {children}
      </CardContent>
      <CardFooter className="sticky bottom-0 z-10 shrink-0 flex-wrap justify-end gap-2 border-t bg-card px-6 py-4">
        <span className="mr-auto text-xs text-muted-foreground" title="Outside text fields">
          Shift + S to save
        </span>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onSave}
          disabled={busy || !canSave}
          aria-keyshortcuts="Shift+S"
        >
          {busy ? "Saving…" : saveLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}
