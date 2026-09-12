import { type ReactNode } from "react";
import { IconArrowDown, IconArrowUp, IconPencil, IconTrash } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { VisualEditAction } from "./types";
import type { VisualSelection } from "./types";

/** Every row/choice always exposes edit, move and delete actions. */
export function EditToolbar({
  kind,
  selection,
  canMoveUp = true,
  canMoveDown = true,
  onAction,
}: {
  kind: VisualSelection["kind"];
  selection: VisualSelection;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onAction?: (action: VisualEditAction, selection: VisualSelection) => void;
}) {
  const fire =
    (action: VisualEditAction) =>
    (event: React.MouseEvent): void => {
      event.stopPropagation();
      onAction?.(action, selection);
    };
  return (
    <div
      className="absolute right-1 top-1 z-20 flex items-center gap-0.5 rounded-md border border-border bg-popover/95 p-0.5 shadow-sm backdrop-blur"
      role="toolbar"
      aria-label={`${kind === "row" ? "Row" : "Choice"} actions`}
      onClick={(event) => event.stopPropagation()}
    >
      <ToolbarButton label="Edit" onClick={fire("edit")}>
        <IconPencil className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Move up" disabled={!canMoveUp} onClick={fire("move-up")}>
        <IconArrowUp className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Move down" disabled={!canMoveDown} onClick={fire("move-down")}>
        <IconArrowDown className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Delete" destructive onClick={fire("delete")}>
        <IconTrash className="size-3.5" />
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  disabled = false,
  destructive = false,
  children,
}: {
  label: string;
  onClick: (event: React.MouseEvent) => void;
  disabled?: boolean;
  destructive?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        destructive && "hover:bg-destructive hover:text-destructive-foreground",
        disabled &&
          "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Row                                                                */
/* ------------------------------------------------------------------ */
