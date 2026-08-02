import { useState } from "react";
import { toast } from "sonner";
import {
  IconChevronDown,
  IconChevronUp,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useAddChoice,
  useAddRow,
  useAddScore,
  useDeleteChoice,
  useDeleteRow,
  useMoveChoice,
  useMoveRow,
  useUpdateChoice,
  useUpdateRow,
  type ProjectDetail,
} from "@/hooks/use-projects";
import type { Choice, Row } from "@shared/types";

import { ChoiceEditorDialog } from "./ChoiceEditorDialog";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import {
  formatScoreChip,
  pointTypeName,
  sortedChoices,
  sortedRows,
} from "./project-utils";
import { RowEditorDialog } from "./RowEditorDialog";

interface RowsPanelProps {
  project: ProjectDetail;
}

interface ChoiceTarget {
  row: Row;
  choice: Choice;
}

export function RowsPanel({ project }: RowsPanelProps) {
  const { app } = project;
  const projectId = project.id;
  const rows = sortedRows(app);
  const pointTypes = app.pointTypes ?? [];
  const groups = app.groups ?? [];

  const addRow = useAddRow();
  const moveRow = useMoveRow();
  const deleteRow = useDeleteRow();
  const updateRow = useUpdateRow();
  const addChoice = useAddChoice();
  const moveChoice = useMoveChoice();
  const deleteChoice = useDeleteChoice();
  const updateChoice = useUpdateChoice();
  const addScore = useAddScore();

  const [editingRow, setEditingRow] = useState<Row | null>(null);
  const [editingChoice, setEditingChoice] = useState<ChoiceTarget | null>(null);
  const [deleteRowTarget, setDeleteRowTarget] = useState<Row | null>(null);
  const [deleteChoiceTarget, setDeleteChoiceTarget] =
    useState<ChoiceTarget | null>(null);

  function handleAddRow() {
    addRow.mutate(
      { projectId },
      {
        onSuccess: () => toast.success("Row added"),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to add row"),
      },
    );
  }

  function handleMoveRow(row: Row, direction: -1 | 1) {
    moveRow.mutate(
      { projectId, rowId: row.id, index: (row.index ?? 0) + direction },
      {
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Failed to move row",
          ),
      },
    );
  }

  function handleDeleteRow() {
    if (!deleteRowTarget) return;
    const target = deleteRowTarget;
    deleteRow.mutate(
      { projectId, rowId: target.id },
      {
        onSuccess: () => {
          toast.success("Row deleted");
          setDeleteRowTarget(null);
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Failed to delete row",
          );
          setDeleteRowTarget(null);
        },
      },
    );
  }

  function handleSaveRow(patch: Record<string, unknown>) {
    if (!editingRow) return;
    const rowId = editingRow.id;
    updateRow.mutate(
      { projectId, rowId, patch },
      {
        onSuccess: () => {
          toast.success("Row updated");
          setEditingRow(null);
        },
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Failed to update row",
          ),
      },
    );
  }

  function handleAddChoice(row: Row) {
    addChoice.mutate(
      { projectId, rowId: row.id },
      {
        onSuccess: () => toast.success("Choice added"),
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Failed to add choice",
          ),
      },
    );
  }

  function handleMoveChoice(choice: Choice, direction: -1 | 1) {
    const row = rows.find((r) =>
      (r.objects ?? []).some((c) => c.id === choice.id),
    );
    if (!row) return;
    moveChoice.mutate(
      {
        projectId,
        rowId: row.id,
        choiceId: choice.id,
        index: (choice.index ?? 0) + direction,
      },
      {
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Failed to move choice",
          ),
      },
    );
  }

  function handleDeleteChoice() {
    if (!deleteChoiceTarget) return;
    const { row, choice } = deleteChoiceTarget;
    deleteChoice.mutate(
      { projectId, rowId: row.id, choiceId: choice.id },
      {
        onSuccess: () => {
          toast.success("Choice deleted");
          setDeleteChoiceTarget(null);
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Failed to delete choice",
          );
          setDeleteChoiceTarget(null);
        },
      },
    );
  }

  function handleSaveChoice(patch: Record<string, unknown>) {
    if (!editingChoice) return;
    const { row, choice } = editingChoice;
    updateChoice.mutate(
      { projectId, rowId: row.id, choiceId: choice.id, patch },
      {
        onSuccess: () => {
          toast.success("Choice updated");
          setEditingChoice(null);
        },
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Failed to update choice",
          ),
      },
    );
  }

  function handleAddScore(row: Row, choice: Choice, pointTypeId: string) {
    addScore.mutate(
      { projectId, rowId: row.id, choiceId: choice.id, pointTypeId },
      {
        onSuccess: () =>
          toast.success(
            `Added ${pointTypeName(pointTypes, pointTypeId)} score`,
          ),
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Failed to add score",
          ),
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rows.length} row{rows.length === 1 ? "" : "s"} ·{" "}
          {rows.reduce((sum, row) => sum + (row.objects?.length ?? 0), 0)}{" "}
          choices
        </p>
        <Button type="button" size="sm" onClick={handleAddRow}>
          <IconPlus className="mr-1.5 size-4" />
          Add row
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No rows yet. Rows hold the choices readers pick from — add your
              first row to get started.
            </p>
            <Button type="button" onClick={handleAddRow}>
              <IconPlus className="mr-1.5 size-4" />
              Add row
            </Button>
          </CardContent>
        </Card>
      ) : (
        rows.map((row, rowPosition) => (
          <RowCard
            key={row.id}
            row={row}
            rowPosition={rowPosition}
            totalRows={rows.length}
            pointTypes={pointTypes}
            groups={groups}
            onMoveUp={() => handleMoveRow(row, -1)}
            onMoveDown={() => handleMoveRow(row, 1)}
            onEdit={() => setEditingRow(row)}
            onAddChoice={() => handleAddChoice(row)}
            onDelete={() => setDeleteRowTarget(row)}
            onEditChoice={(choice) => setEditingChoice({ row, choice })}
            onMoveChoice={(choice, direction) =>
              handleMoveChoice(choice, direction)
            }
            onDeleteChoice={(choice) => setDeleteChoiceTarget({ row, choice })}
            onAddScore={(choice, pointTypeId) =>
              handleAddScore(row, choice, pointTypeId)
            }
          />
        ))
      )}

      <RowEditorDialog
        key={editingRow?.id ?? "row-editor"}
        open={Boolean(editingRow)}
        onOpenChange={(open) => {
          if (!open) setEditingRow(null);
        }}
        row={editingRow}
        busy={updateRow.isPending}
        onSave={handleSaveRow}
      />

      <ChoiceEditorDialog
        key={editingChoice?.choice.id ?? "choice-editor"}
        open={Boolean(editingChoice)}
        onOpenChange={(open) => {
          if (!open) setEditingChoice(null);
        }}
        choice={editingChoice?.choice ?? null}
        pointTypes={pointTypes}
        groups={groups}
        busy={updateChoice.isPending}
        onSave={handleSaveChoice}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteRowTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteRowTarget(null);
        }}
        title={`Delete row "${deleteRowTarget?.title || "Untitled row"}"?`}
        description="This deletes the row and all of its choices."
        busy={deleteRow.isPending}
        onConfirm={handleDeleteRow}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteChoiceTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteChoiceTarget(null);
        }}
        title={`Delete choice "${deleteChoiceTarget?.choice.title || "Untitled choice"}"?`}
        description="This deletes the choice and its scores."
        busy={deleteChoice.isPending}
        onConfirm={handleDeleteChoice}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface RowCardProps {
  row: Row;
  rowPosition: number;
  totalRows: number;
  pointTypes: ProjectDetail["app"]["pointTypes"];
  groups: ProjectDetail["app"]["groups"];
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onAddChoice: () => void;
  onDelete: () => void;
  onEditChoice: (choice: Choice) => void;
  onMoveChoice: (choice: Choice, direction: -1 | 1) => void;
  onDeleteChoice: (choice: Choice) => void;
  onAddScore: (choice: Choice, pointTypeId: string) => void;
}

function RowCard({
  row,
  rowPosition,
  totalRows,
  pointTypes,
  groups,
  onMoveUp,
  onMoveDown,
  onEdit,
  onAddChoice,
  onDelete,
  onEditChoice,
  onMoveChoice,
  onDeleteChoice,
  onAddScore,
}: RowCardProps) {
  const choices = sortedChoices(row);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="shrink-0">
                Row {rowPosition + 1}
              </Badge>
              <CardTitle className="text-base">
                {row.title || "Untitled row"}
              </CardTitle>
            </div>
            {row.titleText ? (
              <CardDescription className="mt-1">
                {row.titleText}
              </CardDescription>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              onClick={onMoveUp}
              disabled={rowPosition === 0}
              aria-label="Move row up"
            >
              <IconChevronUp className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              onClick={onMoveDown}
              disabled={rowPosition === totalRows - 1}
              aria-label="Move row down"
            >
              <IconChevronDown className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              onClick={onAddChoice}
              aria-label="Add choice"
              title="Add choice"
            >
              <IconPlus className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              onClick={onEdit}
              aria-label="Edit row"
              title="Edit row"
            >
              <IconPencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              aria-label="Delete row"
              title="Delete row"
            >
              <IconTrash className="size-4" />
            </Button>
          </div>
        </div>

        {row.image ? (
          <img
            src={row.image}
            alt=""
            className="mt-3 h-20 w-full max-w-xs rounded-md border border-border object-cover"
          />
        ) : null}

        {(row.allowedChoices ?? 0) > 0 || row.objectWidth ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(row.allowedChoices ?? 0) > 0 ? (
              <Badge variant="secondary">
                Max {row.allowedChoices} selection
                {row.allowedChoices === 1 ? "" : "s"}
              </Badge>
            ) : null}
            {row.objectWidth ? (
              <Badge variant="secondary">{row.objectWidth}</Badge>
            ) : null}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-2">
        {choices.length === 0 ? (
          <p className="py-1 text-sm text-muted-foreground">
            No choices in this row yet.
          </p>
        ) : (
          choices.map((choice, choicePosition) => (
            <ChoiceCard
              key={choice.id}
              choice={choice}
              choicePosition={choicePosition}
              totalChoices={choices.length}
              pointTypes={pointTypes}
              groups={groups}
              onEdit={() => onEditChoice(choice)}
              onMoveUp={() => onMoveChoice(choice, -1)}
              onMoveDown={() => onMoveChoice(choice, 1)}
              onDelete={() => onDeleteChoice(choice)}
              onAddScore={(pointTypeId) => onAddScore(choice, pointTypeId)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

interface ChoiceCardProps {
  choice: Choice;
  choicePosition: number;
  totalChoices: number;
  pointTypes: ProjectDetail["app"]["pointTypes"];
  groups: ProjectDetail["app"]["groups"];
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onAddScore: (pointTypeId: string) => void;
}

function ChoiceCard({
  choice,
  choicePosition,
  totalChoices,
  pointTypes,
  groups,
  onEdit,
  onMoveUp,
  onMoveDown,
  onDelete,
  onAddScore,
}: ChoiceCardProps) {
  const scoredPointTypeIds = new Set(
    (choice.scores ?? [])
      .map((score) => score.id ?? score.type)
      .filter(Boolean),
  );
  const availablePointTypes = pointTypes.filter(
    (pt) => !scoredPointTypeIds.has(pt.id),
  );
  const groupName = (groupId: string) =>
    groups.find((group) => group.id === groupId)?.name ?? groupId;

  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 transition-colors hover:border-muted-foreground/30">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-medium">
            {choice.title || "Untitled choice"}
          </h4>
          {choice.text ? (
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
              {choice.text}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            onClick={onMoveUp}
            disabled={choicePosition === 0}
            aria-label="Move choice up"
          >
            <IconChevronUp className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            onClick={onMoveDown}
            disabled={choicePosition === totalChoices - 1}
            aria-label="Move choice down"
          >
            <IconChevronDown className="size-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground"
                aria-label="Add score"
                title="Add score"
              >
                <IconPlus className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Add score</DropdownMenuLabel>
              {availablePointTypes.length === 0 ? (
                <DropdownMenuItem disabled>
                  All point types are scored
                </DropdownMenuItem>
              ) : (
                availablePointTypes.map((pt) => (
                  <DropdownMenuItem
                    key={pt.id}
                    onSelect={() => onAddScore(pt.id)}
                  >
                    {pt.name}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            onClick={onEdit}
            aria-label="Edit choice"
            title="Edit choice"
          >
            <IconPencil className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            aria-label="Delete choice"
            title="Delete choice"
          >
            <IconTrash className="size-3.5" />
          </Button>
        </div>
      </div>

      {choice.image ? (
        <img
          src={choice.image}
          alt=""
          className="mt-2 h-14 w-24 rounded-md border border-border object-cover"
        />
      ) : null}

      {(choice.scores?.length ?? 0) > 0 ||
      (choice.groups?.length ?? 0) > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {(choice.scores ?? []).map((score, index) => (
            <Badge
              key={`${score.id ?? score.type}-${index}`}
              variant="secondary"
            >
              {formatScoreChip(score, pointTypes)}
            </Badge>
          ))}
          {(choice.groups ?? []).map((groupId) => (
            <Badge key={groupId} variant="outline">
              {groupName(groupId)}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
