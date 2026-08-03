import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { IconPlus, IconSearch, IconArrowUpRight } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useAddChoice,
  useAddRow,
  useDeleteAddon,
  useDeleteChoice,
  useDeleteRow,
  useMoveAddon,
  useMoveChoice,
  useMoveRow,
  useUpdateChoice,
  useUpdateRow,
  type ProjectDetail,
} from "@/hooks/use-projects";
import { createDefaultAddon } from "@shared/cyoa";
import type { Choice, Row } from "@shared/types";

import { ChoiceEditor } from "./ChoiceEditor";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { EditorPane } from "./EditorPane";
import { MasterDetail } from "./MasterDetail";
import { RowEditor } from "./RowEditor";
import { RowTree } from "./RowTree";
import { sortedRows } from "./project-utils";

interface RowsPanelProps {
  project: ProjectDetail;
}

interface ChoiceTarget {
  row: Row;
  choice: Choice;
}

type Selection =
  | { kind: "row"; row: Row }
  | { kind: "choice"; choice: Choice; row: Row }
  | { kind: "addon"; choice: Choice; row: Row };

/** Stable node key used by the tree to highlight the selection. */
function selectionKey(selection: Selection): string {
  if (selection.kind === "row") return `row:${selection.row.id}`;
  if (selection.kind === "choice") return `choice:${selection.choice.id}`;
  return `addon:${selection.choice.id}`;
}

export function RowsPanel({ project }: RowsPanelProps) {
  const { app } = project;
  const projectId = project.id;
  // Stable identities so the memoized tree doesn't re-render on every
  // selection change (sortedRows copies; app/pointTypes/groups are stable
  // until the project refetches).
  const rows = useMemo(() => sortedRows(app), [app]);
  const pointTypes = useMemo(() => app.pointTypes ?? [], [app]);
  const groups = useMemo(() => app.groups ?? [], [app]);

  // The React Query mutation RESULT object is recreated every render, so the
  // stable `mutate`/`isPending` fields are the ones safe to close over in
  // useCallbacks (keeping the memoized tree/editors from re-rendering).
  const { mutate: addRowMutate, isPending: addRowPending } = useAddRow();
  const { mutate: moveRowMutate } = useMoveRow();
  const { mutate: deleteRowMutate, isPending: deleteRowPending } = useDeleteRow();
  const { mutate: updateRowMutate, isPending: updateRowPending } = useUpdateRow();
  const { mutate: addChoiceMutate, isPending: addChoicePending } = useAddChoice();
  const { mutate: moveChoiceMutate } = useMoveChoice();
  const { mutate: deleteChoiceMutate, isPending: deleteChoicePending } = useDeleteChoice();
  const { mutate: updateChoiceMutate, isPending: updateChoicePending } = useUpdateChoice();
  const { mutate: moveAddonMutate } = useMoveAddon();
  const { mutate: deleteAddonMutate, isPending: deleteAddonPending } = useDeleteAddon();

  const [selection, setSelection] = useState<Selection | null>(null);
  // Latest selection for the stable save callbacks (the editors are memoized
  // and must not re-render when RowsPanel re-renders with a new selection
  // object for the same item).
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const [deleteRowTarget, setDeleteRowTarget] = useState<Row | null>(null);
  const [deleteChoiceTarget, setDeleteChoiceTarget] = useState<ChoiceTarget | null>(null);
  const [deleteAddonTarget, setDeleteAddonTarget] = useState<{
    choiceId: string;
    addonIndex: number;
    title: string;
  } | null>(null);
  const [query, setQuery] = useState("");

  // Filter rows by title/text or by any contained choice's title/text/id so
  // a long project doesn't require scrolling every row to find one.
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      if ((row.title ?? "").toLowerCase().includes(q)) return true;
      if ((row.titleText ?? "").toLowerCase().includes(q)) return true;
      return (row.objects ?? []).some(
        (choice) =>
          (choice.title ?? "").toLowerCase().includes(q) ||
          (choice.text ?? "").toLowerCase().includes(q) ||
          choice.id.toLowerCase().includes(q),
      );
    });
  }, [rows, query]);

  // Pagination: the tree shows one page of rows at a time (fully rendered —
  // no windowing), so even a 180-row / 1,200-choice project stays snappy.
  const ROW_PAGE_SIZE = 20;
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ROW_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = useMemo(
    () => filteredRows.slice(safePage * ROW_PAGE_SIZE, (safePage + 1) * ROW_PAGE_SIZE),
    [filteredRows, safePage],
  );
  const pageStart = safePage * ROW_PAGE_SIZE;
  const pageEnd = Math.min(pageStart + ROW_PAGE_SIZE, filteredRows.length);

  // Filtering changes the result set -> back to the first page. Edits that
  // refetch the project keep the current page (the clamp below bounds it).
  useEffect(() => {
    setPage(0);
  }, [query]);

  // While filtering, force-expand the matching rows so the result is visible.
  const autoExpandIds = useMemo(
    () => (query.trim() ? new Set(filteredRows.map((row) => row.id)) : undefined),
    [filteredRows, query],
  );

  function handleAddRow() {
    addRowMutate(
      { projectId },
      {
        onSuccess: () => toast.success("Row added"),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add row"),
      },
    );
  }

  const handleMoveRow = useCallback(
    (rowId: string, index: number) => {
      moveRowMutate(
        { projectId, rowId, index },
        {
          onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to move row"),
        },
      );
    },
    [moveRowMutate, projectId],
  );

  function handleDeleteRow() {
    if (!deleteRowTarget) return;
    const target = deleteRowTarget;
    deleteRowMutate(
      { projectId, rowId: target.id },
      {
        onSuccess: () => {
          toast.success("Row deleted");
          setDeleteRowTarget(null);
          if (selection?.kind === "row" && selection.row.id === target.id) setSelection(null);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to delete row");
          setDeleteRowTarget(null);
        },
      },
    );
  }

  const handleSaveRow = useCallback(
    (patch: Record<string, unknown>) => {
      const current = selectionRef.current;
      if (!current || current.kind !== "row") return;
      updateRowMutate(
        { projectId, rowId: current.row.id, patch },
        {
          onSuccess: () => toast.success("Row updated"),
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to update row"),
        },
      );
    },
    [updateRowMutate, projectId],
  );

  const handleAddChoice = useCallback(
    (row: Row) => {
      addChoiceMutate(
        { projectId, rowId: row.id },
        {
          onSuccess: () => toast.success("Choice added"),
          onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add choice"),
        },
      );
    },
    [addChoiceMutate, projectId],
  );

  const handleMoveChoice = useCallback(
    (targetRowId: string, choiceId: string, index: number) => {
      moveChoiceMutate(
        { projectId, rowId: targetRowId, choiceId, index },
        {
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to move choice"),
        },
      );
    },
    [moveChoiceMutate, projectId],
  );

  function handleDeleteChoice() {
    if (!deleteChoiceTarget) return;
    const { row, choice } = deleteChoiceTarget;
    deleteChoiceMutate(
      { projectId, rowId: row.id, choiceId: choice.id },
      {
        onSuccess: () => {
          toast.success("Choice deleted");
          setDeleteChoiceTarget(null);
          if (
            selection?.kind === "choice" &&
            selection.choice.id === choice.id
          ) {
            setSelection(null);
          }
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to delete choice");
          setDeleteChoiceTarget(null);
        },
      },
    );
  }

  const handleSaveChoice = useCallback(
    (patch: Record<string, unknown>) => {
      const current = selectionRef.current;
      if (!current || current.kind === "row") return;
      updateChoiceMutate(
        { projectId, rowId: current.row.id, choiceId: current.choice.id, patch },
        {
          onSuccess: () => toast.success("Choice updated"),
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to update choice"),
        },
      );
    },
    [updateChoiceMutate, projectId],
  );

  const handleMoveAddon = useCallback(
    (sourceChoiceId: string, addonIndex: number, targetChoiceId: string, targetIndex: number) => {
      moveAddonMutate(
        { projectId, sourceChoiceId, addonIndex, targetChoiceId, targetIndex },
        {
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to move addon"),
        },
      );
    },
    [moveAddonMutate, projectId],
  );

  // Right-click context-menu inserts (rows tree). Indexes refer to positions
  // in the sorted document, matching what the tree displays.
  const handleAddRowAt = useCallback(
    (rowId: string, position: "above" | "below") => {
      const sorted = sortedRows(app);
      const idx = sorted.findIndex((row) => row.id === rowId);
      if (idx === -1) return;
      const insertAt = position === "above" ? idx : idx + 1;
      addRowMutate(
        { projectId, index: insertAt },
        {
          onSuccess: (data) => {
            if (data?.row) setSelection({ kind: "row", row: data.row });
            // Reveal the page that now contains the new row.
            setPage(Math.floor(insertAt / ROW_PAGE_SIZE));
          },
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to add row"),
        },
      );
    },
    [app, addRowMutate, projectId],
  );

  const handleAddChoiceAt = useCallback(
    (rowId: string, choiceId: string, position: "above" | "below") => {
      const row = app.rows?.find((r) => r.id === rowId);
      if (!row) return;
      const idx = (row.objects ?? []).findIndex((c) => c.id === choiceId);
      if (idx === -1) return;
      const insertAt = position === "above" ? idx : idx + 1;
      addChoiceMutate(
        { projectId, rowId, index: insertAt },
        {
          onSuccess: (data) => {
            if (data?.choice) setSelection({ kind: "choice", choice: data.choice, row });
          },
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to add choice"),
        },
      );
    },
    [app, addChoiceMutate, projectId],
  );

  const handleAddAddonAt = useCallback(
    (choiceId: string, addonIndex: number, position: "above" | "below") => {
      const row = app.rows?.find((r) => (r.objects ?? []).some((c) => c.id === choiceId));
      const choice = row?.objects?.find((c) => c.id === choiceId);
      if (!row || !choice) return;
      const insertAt = position === "above" ? addonIndex : addonIndex + 1;
      const addons = choice.addons ?? [];
      const next = [
        ...addons.slice(0, insertAt),
        createDefaultAddon(app),
        ...addons.slice(insertAt),
      ];
      updateChoiceMutate(
        { projectId, rowId: row.id, choiceId, patch: { addons: next } },
        {
          onSuccess: (data) => {
            if (data?.choice) setSelection({ kind: "addon", choice: data.choice, row });
          },
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to add addon"),
        },
      );
    },
    [app, updateChoiceMutate, projectId],
  );

  function handleDeleteAddon() {
    if (!deleteAddonTarget) return;
    const { choiceId, addonIndex } = deleteAddonTarget;
    deleteAddonMutate(
      { projectId, choiceId, addonIndex },
      {
        onSuccess: () => {
          toast.success("Addon deleted");
          setDeleteAddonTarget(null);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to delete addon");
          setDeleteAddonTarget(null);
        },
      },
    );
  }

  const busy = updateRowPending || updateChoicePending || addRowPending || addChoicePending;

  // Stable callbacks so the memoized tree only re-renders when its data or the
  // selection changes — not on every detail-pane change.
  const handleSelectRow = useCallback((row: Row) => setSelection({ kind: "row", row }), []);
  const handleSelectChoice = useCallback(
    (choice: Choice, row: Row) => setSelection({ kind: "choice", choice, row }),
    [],
  );
  const handleSelectAddon = useCallback(
    (choice: Choice, row: Row) => setSelection({ kind: "addon", choice, row }),
    [],
  );
  const handleCancelSelection = useCallback(() => setSelection(null), []);
  const requestDeleteRow = useCallback((row: Row) => setDeleteRowTarget(row), []);
  const requestDeleteChoice = useCallback(
    (choice: Choice, row: Row) => setDeleteChoiceTarget({ choice, row }),
    [],
  );
  const requestDeleteAddon = useCallback(
    (choiceId: string, addonIndex: number) =>
      setDeleteAddonTarget({ choiceId, addonIndex, title: "addon" }),
    [],
  );

  const detail =
    selection?.kind === "row" ? (
      <RowEditor
        key={`row:${selection.row.id}`}
        row={selection.row}
        app={app}
        busy={busy}
        onCancel={handleCancelSelection}
        onSave={handleSaveRow}
      />
    ) : selection?.kind === "choice" ? (
      <ChoiceEditor
        key={`choice:${selection.choice.id}`}
        choice={selection.choice}
        app={app}
        pointTypes={pointTypes}
        groups={groups}
        busy={busy}
        onCancel={handleCancelSelection}
        onSave={handleSaveChoice}
      />
    ) : selection?.kind === "addon" ? (
      <ChoiceEditor
        key={`addon:${selection.choice.id}`}
        choice={selection.choice}
        app={app}
        pointTypes={pointTypes}
        groups={groups}
        busy={busy}
        initialSection="addons"
        onCancel={handleCancelSelection}
        onSave={handleSaveChoice}
      />
    ) : (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
          <IconArrowUpRight className="size-6 text-muted-foreground/50" />
          <p className="max-w-sm text-sm text-muted-foreground">
            Select a row, choice, or addon from the tree to edit it here — no more dialogs. Drag
            branches to reorder or move them between parents.
          </p>
        </CardContent>
      </Card>
    );

  const master = (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 -mx-1 space-y-2 bg-background/95 px-1 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {rows.length} row{rows.length === 1 ? "" : "s"} ·{" "}
            {rows.reduce((sum, row) => sum + (row.objects?.length ?? 0), 0)} choices
            {query.trim() && filteredRows.length !== rows.length
              ? ` · ${filteredRows.length} matching`
              : ""}
          </p>
          <Button type="button" size="sm" onClick={handleAddRow}>
            <IconPlus className="mr-1.5 size-4" />
            Add row
          </Button>
        </div>
        <div className="relative">
          <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter rows or choices…"
            aria-label="Filter rows or choices"
            className="h-8 w-full pl-8"
          />
        </div>
        {filteredRows.length > ROW_PAGE_SIZE ? (
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
            >
              Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              Rows {pageStart + 1}–{pageEnd} of {filteredRows.length}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage(safePage + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No rows yet. Rows hold the choices readers pick from — add your first row to get
              started.
            </p>
            <Button type="button" onClick={handleAddRow}>
              <IconPlus className="mr-1.5 size-4" />
              Add row
            </Button>
          </CardContent>
        </Card>
      ) : filteredRows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">No rows match “{query.trim()}”.</p>
          </CardContent>
        </Card>
      ) : (
        <RowTree
          rows={pageRows}
          rowOffset={pageStart}
          app={app}
          pointTypes={pointTypes}
          groups={groups}
          autoExpandIds={autoExpandIds}
          selectedKey={selection ? selectionKey(selection) : null}
          onEditRow={handleSelectRow}
          onAddChoice={handleAddChoice}
          onDeleteRow={requestDeleteRow}
          onMoveRow={handleMoveRow}
          onEditChoice={handleSelectChoice}
          onDeleteChoice={requestDeleteChoice}
          onMoveChoice={handleMoveChoice}
          onEditAddon={handleSelectAddon}
          onDeleteAddon={requestDeleteAddon}
          onMoveAddon={handleMoveAddon}
          onAddRowAt={handleAddRowAt}
          onAddChoiceAt={handleAddChoiceAt}
          onAddAddonAt={handleAddAddonAt}
        />
      )}
    </div>
  );

  return (
    <>
      <MasterDetail master={master} detail={detail} />
      <ConfirmDeleteDialog
        open={Boolean(deleteRowTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteRowTarget(null);
        }}
        title={`Delete row "${deleteRowTarget?.title || "Untitled row"}"?`}
        description="This deletes the row and all of its choices."
        busy={deleteRowPending}
        onConfirm={handleDeleteRow}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteChoiceTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteChoiceTarget(null);
        }}
        title={`Delete choice "${deleteChoiceTarget?.choice.title || "Untitled choice"}"?`}
        description="This deletes the choice and its scores."
        busy={deleteChoicePending}
        onConfirm={handleDeleteChoice}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteAddonTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteAddonTarget(null);
        }}
        title={`Delete addon "${deleteAddonTarget?.title || "Untitled addon"}"?`}
        description="This removes the addon from its choice."
        busy={deleteAddonPending}
        onConfirm={handleDeleteAddon}
      />
    </>
  );
}
