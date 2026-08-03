import { useMemo, useState } from "react";
import { toast } from "sonner";
import { IconArrowDown, IconArrowUp, IconBackpack, IconPlus, IconTrash } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useUpdateProjectSettings, type ProjectDetail } from "@/hooks/use-projects";
import { createDefaultRow } from "@shared/cyoa";
import type { Row } from "@shared/types";

import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { MasterDetail } from "./MasterDetail";
import { PaginatedList } from "./PaginatedList";
import { RowEditor } from "./RowEditor";

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
  // Stable sort for the (paginated) master list.
  const sorted = useMemo(() => [...rows].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)), [rows]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

  function commit(next: Row[]) {
    updateSettings.mutate(
      { projectId, patch: { backpack: next } },
      {
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to save backpack"),
      },
    );
  }

  function addRow() {
    const next = [...rows, { ...createDefaultRow(project.app, rows.length), isBackpack: true }];
    commit(next);
    toast.success("Backpack row added");
  }

  function handleSave(patch: Record<string, unknown>) {
    const selected = rows.find((row) => row.id === selectedId);
    if (!selected) return;
    commit(rows.map((row) => (row.id === selected.id ? { ...row, ...patch } : row)));
    toast.success("Backpack row saved");
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    commit(rows.filter((row) => row.id !== target.id));
    if (selectedId === target.id) setSelectedId(null);
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

  const selected = rows.find((row) => row.id === selectedId) ?? null;

  return (
    <MasterDetail
      master={
        <div className="space-y-3">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-background/95 py-2 backdrop-blur">
            <p className="text-sm text-muted-foreground">
              {rows.length} backpack row{rows.length === 1 ? "" : "s"} — shown in the viewer's
              backpack dialog
            </p>
            <Button type="button" size="sm" onClick={addRow}>
              <IconPlus className="mr-1.5 size-4" />
              Add
            </Button>
          </div>

          {rows.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <IconBackpack className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No backpack rows yet. Backpack rows summarize the reader's selections (e.g. a
                  final "Your build" list).
                </p>
                <Button type="button" onClick={addRow}>
                  <IconPlus className="mr-1.5 size-4" />
                  Add backpack row
                </Button>
              </CardContent>
            </Card>
          ) : (
            <PaginatedList
              items={sorted}
              getItemKey={(row) => row.id}
              pageSize={20}
              renderItem={(row, index) => (
                <Card
                  key={row.id}
                  className={cn(
                    "cursor-pointer transition-colors",
                    selectedId === row.id && "border-primary bg-primary/5",
                  )}
                  onClick={() => setSelectedId(row.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-base">{row.title}</CardTitle>
                          {row.isResultRow ? <Badge variant="secondary">Result</Badge> : null}
                          {row.isInfoRow ? <Badge variant="outline">Info</Badge> : null}
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
                          onClick={(event) => {
                            event.stopPropagation();
                            move(row.id, -1);
                          }}
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
                          onClick={(event) => {
                            event.stopPropagation();
                            move(row.id, 1);
                          }}
                          aria-label="Move down"
                          title="Move down"
                        >
                          <IconArrowDown className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteTarget(row);
                          }}
                          aria-label={`Delete ${row.title}`}
                          title="Delete"
                        >
                          <IconTrash className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              )}
            />
          )}
        </div>
      }
      detail={
        selected ? (
          <RowEditor
            key={`backpack:${selected.id}`}
            row={selected}
            app={project.app}
            busy={updateSettings.isPending}
            onCancel={() => setSelectedId(null)}
            onSave={handleSave}
          />
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
              <IconBackpack className="size-6 text-muted-foreground/50" />
              <p className="max-w-sm text-sm text-muted-foreground">
                Select a backpack row to edit it here. Backpack rows are the summary rows shown in
                the viewer's backpack dialog after play.
              </p>
            </CardContent>
          </Card>
        )
      }
    />
  );
}
