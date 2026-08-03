import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  IconChevronDown,
  IconChevronRight,
  IconGripVertical,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolveImageRef } from "@shared/cyoa";
import type { App, Choice, PointType, Row } from "@shared/types";

import { LazyImage } from "./LazyImage";
import { formatScoreChip, sortedChoices } from "./project-utils";

/** What is being dragged. */
type DragPayload =
  | { kind: "row"; id: string }
  | { kind: "choice"; id: string; sourceRowId: string }
  | { kind: "addon"; id: string; sourceChoiceId: string; addonIndex: number };

/** Where a drop would land. */
type DropTarget =
  | { kind: "row"; id: string; position: "before" | "after" | "inside" }
  | { kind: "choice"; id: string; position: "before" | "after" | "inside" }
  | { kind: "addon"; id: string; position: "before" | "after" };

/** Addon identity is positional (addons have no id): `${choiceId}:${index}`. */
const addonKey = (choiceId: string, index: number) => `${choiceId}:${index}`;

/** Node a right-click context menu was opened on. */
type ContextTarget =
  | { kind: "row"; id: string }
  | { kind: "choice"; id: string; rowId: string }
  | { kind: "addon"; choiceId: string; addonIndex: number };

/** Open context-menu state (cursor position + the node it was opened on). */
interface ContextMenuState {
  x: number;
  y: number;
  target: ContextTarget;
}

export interface RowTreeProps {
  rows: Row[];
  app: App;
  pointTypes: PointType[];
  groups: { id: string; name: string }[];
  /** Global index of `rows[0]` (0 unless the rows come from a page). */
  rowOffset?: number;
  /** Row ids to force-expand (e.g. rows matching the current filter). */
  autoExpandIds?: Set<string>;
  /** Node key of the currently selected item (`row:${id}`, `choice:${id}`, `addon:${choiceId}:${index}`). */
  selectedKey?: string | null;
  onEditRow: (row: Row) => void;
  onAddChoice: (row: Row) => void;
  onDeleteRow: (row: Row) => void;
  onMoveRow: (rowId: string, index: number) => void;
  onEditChoice: (choice: Choice, row: Row) => void;
  onDeleteChoice: (choice: Choice, row: Row) => void;
  onMoveChoice: (targetRowId: string, choiceId: string, index: number) => void;
  onEditAddon: (choice: Choice, row: Row) => void;
  onDeleteAddon: (choiceId: string, addonIndex: number) => void;
  onMoveAddon: (
    sourceChoiceId: string,
    addonIndex: number,
    targetChoiceId: string,
    targetIndex: number,
  ) => void;
  /** Right-click insert: add a row above/below the given row. */
  onAddRowAt: (rowId: string, position: "above" | "below") => void;
  /** Right-click insert: add a choice above/below the given choice. */
  onAddChoiceAt: (rowId: string, choiceId: string, position: "above" | "below") => void;
  /** Right-click insert: add an addon above/below the given addon. */
  onAddAddonAt: (choiceId: string, addonIndex: number, position: "above" | "below") => void;
}

/**
 * Tree editor for the Rows tab: rows → choices → addons, each with a small
 * cropped thumbnail and delete actions on the right. Click a branch to open it
 * in the detail pane; drag only from the grip dots on the left to reorder or
 * reparent (rows against rows, choices within/between rows, addons within/
 * between choices).
 *
 * The tree is paginated by the parent (RowsPanel): `rows` is one page and
 * `rowOffset` is the page's first row's global index, so drag targets and the
 * "Row N" badges refer to positions in the whole document.
 *
 * Row and choice cards are memoized so changing the selection re-renders only
 * the row that owns the selected node.
 */
export const RowTree = memo(function RowTree({
  rows,
  app,
  pointTypes,
  groups,
  rowOffset = 0,
  autoExpandIds,
  selectedKey,
  onEditRow,
  onAddChoice,
  onDeleteRow,
  onMoveRow,
  onEditChoice,
  onDeleteChoice,
  onMoveChoice,
  onEditAddon,
  onDeleteAddon,
  onMoveAddon,
  onAddRowAt,
  onAddChoiceAt,
  onAddAddonAt,
}: RowTreeProps) {
  const [collapsedRows, setCollapsedRows] = useState<Set<string>>(new Set());
  const [collapsedChoices, setCollapsedChoices] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<DragPayload | null>(null);
  const [drop, setDrop] = useState<DropTarget | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const toggleRow = useCallback((rowId: string) => {
    setCollapsedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);

  const toggleChoice = useCallback((choiceId: string) => {
    setCollapsedChoices((prev) => {
      const next = new Set(prev);
      if (next.has(choiceId)) next.delete(choiceId);
      else next.add(choiceId);
      return next;
    });
  }, []);

  const clearDrag = useCallback(() => {
    setDrag(null);
    setDrop(null);
  }, []);

  /** Open the cursor-positioned context menu for a node (stopPropagation so
   *  nested nodes don't let the event bubble to their parent's menu). */
  const openContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>, target: ContextTarget) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({ x: event.clientX, y: event.clientY, target });
    },
    [],
  );

  const handleDragStart = useCallback(
    (event: DragEvent<HTMLDivElement>, payload: DragPayload) => {
      startDrag(event, payload, setDrag);
    },
    [],
  );

  /** The drop handler closes over the `drag` state fallback; only its
   *  identity changes during an active drag (rare). */
  const handleDropAt = useCallback(
    (event: DragEvent<HTMLDivElement>, targetBase: { kind: "row" | "choice" | "addon"; id: string }) => {
      const payload = payloadFromEvent(event, drag);
      if (!payload) return;
      const insideAllowed =
        (targetBase.kind === "choice" && payload.kind === "addon") ||
        (targetBase.kind === "row" && payload.kind === "choice");
      const position = positionFromY(event, insideAllowed);
      const target: DropTarget = { ...targetBase, position } as DropTarget;
      handleDrop(target, event, payload, {
        rows,
        drag,
        rowOffset,
        clearDrag,
        onMoveRow,
        onMoveChoice,
        onMoveAddon,
      });
    },
    [drag, rows, rowOffset, clearDrag, onMoveRow, onMoveChoice, onMoveAddon],
  );

  // Which row owns the current selection (so only that row sees a changing
  // childSelectedKey and re-renders when the highlight moves).
  const selectedRowId = useMemo(() => {
    if (!selectedKey) return null;
    if (selectedKey.startsWith("row:")) return selectedKey.slice(4);
    const id = selectedKey.startsWith("choice:")
      ? selectedKey.slice(7)
      : selectedKey.startsWith("addon:")
        ? selectedKey.slice(6).split(":")[0]
        : null;
    if (!id) return null;
    return rows.find((row) => (row.objects ?? []).some((c) => c.id === id))?.id ?? null;
  }, [selectedKey, rows]);

  return (
    <div className="space-y-2" onDragEnd={clearDrag}>
      {rows.map((row, rowIndex) => {
        const forceExpand = Boolean(autoExpandIds?.has(row.id));
        return (
          <TreeRow
            key={row.id}
            row={row}
            rowNumber={rowOffset + rowIndex + 1}
            collapsed={!forceExpand && collapsedRows.has(row.id)}
            selected={selectedKey === `row:${row.id}`}
            childSelectedKey={selectedRowId === row.id ? (selectedKey ?? null) : null}
            collapsedChoiceIds={collapsedChoices}
            app={app}
            pointTypes={pointTypes}
            groups={groups}
            drag={drag}
            drop={drop}
            setDrag={setDrag}
            setDrop={setDrop}
            onToggleRow={toggleRow}
            onToggleChoice={toggleChoice}
            onDragStart={handleDragStart}
            onDropAt={handleDropAt}
            onEditRow={onEditRow}
            onAddChoice={onAddChoice}
            onDeleteRow={onDeleteRow}
            onEditChoice={onEditChoice}
            onDeleteChoice={onDeleteChoice}
            onEditAddon={onEditAddon}
            onDeleteAddon={onDeleteAddon}
            onOpenContextMenu={openContextMenu}
          />
        );
      })}
      {contextMenu ? (
        <ContextMenuPop
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onAddRowAt={onAddRowAt}
          onAddChoiceAt={onAddChoiceAt}
          onAddAddonAt={onAddAddonAt}
        />
      ) : null}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Row card (memoized — selection changes only re-render the owning row) */
/* ------------------------------------------------------------------ */

const TreeRow = memo(function TreeRow({
  row,
  rowNumber,
  collapsed,
  selected,
  childSelectedKey,
  collapsedChoiceIds,
  app,
  pointTypes,
  groups,
  drag,
  drop,
  setDrag,
  setDrop,
  onToggleRow,
  onToggleChoice,
  onDragStart,
  onDropAt,
  onEditRow,
  onAddChoice,
  onDeleteRow,
  onEditChoice,
  onDeleteChoice,
  onEditAddon,
  onDeleteAddon,
  onOpenContextMenu,
}: {
  row: Row;
  /** 1-based row number within the whole document (across pages). */
  rowNumber: number;
  collapsed: boolean;
  selected: boolean;
  childSelectedKey: string | null;
  /** Collapsed choice ids (owned by the tree root so they survive paging). */
  collapsedChoiceIds: Set<string>;
  app: App;
  pointTypes: PointType[];
  groups: { id: string; name: string }[];
  drag: DragPayload | null;
  drop: DropTarget | null;
  setDrag: (p: DragPayload | null) => void;
  setDrop: (t: DropTarget | null) => void;
  onToggleRow: (rowId: string) => void;
  onToggleChoice: (choiceId: string) => void;
  onDragStart: (event: DragEvent<HTMLDivElement>, payload: DragPayload) => void;
  onDropAt: (
    event: DragEvent<HTMLDivElement>,
    target: { kind: "row" | "choice" | "addon"; id: string },
  ) => void;
  onEditRow: (row: Row) => void;
  onAddChoice: (row: Row) => void;
  onDeleteRow: (row: Row) => void;
  onEditChoice: (choice: Choice, row: Row) => void;
  onDeleteChoice: (choice: Choice, row: Row) => void;
  onEditAddon: (choice: Choice, row: Row) => void;
  onDeleteAddon: (choiceId: string, addonIndex: number) => void;
  onOpenContextMenu: (event: ReactMouseEvent<HTMLDivElement>, target: ContextTarget) => void;
}) {
  const choices = useMemo(() => sortedChoices(row), [row]);
  const rowImage = useMemo(() => resolveImageRef(app, row.image), [app, row.image]);
  const childrenMounted = !collapsed;

  return (
    <div data-row-id={row.id} className="rounded-lg border border-border bg-card">
      <TreeNode
        indent={0}
        isDragging={drag?.kind === "row" && drag.id === row.id}
        selected={selected}
        dropIndicator={drop?.kind === "row" && drop.id === row.id ? drop.position : null}
        onDragStart={(event) => onDragStart(event, { kind: "row", id: row.id })}
        onDragOver={(event) =>
          (drag?.kind === "row" || drag?.kind === "choice") &&
          rowOverTarget(event, { kind: "row", id: row.id }, drag, setDrop)
        }
        onDrop={(event) => onDropAt(event, { kind: "row", id: row.id })}
        onClick={() => onEditRow(row)}
        onContextMenu={(event) => onOpenContextMenu(event, { kind: "row", id: row.id })}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 text-muted-foreground"
          onClick={(event) => {
            event.stopPropagation();
            onToggleRow(row.id);
          }}
          aria-label={collapsed ? "Expand row" : "Collapse row"}
          title={collapsed ? "Expand row" : "Collapse row"}
        >
          {collapsed ? <IconChevronRight className="size-4" /> : <IconChevronDown className="size-4" />}
        </Button>
        {rowImage ? (
          <LazyImage
            src={rowImage}
            alt=""
            className="size-16 shrink-0 rounded-md border border-border object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="shrink-0">
              Row {rowNumber}
            </Badge>
            <span className="truncate text-sm font-semibold">{row.title}</span>
          </div>
          {row.titleText ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{row.titleText}</p>
          ) : null}
        </div>
        <NodeActions onAdd={() => onAddChoice(row)} onDelete={() => onDeleteRow(row)} />
      </TreeNode>

      {childrenMounted ? (
        <div className="space-y-1.5 border-t border-border/60 p-2 pl-8">
          {choices.length === 0 ? (
            <p className="py-1 pl-8 text-xs text-muted-foreground">No choices yet — add one.</p>
          ) : (
            choices.map((choice) => (
              <TreeChoice
                key={choice.id}
                choice={choice}
                row={row}
                app={app}
                pointTypes={pointTypes}
                groups={groups}
                collapsedChoiceIds={collapsedChoiceIds}
                selectedKey={childSelectedKey}
                drag={drag}
                drop={drop}
                setDrag={setDrag}
                setDrop={setDrop}
                onToggleChoice={onToggleChoice}
                onDragStart={onDragStart}
                onDropAt={onDropAt}
                onEditChoice={onEditChoice}
                onDeleteChoice={onDeleteChoice}
                onEditAddon={onEditAddon}
                onDeleteAddon={onDeleteAddon}
                onOpenContextMenu={onOpenContextMenu}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Choice card (memoized per choice)                                   */
/* ------------------------------------------------------------------ */

const TreeChoice = memo(function TreeChoice({
  choice,
  row,
  app,
  pointTypes,
  groups,
  collapsedChoiceIds,
  selectedKey,
  drag,
  drop,
  setDrag,
  setDrop,
  onToggleChoice,
  onDragStart,
  onDropAt,
  onEditChoice,
  onDeleteChoice,
  onEditAddon,
  onDeleteAddon,
  onOpenContextMenu,
}: {
  choice: Choice;
  row: Row;
  app: App;
  pointTypes: PointType[];
  groups: { id: string; name: string }[];
  /** Collapsed choice ids (owned by the tree root so they survive paging). */
  collapsedChoiceIds: Set<string>;
  /** The selection key owned by the parent row (`choice:…` or `addon:…`). */
  selectedKey: string | null;
  drag: DragPayload | null;
  drop: DropTarget | null;
  setDrag: (p: DragPayload | null) => void;
  setDrop: (t: DropTarget | null) => void;
  onToggleChoice: (choiceId: string) => void;
  onDragStart: (event: DragEvent<HTMLDivElement>, payload: DragPayload) => void;
  onDropAt: (
    event: DragEvent<HTMLDivElement>,
    target: { kind: "row" | "choice" | "addon"; id: string },
  ) => void;
  onEditChoice: (choice: Choice, row: Row) => void;
  onDeleteChoice: (choice: Choice, row: Row) => void;
  onEditAddon: (choice: Choice, row: Row) => void;
  onDeleteAddon: (choiceId: string, addonIndex: number) => void;
  onOpenContextMenu: (event: ReactMouseEvent<HTMLDivElement>, target: ContextTarget) => void;
}) {
  const addons = choice.addons ?? [];
  const choiceCollapsed = collapsedChoiceIds.has(choice.id);
  const choiceImage = useMemo(() => resolveImageRef(app, choice.image), [app, choice.image]);
  const groupName = (groupId: string) =>
    groups.find((group) => group.id === groupId)?.name ?? groupId;

  return (
    <div>
      <TreeNode
        indent={1}
        isDragging={drag?.kind === "choice" && drag.id === choice.id}
        selected={selectedKey === `choice:${choice.id}`}
        dropIndicator={drop?.kind === "choice" && drop.id === choice.id ? drop.position : null}
        onDragStart={(event) =>
          onDragStart(event, { kind: "choice", id: choice.id, sourceRowId: row.id })
        }
        onDragOver={(event) =>
          drag?.kind === "choice" &&
          choiceOverTarget(event, { kind: "choice", id: choice.id }, drag, setDrop)
        }
        onDrop={(event) => onDropAt(event, { kind: "choice", id: choice.id })}
        onClick={() => onEditChoice(choice, row)}
        onContextMenu={(event) =>
          onOpenContextMenu(event, { kind: "choice", id: choice.id, rowId: row.id })
        }
      >
        {addons.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 text-muted-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onToggleChoice(choice.id);
            }}
            aria-label={choiceCollapsed ? "Expand choice" : "Collapse choice"}
            title={choiceCollapsed ? "Expand choice" : "Collapse choice"}
          >
            {choiceCollapsed ? <IconChevronRight className="size-4" /> : <IconChevronDown className="size-4" />}
          </Button>
        ) : (
          <span className="w-6 shrink-0" />
        )}
        {choiceImage ? (
          <LazyImage
            src={choiceImage}
            alt=""
            className="size-16 shrink-0 rounded-md border border-border object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-medium">{choice.title}</span>
            {(choice.scores ?? []).map((score, index) => (
              <Badge
                key={`${score.id ?? score.type}-${index}`}
                variant="secondary"
                className="max-w-40 truncate"
              >
                {formatScoreChip(score, pointTypes)}
              </Badge>
            ))}
            {(choice.groups ?? []).map((groupId) => (
              <Badge key={groupId} variant="outline" className="max-w-24 truncate">
                {groupName(groupId)}
              </Badge>
            ))}
          </div>
          {choice.text ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{choice.text}</p>
          ) : null}
        </div>
        <NodeActions onDelete={() => onDeleteChoice(choice, row)} />
      </TreeNode>

      {addons.length > 0 && !choiceCollapsed ? (
        <div className="mt-1 space-y-1 pl-8">
          {addons.map((addon, addonIndex) => {
            const key = addonKey(choice.id, addonIndex);
            const addonImage = resolveImageRef(app, addon.image);
            return (
              <TreeNode
                key={key}
                indent={2}
                isDragging={
                  drag?.kind === "addon" &&
                  drag.sourceChoiceId === choice.id &&
                  drag.addonIndex === addonIndex
                }
                selected={selectedKey === `addon:${choice.id}:${addonIndex}`}
                dropIndicator={drop?.kind === "addon" && drop.id === key ? drop.position : null}
                onDragStart={(event) =>
                  onDragStart(event, {
                    kind: "addon",
                    id: key,
                    sourceChoiceId: choice.id,
                    addonIndex,
                  })
                }
                onDragOver={(event) =>
                  drag?.kind === "addon" &&
                  addonOverTarget(event, { kind: "addon", id: key }, drag, setDrop)
                }
                onDrop={(event) => onDropAt(event, { kind: "addon", id: key })}
                onClick={() => onEditAddon(choice, row)}
                onContextMenu={(event) =>
                  onOpenContextMenu(event, { kind: "addon", choiceId: choice.id, addonIndex })
                }
              >
                {addonImage ? (
                  <LazyImage
                    src={addonImage}
                    alt=""
                    className="size-16 shrink-0 rounded-md border border-border object-cover"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="shrink-0">
                      Addon
                    </Badge>
                    <span className="truncate text-sm">{addon.title || "Untitled addon"}</span>
                  </div>
                  {addon.text ? (
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{addon.text}</p>
                  ) : null}
                </div>
                <NodeActions onDelete={() => onDeleteAddon(choice.id, addonIndex)} />
              </TreeNode>
            );
          })}
        </div>
      ) : null}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Drop logic                                                          */
/* ------------------------------------------------------------------ */

function startDrag(
  event: DragEvent<HTMLDivElement>,
  payload: DragPayload,
  setDrag: (p: DragPayload | null) => void,
) {
  event.dataTransfer.effectAllowed = "move";
  setDrag(payload);
  // Persist through the drag so the drop reads the exact node even if React
  // state settles late.
  event.dataTransfer.setData("application/x-cyoa-node", JSON.stringify(payload));
}

/**
 * The drag payload, preferring the dataTransfer written at dragstart (never
 * races React state) over the `drag` state.
 */
function payloadFromEvent(event: DragEvent, drag: DragPayload | null): DragPayload | null {
  try {
    const raw = event.dataTransfer.getData("application/x-cyoa-node");
    if (raw) return JSON.parse(raw) as DragPayload;
  } catch {
    // fall through to React state
  }
  return drag;
}

/** Index of an item in a list after removing `dragIndex` (-1 = cross-list). */
function indexAfterRemoval(
  items: unknown[],
  dragIndex: number,
  siblingIndex: number,
  position: "before" | "after",
): number {
  let idx = siblingIndex;
  if (dragIndex !== -1 && dragIndex < siblingIndex) idx -= 1;
  if (position === "after") idx += 1;
  return Math.max(0, Math.min(idx, items.length - (dragIndex !== -1 ? 1 : 0)));
}

/** Apply a drop. `payload` is resolved by the caller (dataTransfer first). */
function handleDrop(
  target: DropTarget,
  event: DragEvent<HTMLDivElement>,
  payload: DragPayload,
  ctx: {
    rows: Row[];
    drag: DragPayload | null;
    rowOffset: number;
    clearDrag: () => void;
    onMoveRow: (rowId: string, index: number) => void;
    onMoveChoice: (targetRowId: string, choiceId: string, index: number) => void;
    onMoveAddon: (
      sourceChoiceId: string,
      addonIndex: number,
      targetChoiceId: string,
      targetIndex: number,
    ) => void;
  },
) {
  const { rows, drag, rowOffset, clearDrag, onMoveRow, onMoveChoice, onMoveAddon } = ctx;
  const { kind } = payload;

  if (kind === "row" && target.kind === "row" && target.position !== "inside") {
    const dragIndex = rows.findIndex((r) => r.id === payload.id);
    const targetIndex = rows.findIndex((r) => r.id === target.id);
    if (dragIndex === -1 || targetIndex === -1 || dragIndex === targetIndex) return;
    onMoveRow(payload.id, rowOffset + indexAfterRemoval(rows, dragIndex, targetIndex, target.position));
  } else if (kind === "choice") {
    if (target.kind === "row" && target.position === "inside") {
      // Drop onto a row header -> append to that row.
      const targetRow = rows.find((r) => r.id === target.id);
      if (!targetRow) return;
      onMoveChoice(targetRow.id, payload.id, targetRow.objects?.length ?? 0);
    } else if (target.kind === "choice" && target.position !== "inside") {
      const targetChoiceRow = rows.find((r) => (r.objects ?? []).some((c) => c.id === target.id));
      if (!targetChoiceRow) return;
      const targetChoices = sortedChoices(targetChoiceRow);
      const targetChoiceIndex = targetChoices.findIndex((c) => c.id === target.id);
      if (targetChoiceIndex === -1) return;
      const sameRow = payload.sourceRowId === targetChoiceRow.id;
      const dragChoiceIndex = sameRow ? targetChoices.findIndex((c) => c.id === payload.id) : -1;
      const index = indexAfterRemoval(
        targetChoices,
        dragChoiceIndex,
        targetChoiceIndex,
        target.position,
      );
      onMoveChoice(targetChoiceRow.id, payload.id, index);
    }
  } else if (kind === "addon") {
    if (target.kind === "choice") {
      // Drop onto a choice header -> append to that choice.
      const targetChoice = findChoice(rows, target.id);
      if (!targetChoice) return;
      const count = targetChoice.addons?.length ?? 0;
      const same = target.id === payload.sourceChoiceId;
      onMoveAddon(payload.sourceChoiceId, payload.addonIndex, target.id, count - (same ? 1 : 0));
    } else if (target.kind === "addon") {
      const [targetChoiceId, targetIdxStr] = target.id.split(":");
      const targetChoice = findChoice(rows, targetChoiceId);
      if (!targetChoice) return;
      const targetAddons = targetChoice.addons ?? [];
      const targetAddonIndex = Number(targetIdxStr);
      if (
        !Number.isInteger(targetAddonIndex) ||
        targetAddonIndex < 0 ||
        targetAddonIndex >= targetAddons.length
      ) {
        return;
      }
      const same = targetChoiceId === payload.sourceChoiceId;
      const dragAddonIndex = same ? payload.addonIndex : -1;
      const index = indexAfterRemoval(
        targetAddons,
        dragAddonIndex,
        targetAddonIndex,
        target.position,
      );
      onMoveAddon(payload.sourceChoiceId, payload.addonIndex, targetChoiceId, index);
    }
  }
  clearDrag();
}

function findChoice(rows: Row[], id: string): Choice | undefined {
  for (const row of rows) {
    const choice = (row.objects ?? []).find((c) => c.id === id);
    if (choice) return choice;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Drag-over helpers                                                   */
/* ------------------------------------------------------------------ */

function positionFromY(event: DragEvent, insideAllowed: boolean): "before" | "after" | "inside" {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  if (insideAllowed) {
    const third = rect.height / 3;
    if (event.clientY < rect.top + third) return "before";
    if (event.clientY > rect.bottom - third) return "after";
    return "inside";
  }
  return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
}

/** Rows: row payloads drop before/after; choice payloads can also drop
 *  "inside" (append to the row). */
function rowOverTarget(
  event: DragEvent,
  target: { kind: "row"; id: string },
  drag: DragPayload,
  setDrop: (t: DropTarget | null) => void,
) {
  if (drag.id === target.id) return;
  if (drag.kind === "row") {
    event.preventDefault();
    setDrop({
      kind: "row",
      id: target.id,
      position: positionFromY(event, false) as "before" | "after",
    });
  } else if (drag.kind === "choice") {
    event.preventDefault();
    setDrop({ kind: "row", id: target.id, position: positionFromY(event, true) });
  }
}

/** Choices: choice payloads drop before/after; addon payloads drop inside. */
function choiceOverTarget(
  event: DragEvent,
  target: { kind: "choice"; id: string },
  drag: DragPayload,
  setDrop: (t: DropTarget | null) => void,
) {
  if (drag.kind === "row" || drag.id === target.id) return;
  event.preventDefault();
  setDrop({ kind: "choice", id: target.id, position: positionFromY(event, drag.kind === "addon") });
}

/** Addons: only addon payloads drop, before/after. */
function addonOverTarget(
  event: DragEvent,
  target: { kind: "addon"; id: string },
  drag: DragPayload,
  setDrop: (t: DropTarget | null) => void,
) {
  if (drag.kind !== "addon" || drag.id === target.id) return;
  event.preventDefault();
  setDrop({ kind: "addon", id: target.id, position: positionFromY(event, false) as "before" | "after" });
}

/* ------------------------------------------------------------------ */
/* Node chrome                                                         */
/* ------------------------------------------------------------------ */

function TreeNode({
  indent,
  isDragging,
  selected,
  dropIndicator,
  onDragStart,
  onDragOver,
  onDrop,
  onClick,
  onContextMenu,
  children,
}: {
  indent: number;
  isDragging?: boolean;
  selected?: boolean;
  dropIndicator?: "before" | "after" | "inside" | null;
  /** Provided = the node is draggable, but only via the grip dots. */
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  /** Clicking the node selects it (opens it in the detail pane). */
  onClick?: () => void;
  /** Right-clicking the node opens its context menu. */
  onContextMenu?: (event: ReactMouseEvent<HTMLDivElement>) => void;
  children: ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      onDragOver={onDragOver}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(event);
      }}
      onContextMenu={onContextMenu}
      className={cn(
        "group relative flex items-center gap-2 rounded-md border border-transparent py-1 pr-2",
        indent === 1 && "pl-8",
        indent === 2 && "pl-16",
        isDragging && "opacity-40",
        selected && "border-primary bg-primary/5",
        dropIndicator === "inside" && "border-primary bg-primary/5",
        onClick && "cursor-pointer",
      )}
    >
      {dropIndicator === "before" ? (
        <span className="pointer-events-none absolute -top-1 left-2 right-2 h-0.5 rounded bg-primary" />
      ) : null}
      {dropIndicator === "after" ? (
        <span className="pointer-events-none absolute -bottom-1 left-2 right-2 h-0.5 rounded bg-primary" />
      ) : null}
      {onDragStart ? (
        <div
          draggable
          data-drag-handle
          onDragStart={onDragStart}
          onClick={(event) => event.stopPropagation()}
          className="cursor-grab rounded px-0.5 py-1 text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing"
          title="Drag to move"
        >
          <IconGripVertical className="size-3.5" />
        </div>
      ) : (
        <span className="w-3.5 shrink-0" />
      )}
      {children}
    </div>
  );
}

/** Right-side action buttons for a tree branch. */
function NodeActions({
  onAdd,
  onDelete,
}: {
  onAdd?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
      {onAdd ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground"
          onClick={(event) => {
            event.stopPropagation();
            onAdd();
          }}
          aria-label="Add choice"
          title="Add choice"
        >
          <IconPlus className="size-3.5" />
        </Button>
      ) : null}
      {onDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-destructive"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          aria-label="Delete"
          title="Delete"
        >
          <IconTrash className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Right-click context menu (insert above/below)                       */
/* ------------------------------------------------------------------ */

/**
 * Cursor-positioned menu rendered in a portal (fixed positioning breaks
 * inside the tree's scroll container otherwise). Right-clicking a row,
 * choice or addon offers to insert a new item of the same kind above or
 * below it. Clicking anywhere else, pressing Escape, or a second
 * right-click closes it.
 */
function ContextMenuPop({
  menu,
  onClose,
  onAddRowAt,
  onAddChoiceAt,
  onAddAddonAt,
}: {
  menu: ContextMenuState;
  onClose: () => void;
  onAddRowAt: (rowId: string, position: "above" | "below") => void;
  onAddChoiceAt: (rowId: string, choiceId: string, position: "above" | "below") => void;
  onAddAddonAt: (choiceId: string, addonIndex: number, position: "above" | "below") => void;
}) {
  const { target } = menu;

  // Escape closes the menu (there is no focus trap on this lightweight pop).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const items =
    target.kind === "row"
      ? [
          { label: "Add row above", run: () => onAddRowAt(target.id, "above") },
          { label: "Add row below", run: () => onAddRowAt(target.id, "below") },
        ]
      : target.kind === "choice"
        ? [
            {
              label: "Add choice above",
              run: () => onAddChoiceAt(target.rowId, target.id, "above"),
            },
            {
              label: "Add choice below",
              run: () => onAddChoiceAt(target.rowId, target.id, "below"),
            },
          ]
        : [
            {
              label: "Add addon above",
              run: () => onAddAddonAt(target.choiceId, target.addonIndex, "above"),
            },
            {
              label: "Add addon below",
              run: () => onAddAddonAt(target.choiceId, target.addonIndex, "below"),
            },
          ];

  // Keep the menu inside the viewport (min-w-44 = 11rem).
  const left = Math.min(menu.x, Math.max(0, window.innerWidth - 190));
  const top = Math.min(menu.y, Math.max(0, window.innerHeight - 140));

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[299]"
        onClick={onClose}
        onContextMenu={(event) => {
          event.preventDefault();
          onClose();
        }}
      />
      <div
        className="fixed z-[300] min-w-44 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        style={{ left, top }}
        onContextMenu={(event) => event.preventDefault()}
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            className="flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent"
            onClick={() => {
              item.run();
              onClose();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>,
    document.body,
  );
}
