import { useMemo, useState } from "react";
import { toast } from "sonner";
import { IconPencil, IconPlus, IconTrash, IconUsers } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAddGroup,
  useDeleteGroup,
  useUpdateGroup,
  type ProjectDetail,
} from "@/hooks/use-projects";
import type { Group, Row } from "@shared/types";

import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { countGroupMembers } from "./project-utils";

interface GroupPanelProps {
  project: ProjectDetail;
}

export function GroupPanel({ project }: GroupPanelProps) {
  const projectId = project.id;
  const groups = project.app.groups ?? [];

  const addGroup = useAddGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);

  function handleSave(name: string, rowElements: string[], elements: string[]) {
    if (!name.trim()) return;
    if (editing) {
      updateGroup.mutate(
        {
          projectId,
          groupId: editing.id,
          patch: { name: name.trim(), rowElements, elements },
        },
        {
          onSuccess: () => {
            toast.success("Group updated");
            setDialogOpen(false);
          },
          onError: (err) =>
            toast.error(
              err instanceof Error ? err.message : "Failed to update group",
            ),
        },
      );
    } else {
      addGroup.mutate(
        { projectId, name: name.trim() },
        {
          onSuccess: () => {
            toast.success("Group added");
            setDialogOpen(false);
          },
          onError: (err) =>
            toast.error(
              err instanceof Error ? err.message : "Failed to add group",
            ),
        },
      );
    }
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    deleteGroup.mutate(
      { projectId, groupId: target.id },
      {
        onSuccess: () => {
          toast.success("Group deleted");
          setDeleteTarget(null);
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Failed to delete group",
          );
          setDeleteTarget(null);
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {groups.length} group{groups.length === 1 ? "" : "s"} — choices in
          the same group are mutually exclusive
        </p>
        <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
          <IconPlus className="mr-1.5 size-4" />
          Add group
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No groups yet. Use groups to make choices mutually exclusive
              (e.g. picking one class or one origin).
            </p>
            <Button type="button" onClick={() => setDialogOpen(true)}>
              <IconPlus className="mr-1.5 size-4" />
              Add group
            </Button>
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => {
          const memberCount = countGroupMembers(project.app, group.id);
          return (
            <Card key={group.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base">
                      {group.name || "Untitled group"}
                    </CardTitle>
                    <CardDescription className="mt-1 flex items-center gap-1.5">
                      <IconUsers className="size-3.5" />
                      {memberCount} member{memberCount === 1 ? "" : "s"}
                    </CardDescription>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground"
                      onClick={() => {
                        setEditing(group);
                        setDialogOpen(true);
                      }}
                      aria-label={`Edit ${group.name}`}
                      title="Edit"
                    >
                      <IconPencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(group)}
                      aria-label={`Delete ${group.name}`}
                      title="Delete"
                    >
                      <IconTrash className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          );
        })
      )}

      <GroupDialog
        key={editing?.id ?? "new-group"}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        group={editing}
        rows={project.app.rows ?? []}
        busy={addGroup.isPending || updateGroup.isPending}
        onSave={handleSave}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Delete group "${deleteTarget?.name || "Untitled"}"?`}
        description="Choices keep their data but lose their mutual-exclusion grouping."
        busy={deleteGroup.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface GroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: Group | null;
  rows: Row[];
  busy?: boolean;
  onSave: (name: string, rowElements: string[], elements: string[]) => void;
}

function GroupDialog({
  open,
  onOpenChange,
  group,
  rows,
  busy = false,
  onSave,
}: GroupDialogProps) {
  const [value, setValue] = useState(group?.name ?? "");
  const [rowElements, setRowElements] = useState<string[]>(
    group?.rowElements ?? [],
  );
  const [elements, setElements] = useState<string[]>(group?.elements ?? []);
  const isEdit = Boolean(group);

  const choiceOptions = useMemo(() => {
    const out: Array<{ id: string; label: string; rowId: string }> = [];
    for (const row of rows) {
      for (const choice of row.objects ?? []) {
        out.push({
          id: choice.id,
          label: `${choice.title || choice.id} (${row.id})`,
          rowId: row.id,
        });
      }
    }
    return out;
  }, [rows]);

  function toggleRow(rowId: string, row: Row) {
    const childIds = (row.objects ?? []).map((c) => c.id);
    setRowElements((prev) => {
      const on = prev.includes(rowId);
      if (on) {
        setElements((els) => els.filter((id) => !childIds.includes(id)));
        return prev.filter((id) => id !== rowId);
      }
      setElements((els) => [...new Set([...els, ...childIds])]);
      return [...prev, rowId];
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit group" : "Add group"}</DialogTitle>
          <DialogDescription>
            Groups make their choices mutually exclusive in the viewer. Adding a
            row auto-adds its choices; removing a row removes them too.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Name</Label>
            <Input
              id="group-name"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="e.g. Class"
            />
          </div>

          <div className="space-y-2">
            <Label>Rows in group</Label>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rows yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {rows.map((row) => (
                  <label
                    key={row.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent/50"
                  >
                    <Checkbox
                      checked={rowElements.includes(row.id)}
                      onCheckedChange={() => toggleRow(row.id, row)}
                    />
                    <span className="min-w-0 truncate">
                      {row.title || row.id}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Choices in group</Label>
            {choiceOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No choices yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {choiceOptions.map((choice) => (
                  <label
                    key={choice.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent/50"
                  >
                    <Checkbox
                      checked={elements.includes(choice.id)}
                      onCheckedChange={(checked) =>
                        setElements((prev) =>
                          checked
                            ? [...prev, choice.id]
                            : prev.filter((id) => id !== choice.id),
                        )
                      }
                    />
                    <span className="min-w-0 truncate" title={choice.id}>
                      {choice.label}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onSave(value, rowElements, elements)}
            disabled={busy || value.trim().length === 0}
          >
            {isEdit ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
