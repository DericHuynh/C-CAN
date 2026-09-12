import { useLiveFields } from "./LiveProjectFields";
import { readLivePath } from "@shared/live-project-path";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  IconAlignLeft,
  IconArrowDown,
  IconArrowUp,
  IconMouse,
  IconPencil,
  IconPlus,
  IconTrash,
  IconTypography,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  useAddChoice,
  useAddRow,
  useDeleteChoice,
  useDeleteRow,
  useMoveChoice,
  useMoveRow,
  useUpdateChoice,
  useUpdateRow,
  type ProjectDetail,
} from "@/features/projects/use-projects";
import type { App, Choice, Row } from "@shared/types";

import {
  CanvasContextMenu,
  type CanvasContextMenuHandle,
  type CanvasMenuItem,
} from "@/features/editor/CanvasContextMenu";
import { ChoiceEditor } from "@/features/editor/ChoiceEditor";
import { ConfirmDeleteDialog } from "@/features/editor/ConfirmDeleteDialog";
import { CyoaViewer } from "@/components/editor/LiveCyoaViewer";
import type { VisualEditAction, VisualEditTarget, VisualSelection } from "@/features/viewer/types";
import { RowEditor } from "@/features/editor/RowEditor";
import { sortedChoices, sortedRows } from "@/lib/project-utils";

interface VisualEditorProps {
  project: ProjectDetail;
}

type Entity = { kind: "row"; row: Row } | { kind: "choice"; choice: Choice; row: Row };

/** Resolve a canvas selection to a live row/choice from the current document. */
function resolveEntity(app: App, selection: VisualSelection | null): Entity | null {
  if (!selection) return null;
  if (selection.kind === "row") {
    const row = sortedRows(app).find((r) => r.id === selection.id);
    return row ? { kind: "row", row } : null;
  }
  for (const row of sortedRows(app)) {
    const choice = sortedChoices(row).find((c) => c.id === selection.id);
    if (choice) return { kind: "choice", choice, row };
  }
  return null;
}

/**
 * V-Editor — a WYSIWYG master/detail editor like the original ICCPlus creator.
 *
 * The CYOA renders live (the same `CyoaViewer` used to play it) as the master
 * canvas; clicks play choices, pencils open the inspector, and double-clicks
 * edit text inline. The inspected item also exposes add / move / delete.
 */
export function VisualEditor({ project }: VisualEditorProps) {
  const { app } = project;
  const live = useLiveFields();
  const projectId = project.id;
  const rows = useMemo(() => sortedRows(app), [app]);
  const pointTypes = useMemo(() => app.pointTypes ?? [], [app]);
  const groups = useMemo(() => app.groups ?? [], [app]);

  const { mutate: addRowMutate, isPending: addRowPending } = useAddRow();
  const {
    mutate: updateRowMutate,
    mutateAsync: updateRowAsync,
    isPending: updateRowPending,
  } = useUpdateRow();
  const { mutate: deleteRowMutate, isPending: deleteRowPending } = useDeleteRow();
  const { mutate: moveRowMutate } = useMoveRow();
  const { mutate: addChoiceMutate, isPending: addChoicePending } = useAddChoice();
  const {
    mutate: updateChoiceMutate,
    mutateAsync: updateChoiceAsync,
    isPending: updateChoicePending,
  } = useUpdateChoice();
  const { mutate: deleteChoiceMutate, isPending: deleteChoicePending } = useDeleteChoice();
  const { mutate: moveChoiceMutate } = useMoveChoice();

  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const latestLocation = useRef(location);
  latestLocation.current = location;
  const choiceId = params.get("choiceId");
  const rowId = params.get("rowId");
  const selection = useMemo<VisualSelection | null>(
    () => (choiceId ? { kind: "choice", id: choiceId } : rowId ? { kind: "row", id: rowId } : null),
    [choiceId, rowId],
  );
  const setSelection = useCallback(
    (next: VisualSelection | null) => {
      const current = latestLocation.current;
      const updated = new URLSearchParams(current.search);
      for (const key of ["rowId", "choiceId", "addonId"]) updated.delete(key);
      if (next) updated.set(next.kind === "row" ? "rowId" : "choiceId", next.id);
      navigate(
        { pathname: current.pathname, search: updated.toString(), hash: current.hash },
        { replace: true },
      );
    },
    [navigate],
  );
  const [deleteRowTarget, setDeleteRowTarget] = useState<Row | null>(null);
  const [deleteChoiceTarget, setDeleteChoiceTarget] = useState<{
    row: Row;
    choice: Choice;
  } | null>(null);
  /** The entity right-clicked on the canvas (null = empty canvas space). */
  const [contextMenuSelection, setContextMenuSelection] = useState<VisualSelection | null>(null);
  const contextMenuRef = useRef<CanvasContextMenuHandle>(null);
  /** Field being edited inline on the canvas (Figma-style double-click). */
  const [editTarget, setEditTarget] = useState<VisualEditTarget | null>(null);

  // Resolve URL selections against fresh data, including agent navigation.
  // Keep pending IDs while an add action is waiting for its query refetch.
  const entity = useMemo(() => resolveEntity(app, selection), [app, selection]);
  useEffect(() => {
    if (editTarget && !resolveEntity(app, { kind: editTarget.kind, id: editTarget.id })) {
      setEditTarget(null);
    }
  }, [entity, selection, editTarget, app]);

  const handleSelect = useCallback((next: VisualSelection) => setSelection(next), [setSelection]);

  const handleAddRow = useCallback(() => {
    addRowMutate(
      { projectId },
      {
        onSuccess: (data) => {
          toast.success("Row added");
          if (data?.row) setSelection({ kind: "row", id: data.row.id });
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add row"),
      },
    );
  }, [addRowMutate, projectId]);

  /** Insert a row at a document position (used by the right-click menu). */
  const handleAddRowAt = useCallback(
    (index: number) => {
      addRowMutate(
        { projectId, index },
        {
          onSuccess: (data) => {
            toast.success("Row added");
            if (data?.row) setSelection({ kind: "row", id: data.row.id });
          },
          onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add row"),
        },
      );
    },
    [addRowMutate, projectId],
  );

  const handleAddChoice = useCallback(
    (rowId: string) => {
      addChoiceMutate(
        { projectId, rowId },
        {
          onSuccess: (data) => {
            toast.success("Choice added");
            if (data?.choice) setSelection({ kind: "choice", id: data.choice.id });
          },
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to add choice"),
        },
      );
    },
    [addChoiceMutate, projectId],
  );

  /** Insert a choice at a document position (used by the right-click menu). */
  const handleAddChoiceAt = useCallback(
    (rowId: string, index: number) => {
      addChoiceMutate(
        { projectId, rowId, index },
        {
          onSuccess: (data) => {
            toast.success("Choice added");
            if (data?.choice) setSelection({ kind: "choice", id: data.choice.id });
          },
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to add choice"),
        },
      );
    },
    [addChoiceMutate, projectId],
  );

  const handleContextMenu = useCallback(
    (menuSelection: VisualSelection | null, event: React.MouseEvent) => {
      event.preventDefault();
      // Selecting the right-clicked entity gives it the outline + toolbar, so
      // right-click doubles as a way to select options on the canvas.
      if (menuSelection) setSelection(menuSelection);
      setContextMenuSelection(menuSelection);
      contextMenuRef.current?.openAt({ clientX: event.clientX, clientY: event.clientY });
    },
    [],
  );

  const handleStartEdit = useCallback((target: VisualEditTarget) => {
    setSelection({ kind: target.kind, id: target.id });
    setEditTarget(target);
  }, []);

  const handleCommitEdit = useCallback(
    async (target: VisualEditTarget, value: string) => {
      const patch = { [target.field]: value };
      const path = [target.kind === "row" ? "rows" : "$choices", target.id, target.field];
      const original = readLivePath(app, path);
      const shared =
        project.canEdit && live?.has(path, original) && live.read(path, original) === value;
      // Shared text already has a background save queued. Leaving inline edit
      // must not wait for a duplicate SQL write or a full project reload.
      if (shared || original === value) {
        setEditTarget(null);
        return;
      }
      if (target.kind === "row") {
        await updateRowAsync({ projectId, rowId: target.id, patch });
      } else {
        const row = rows.find((r) => sortedChoices(r).some((c) => c.id === target.id));
        if (!row) throw new Error("This choice was removed by another editor.");
        await updateChoiceAsync({ projectId, rowId: row.id, choiceId: target.id, patch });
      }
      setEditTarget((current) =>
        current?.kind === target.kind && current.id === target.id && current.field === target.field
          ? null
          : current,
      );
    },
    [updateRowAsync, updateChoiceAsync, projectId, rows, app, live, project.canEdit],
  );

  const handleSaveRow = useCallback(
    (patch: Record<string, unknown>) => {
      if (!entity || entity.kind !== "row") return;
      updateRowMutate(
        { projectId, rowId: entity.row.id, patch },
        {
          onSuccess: () => toast.success("Row updated"),
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to update row"),
        },
      );
    },
    [entity, updateRowMutate, projectId],
  );

  const handleSaveChoice = useCallback(
    (patch: Record<string, unknown>) => {
      if (!entity || entity.kind === "row") return;
      updateChoiceMutate(
        { projectId, rowId: entity.row.id, choiceId: entity.choice.id, patch },
        {
          onSuccess: () => toast.success("Choice updated"),
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to update choice"),
        },
      );
    },
    [entity, updateChoiceMutate, projectId],
  );

  const handleMoveRow = useCallback(
    (rowId: string, direction: -1 | 1) => {
      const index = rows.findIndex((r) => r.id === rowId);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= rows.length) return;
      moveRowMutate(
        { projectId, rowId, index: target },
        {
          onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to move row"),
        },
      );
    },
    [moveRowMutate, projectId, rows],
  );

  const handleMoveChoice = useCallback(
    (rowId: string, choiceId: string, direction: -1 | 1) => {
      const row = rows.find((r) => r.id === rowId);
      if (!row) return;
      const choices = sortedChoices(row);
      const index = choices.findIndex((c) => c.id === choiceId);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= choices.length) return;
      moveChoiceMutate(
        { projectId, rowId, choiceId, index: target },
        {
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to move choice"),
        },
      );
    },
    [moveChoiceMutate, projectId, rows],
  );

  // Toolbar actions fired from the canvas overlay.
  const handleAction = useCallback(
    (action: VisualEditAction, sel: VisualSelection) => {
      const actionEntity = resolveEntity(app, sel);
      switch (action) {
        case "edit":
          setSelection(sel);
          return;
        case "add-choice":
          if (sel.kind === "row") handleAddChoice(sel.id);
          return;
        case "move-up":
          if (sel.kind === "row") handleMoveRow(sel.id, -1);
          else if (actionEntity?.kind === "choice")
            handleMoveChoice(actionEntity.row.id, sel.id, -1);
          return;
        case "move-down":
          if (sel.kind === "row") handleMoveRow(sel.id, 1);
          else if (actionEntity?.kind === "choice")
            handleMoveChoice(actionEntity.row.id, sel.id, 1);
          return;
        case "delete":
          if (sel.kind === "row") {
            const row = rows.find((r) => r.id === sel.id);
            if (row) setDeleteRowTarget(row);
          } else if (actionEntity?.kind === "choice") {
            setDeleteChoiceTarget({ row: actionEntity.row, choice: actionEntity.choice });
          }
          return;
      }
    },
    [app, handleAddChoice, handleMoveChoice, handleMoveRow, rows],
  );

  // Items for the right-click menu: editor-style "add above / below", inline
  // text editing, plus the usual edit / move / delete actions.
  const menuItems = useMemo<CanvasMenuItem[]>(() => {
    const menuSel = contextMenuSelection;

    // Right-clicking empty canvas space: add a row at the end.
    if (!menuSel) {
      return [{ label: "Add row", icon: <IconPlus />, onSelect: handleAddRow }];
    }

    if (menuSel.kind === "row") {
      const index = rows.findIndex((r) => r.id === menuSel.id);
      const row = rows[index];
      return [
        { label: "Edit…", icon: <IconPencil />, onSelect: () => setSelection(menuSel) },
        {
          separatorBefore: true,
          label: "Edit title",
          icon: <IconTypography />,
          onSelect: () => handleStartEdit({ kind: "row", id: menuSel.id, field: "title" }),
        },
        {
          label: "Edit description",
          icon: <IconAlignLeft />,
          onSelect: () => handleStartEdit({ kind: "row", id: menuSel.id, field: "titleText" }),
        },
        {
          separatorBefore: true,
          label: "Add row above",
          icon: <IconPlus />,
          onSelect: () => handleAddRowAt(index),
        },
        {
          label: "Add row below",
          icon: <IconPlus />,
          onSelect: () => handleAddRowAt(index + 1),
        },
        {
          label: "Add choice",
          icon: <IconPlus />,
          onSelect: () => row && handleAddChoice(row.id),
        },
        {
          separatorBefore: true,
          label: "Move up",
          icon: <IconArrowUp />,
          disabled: index <= 0,
          onSelect: () => handleMoveRow(menuSel.id, -1),
        },
        {
          label: "Move down",
          icon: <IconArrowDown />,
          disabled: index === -1 || index >= rows.length - 1,
          onSelect: () => handleMoveRow(menuSel.id, 1),
        },
        {
          separatorBefore: true,
          label: "Delete row",
          icon: <IconTrash />,
          destructive: true,
          onSelect: () => row && setDeleteRowTarget(row),
        },
      ];
    }

    const row = rows.find((r) => sortedChoices(r).some((c) => c.id === menuSel.id));
    const choices = row ? sortedChoices(row) : [];
    const index = choices.findIndex((c) => c.id === menuSel.id);
    const choice = choices[index];
    return [
      { label: "Edit…", icon: <IconPencil />, onSelect: () => setSelection(menuSel) },
      {
        separatorBefore: true,
        label: "Edit title",
        icon: <IconTypography />,
        onSelect: () => handleStartEdit({ kind: "choice", id: menuSel.id, field: "title" }),
      },
      {
        label: "Edit text",
        icon: <IconAlignLeft />,
        onSelect: () => handleStartEdit({ kind: "choice", id: menuSel.id, field: "text" }),
      },
      {
        separatorBefore: true,
        label: "Add choice above",
        icon: <IconPlus />,
        onSelect: () => row && handleAddChoiceAt(row.id, index),
      },
      {
        label: "Add choice below",
        icon: <IconPlus />,
        onSelect: () => row && handleAddChoiceAt(row.id, index + 1),
      },
      {
        separatorBefore: true,
        label: "Move up",
        icon: <IconArrowUp />,
        disabled: index <= 0,
        onSelect: () => row && handleMoveChoice(row.id, menuSel.id, -1),
      },
      {
        label: "Move down",
        icon: <IconArrowDown />,
        disabled: index === -1 || index >= choices.length - 1,
        onSelect: () => row && handleMoveChoice(row.id, menuSel.id, 1),
      },
      {
        separatorBefore: true,
        label: "Delete choice",
        icon: <IconTrash />,
        destructive: true,
        onSelect: () => row && choice && setDeleteChoiceTarget({ row, choice }),
      },
    ];
  }, [
    contextMenuSelection,
    rows,
    handleAddRow,
    handleAddRowAt,
    handleAddChoice,
    handleAddChoiceAt,
    handleMoveRow,
    handleMoveChoice,
    handleStartEdit,
  ]);

  function handleConfirmDeleteRow() {
    if (!deleteRowTarget) return;
    const target = deleteRowTarget;
    deleteRowMutate(
      { projectId, rowId: target.id },
      {
        onSuccess: () => {
          toast.success("Row deleted");
          setDeleteRowTarget(null);
          if (selection?.kind === "row" && selection.id === target.id) setSelection(null);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to delete row");
          setDeleteRowTarget(null);
        },
      },
    );
  }

  function handleConfirmDeleteChoice() {
    if (!deleteChoiceTarget) return;
    const { row, choice } = deleteChoiceTarget;
    deleteChoiceMutate(
      { projectId, rowId: row.id, choiceId: choice.id },
      {
        onSuccess: () => {
          toast.success("Choice deleted");
          setDeleteChoiceTarget(null);
          if (selection?.kind === "choice" && selection.id === choice.id) setSelection(null);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to delete choice");
          setDeleteChoiceTarget(null);
        },
      },
    );
  }

  const busy = addRowPending || updateRowPending || addChoicePending || updateChoicePending;
  const choiceCount = rows.reduce((sum, row) => sum + (row.objects?.length ?? 0), 0);

  const detail =
    entity?.kind === "row" ? (
      <RowEditor
        key={`row:${entity.row.id}`}
        focusOnOpen={!editTarget}
        row={entity.row}
        app={app}
        busy={busy}
        onCancel={() => setSelection(null)}
        onSave={handleSaveRow}
      />
    ) : entity?.kind === "choice" ? (
      <ChoiceEditor
        key={`choice:${entity.choice.id}`}
        focusOnOpen={!editTarget}
        choice={entity.choice}
        app={app}
        pointTypes={pointTypes}
        groups={groups}
        busy={busy}
        onCancel={() => setSelection(null)}
        onSave={handleSaveChoice}
      />
    ) : (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <IconMouse className="size-8 text-muted-foreground/50" />
          <p className="max-w-sm text-sm text-muted-foreground">
            Click choices to play. Use the pencil at the top right of a row or choice to edit it
            here, or double-click text to edit it in place.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={handleAddRow}>
            <IconPlus className="mr-1.5 size-4" />
            Add row
          </Button>
        </CardContent>
      </Card>
    );

  const canvas = (
    <div className="space-y-3 xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:gap-3 xl:space-y-0">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {rows.length} row{rows.length === 1 ? "" : "s"} · {choiceCount} choice
          {choiceCount === 1 ? "" : "s"} — click choices to play, use the pencil to edit, or
          double-click text
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={handleAddRow}>
            <IconPlus className="mr-1.5 size-4" />
            Add row
          </Button>
        </div>
      </div>
      <CyoaViewer
        app={app}
        projectId={project.id}
        className="rounded-lg border border-border xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:overscroll-contain"
        editing
        selection={selection}
        onSelect={handleSelect}
        onAction={handleAction}
        editTarget={editTarget}
        onStartEdit={handleStartEdit}
        onCommitEdit={handleCommitEdit}
        onContextMenu={handleContextMenu}
      />
    </div>
  );

  return (
    <>
      <CanvasContextMenu
        ref={contextMenuRef}
        items={menuItems}
        onOpenChange={(open) => {
          // Close clears the right-clicked entity so the next open rebuilds
          // the items from a fresh selection.
          if (!open) setContextMenuSelection(null);
        }}
      >
        <div className="grid items-start gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] xl:items-stretch">
          <div className="min-w-0 xl:min-h-0">{canvas}</div>
          <div
            data-visual-inspector
            className="min-w-0 xl:min-h-0 xl:overflow-hidden xl:[&>[data-editor-pane]]:h-full xl:[&>[data-editor-pane]]:max-h-full"
          >
            {detail}
          </div>
        </div>
      </CanvasContextMenu>

      <ConfirmDeleteDialog
        open={Boolean(deleteRowTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteRowTarget(null);
        }}
        title={`Delete row "${deleteRowTarget?.title || "Untitled row"}"?`}
        description="This deletes the row and all of its choices."
        busy={deleteRowPending}
        onConfirm={handleConfirmDeleteRow}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteChoiceTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteChoiceTarget(null);
        }}
        title={`Delete choice "${deleteChoiceTarget?.choice.title || "Untitled choice"}"?`}
        description="This deletes the choice and its scores."
        busy={deleteChoicePending}
        onConfirm={handleConfirmDeleteChoice}
      />
    </>
  );
}
