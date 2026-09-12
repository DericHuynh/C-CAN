import { ContentBrowserControls, useContentBrowser } from "./ContentBrowser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useT } from "@agent-native/core/client/i18n";
import { toast } from "sonner";
import { IconPlus, IconArrowUpRight } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
} from "@/features/projects/use-projects";
import { createDefaultAddon } from "@shared/cyoa";
import type { Choice, Row } from "@shared/types";

import { ChoiceEditor } from "@/features/editor/ChoiceEditor";
import { ConfirmDeleteDialog } from "@/features/editor/ConfirmDeleteDialog";
import { EditorPane } from "@/features/editor/EditorPane";
import { MasterDetail } from "@/features/editor/MasterDetail";
import { RowEditor } from "@/features/editor/RowEditor";
import { RowTree } from "@/features/editor/RowTree";
import { sortedRows } from "@/lib/project-utils";

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
  | { kind: "addon"; choice: Choice; row: Row; addonIndex: number };

/** Stable node key used by the tree to highlight the selection. */
function selectionKey(selection: Selection): string {
  if (selection.kind === "row") return `row:${selection.row.id}`;
  if (selection.kind === "choice") return `choice:${selection.choice.id}`;
  return `addon:${selection.choice.id}:${selection.addonIndex}`;
}

export function RowsPanel({ project }: RowsPanelProps) {
  const { app } = project;
  const [params, setParams] = useSearchParams();
  const setParamsRef = useRef(setParams);
  setParamsRef.current = setParams;
  const t = useT();
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

  const [selection, setSelectionState] = useState<Selection | null>(null);
  const setSelection = useCallback((next: Selection | null) => {
    setSelectionState(next);
    setParamsRef.current(
      (current) => {
        const params = new URLSearchParams(current);
        for (const key of ["rowId", "choiceId", "addonId"]) params.delete(key);
        if (next) {
          params.set("rowId", next.row.id);
          if (next.kind !== "row") params.set("choiceId", next.choice.id);
          if (next.kind === "addon") {
            const id = next.choice.addons[next.addonIndex]?.id;
            if (id) params.set("addonId", id);
          }
        }
        return params;
      },
      { replace: true },
    );
  }, []);
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
  const browser = useContentBrowser(rows);
  const query = browser.filter.query;
  const resetBrowser = browser.reset;
  const filteredRows = browser.items;

  // Pagination: the tree shows one page of rows at a time (fully rendered —
  // no windowing), so even a 180-row / 1,200-choice project stays snappy.
  const ROW_PAGE_SIZE = 20;
  const [page, setPage] = useState(0);
  const controlsBrowser = {
    ...browser,
    setFilter: ((update) => {
      setPage(0);
      browser.setFilter(update);
    }) as typeof browser.setFilter,
    reset: () => {
      setPage(0);
      browser.reset();
    },
  };
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ROW_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = useMemo(
    () => filteredRows.slice(safePage * ROW_PAGE_SIZE, (safePage + 1) * ROW_PAGE_SIZE),
    [filteredRows, safePage],
  );
  const pageStart = safePage * ROW_PAGE_SIZE;
  const pageEnd = Math.min(pageStart + ROW_PAGE_SIZE, filteredRows.length);

  const targetRowId = params.get("rowId");
  const targetChoiceId = params.get("choiceId");
  const targetAddonId = params.get("addonId");
  useEffect(() => {
    if (!targetRowId) {
      setSelectionState(null);
      return;
    }
    const current = selectionRef.current;
    if (
      current &&
      current.row.id === targetRowId &&
      (current.kind !== "row" ? current.choice.id : null) === targetChoiceId &&
      (current.kind === "addon" ? current.choice.addons[current.addonIndex]?.id : null) ===
        targetAddonId
    )
      return;
    const row = rows.find((item) => item.id === targetRowId);
    if (!row) return;
    const choice = row.objects.find((item) => item.id === targetChoiceId);
    const addonIndex = choice?.addons.findIndex((item) => item.id === targetAddonId) ?? -1;
    resetBrowser();
    setPage(Math.floor(rows.indexOf(row) / ROW_PAGE_SIZE));
    setSelectionState(
      choice
        ? addonIndex >= 0
          ? { kind: "addon", row, choice, addonIndex }
          : { kind: "choice", row, choice }
        : { kind: "row", row },
    );
  }, [targetRowId, targetChoiceId, targetAddonId]);
  // While filtering, force-expand the matching rows so the result is visible.
  const autoExpandIds = useMemo(
    () => (query.trim() ? new Set(filteredRows.map((row) => row.id)) : undefined),
    [filteredRows, query],
  );

  function handleAddRow() {
    if (addRowPending) return;
    addRowMutate(
      { projectId },
      {
        onSuccess: (data) => {
          toast.success("Row added");
          resetBrowser();
          setPage(Math.floor(rows.length / ROW_PAGE_SIZE));
          if (data.row) setSelection({ kind: "row", row: data.row });
        },
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
          if (selectionRef.current?.row.id === target.id) setSelection(null);
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
          onSuccess: (data) => {
            toast.success("Choice added");
            resetBrowser();
            setPage(
              Math.max(0, Math.floor(rows.findIndex((item) => item.id === row.id) / ROW_PAGE_SIZE)),
            );
            if (data.choice) setSelection({ kind: "choice", choice: data.choice, row });
          },
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to add choice"),
        },
      );
    },
    [addChoiceMutate, projectId, rows],
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
          const current = selectionRef.current;
          if (current && current.kind !== "row" && current.choice.id === choice.id) {
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
            resetBrowser();
            // Reveal the page that now contains the new row.
            setPage(Math.floor(insertAt / ROW_PAGE_SIZE));
          },
          onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add row"),
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
            resetBrowser();
            setPage(
              Math.max(
                0,
                Math.floor(sortedRows(app).findIndex((item) => item.id === row.id) / ROW_PAGE_SIZE),
              ),
            );
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
            if (data?.choice)
              setSelection({ kind: "addon", choice: data.choice, row, addonIndex: insertAt });
          },
          onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add addon"),
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
          const current = selectionRef.current;
          if (current && current.kind !== "row" && current.choice.id === choiceId)
            setSelection(null);
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
    (choice: Choice, row: Row, addonIndex: number) =>
      setSelection({ kind: "addon", choice, row, addonIndex }),
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
        key={`addon:${selection.choice.id}:${selection.addonIndex}`}
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
            Select a row, choice, or addon from the tree to edit it here. Drag branches to reorder
            or move them between parents.
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
          <Button type="button" size="sm" onClick={handleAddRow} disabled={addRowPending}>
            <IconPlus className="mr-1.5 size-4" />
            {addRowPending ? "Adding…" : "Add row"}
          </Button>
        </div>
        <ContentBrowserControls browser={controlsBrowser} label="rows, choices and addons" />
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
            <Button type="button" onClick={handleAddRow} disabled={addRowPending}>
              <IconPlus className="mr-1.5 size-4" />
              {addRowPending ? "Adding…" : "Add row"}
            </Button>
          </CardContent>
        </Card>
      ) : filteredRows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">No content matches “{query.trim()}”.</p>
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              onClick={() => {
                resetBrowser();
                setPage(0);
              }}
            >
              Clear search
            </Button>
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
          revealRowId={selection?.row.id}
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
