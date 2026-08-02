import { useState } from "react";
import { toast } from "sonner";
import {
  IconArrowDown,
  IconArrowUp,
  IconBackpack,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useUpdateProjectSettings,
  type ProjectDetail,
} from "@/hooks/use-projects";
import { createDefaultRow } from "@shared/cyoa";
import type { Row } from "@shared/types";

import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { RowEditorDialog } from "./RowEditorDialog";

interface BackpackPanelProps {
  project: ProjectDetail;
}

/**
 * Editor for `app.backpack` — the result/summary rows shown in the viewer's
 * backpack dialog. Mirrors the original "Backpack & Choice Import" feature.
 */
export function BackpackPanel({ project }: BackpackPanelProps) {
  const projectId = project.id;
  const rows = project.app.backpack ?? [];
  const updateSettings = useUpdateProjectSettings();

  const [editing, setEditing] = useState<Row | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

  function commit(next: Row[]) {
    updateSettings.mutate(
      { projectId, patch: { backpack: next } },
      {
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Failed to save backpack",
          ),
      },
    );
  }

  function addRow() {
    const next = [...rows, { ...createDefaultRow(project.app, rows.length), isBackpack: true }];
    commit(next);
    toast.success("Backpack row added");
  }

  function sortedRows(list: Row[]): Row[] {
    return [...list].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  }

  function handleSave(patch: Record<string, unknown>) {
    if (!editing) return;
    commit(
      rows.map((row) => (row.id === editing.id ? { ...row, ...patch } : row)),
    );
    toast.success("Backpack row saved");
    setDialogOpen(false);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    commit(rows.filter((row) => row.id !== target.id));
    toast.success("Backpack row deleted");
    setDeleteTarget(null);
  }

  function move(rowId: string, delta: -1 | 1) {
    const index = rows.findIndex((row) => row.id === rowId);
    const target = index + delta;
    if (index === -1 || target < 0 || target >= rows.length) return;
    const next = [...rows];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    commit(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rows.length} backpack row{rows.length === 1 ? "" : "s"} — shown in
          the viewer's backpack dialog
        </p>
        <Button type="button" size="sm" onClick={addRow}>
          <IconPlus className="mr-1.5 size-4" />
          Add backpack row
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <IconBackpack className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No backpack rows yet. Backpack rows summarize the reader's
              selections (e.g. a final "Your build" list).
            </p>
            <Button type="button" onClick={addRow}>
              <IconPlus className="mr-1.5 size-4" />
              Add backpack row
            </Button>
          </CardContent>
        </Card>
      ) : (
        sortedRows(rows).map((row, index) => (
          <Card key={row.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">
                      {row.title || "Untitled backpack row"}
                    </CardTitle>
                    {row.isResultRow ? (
                      <Badge variant="secondary">Result</Badge>
                    ) : null}
                    {row.isInfoRow ? (
                      <Badge variant="outline">Info</Badge>
                    ) : null}
                  </div>
                  <CardDescription className="mt-1">
                    {(row.objects ?? []).length} choice
                    {(row.objects ?? []).length === 1 ? "" : "s"}
                    {row.resultGroupId ? ` · group ${row.resultGroupId}` : ""}
                  </CardDescription>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                    disabled={index === 0}
                    onClick={() => move(row.id, -1)}
                    aria-label="Move up"
                    title="Move up"
                  >
                    <IconArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                    disabled={index === rows.length - 1}
                    onClick={() => move(row.id, 1)}
                    aria-label="Move down"
                    title="Move down"
                  >
                    <IconArrowDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                    onClick={() => {
                      setEditing(row);
                      setDialogOpen(true);
                    }}
                    aria-label={`Edit ${row.title}`}
                    title="Edit"
                  >
                    <IconPencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(row)}
                    aria-label={`Delete ${row.title}`}
                    title="Delete"
                  >
                    <IconTrash className="size-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))
      )}

      <RowEditorDialog
        key={editing?.id ?? "new-backpack-row"}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        row={editing}
        busy={updateSettings.isPending}
        onSave={handleSave}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Delete backpack row "${deleteTarget?.title || "Untitled"}"?`}
        description="The row and its choices are removed from the backpack."
        busy={updateSettings.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
