import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@agent-native/toolkit/ui/context-menu";

import { cn } from "@/lib/utils";

export interface CanvasMenuItem {
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void;
}

export interface CanvasContextMenuPoint {
  clientX: number;
  clientY: number;
}

export interface CanvasContextMenuHandle {
  /** Open the menu at a client-space point (right-click on the canvas). */
  openAt: (point: CanvasContextMenuPoint) => void;
  close: () => void;
}

/**
 * Canvas right-click menu for the V-Editor (same Radix pattern as figma-alt's
 * design editor): a controlled ContextMenu opened at an explicit point with
 * keyboard navigation, focus management and portal rendering handled by Radix.
 * The trigger just wraps the canvas — its auto-open is suppressed and the
 * host opens the menu programmatically via `openAt` with the right-clicked
 * entity's items.
 */
export const CanvasContextMenu = forwardRef<
  CanvasContextMenuHandle,
  {
    children: ReactNode;
    className?: string;
    items: CanvasMenuItem[];
    onOpenChange?: (open: boolean) => void;
  }
>(function CanvasContextMenu({ children, className, items, onOpenChange }, ref) {
  const [open, setOpen] = useState(false);
  const [point, setPoint] = useState<CanvasContextMenuPoint | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) setPoint(null);
      onOpenChange?.(nextOpen);
    },
    [onOpenChange],
  );

  useImperativeHandle(
    ref,
    () => ({
      openAt(nextPoint) {
        setPoint(nextPoint);
        setPos(null);
        setOpen(true);
      },
      close() {
        handleOpenChange(false);
      },
    }),
    [handleOpenChange],
  );

  // Keep the menu inside the viewport (flip near the edges) once it lays out.
  useLayoutEffect(() => {
    if (!open || !point) return;
    const el = contentRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    setPos({
      left:
        rect.right > window.innerWidth - pad
          ? Math.max(pad, window.innerWidth - rect.width - pad)
          : point.clientX,
      top:
        rect.bottom > window.innerHeight - pad
          ? Math.max(pad, window.innerHeight - rect.height - pad)
          : point.clientY,
    });
  }, [open, point]);

  const manualStyle = point
    ? ({
        position: "fixed",
        left: pos?.left ?? point.clientX,
        top: pos?.top ?? point.clientY,
        transform: "none",
      } satisfies React.CSSProperties)
    : undefined;

  return (
    <ContextMenu open={open} onOpenChange={handleOpenChange}>
      {/* The trigger only hosts the canvas; its own open is suppressed so the
          host can open with the right-clicked entity's items instead. */}
      <ContextMenuTrigger asChild>
        <div
          className={cn("contents", className)}
          onContextMenu={(event) => event.preventDefault()}
        >
          {children}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent
        ref={contentRef}
        style={manualStyle}
        className="min-w-52 data-[state=open]:!animate-none data-[state=closed]:!animate-none"
        onContextMenu={(event) => event.preventDefault()}
      >
        {items.map((item, index) => (
          <div key={index}>
            {item.separatorBefore ? <ContextMenuSeparator className="my-1" /> : null}
            <ContextMenuItem
              disabled={item.disabled}
              onSelect={item.onSelect}
              className={cn(
                "gap-2",
                item.destructive &&
                  !item.disabled &&
                  "text-destructive focus:bg-destructive focus:text-destructive-foreground",
              )}
            >
              {item.icon ? (
                <span className="flex size-4 shrink-0 items-center justify-center [&>svg]:size-4">
                  {item.icon}
                </span>
              ) : null}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            </ContextMenuItem>
          </div>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
});
