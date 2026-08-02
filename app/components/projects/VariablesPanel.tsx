import { useState } from "react";
import { toast } from "sonner";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
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
  useUpdateProjectSettings,
  type ProjectDetail,
} from "@/hooks/use-projects";
import type { Variable } from "@shared/types";
import { createDefaultVariable } from "@shared/cyoa";

import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";

interface VariablesPanelProps {
  project: ProjectDetail;
}

interface VariableForm {
  id: string;
  isTrue: boolean;
}

export function VariablesPanel({ project }: VariablesPanelProps) {
  const projectId = project.id;
  const variables = project.app.variables ?? [];

  const updateSettings = useUpdateProjectSettings();

  const [editing, setEditing] = useState<Variable | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Variable | null>(null);

  function handleAdd() {
    updateSettings.mutate(
      { projectId, patch: { variables: [...variables, createDefaultVariable()] } },
      {
        onSuccess: () => toast.success("Variable added"),
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Failed to add variable",
          ),
      },
    );
  }

  function handleSave(form: VariableForm) {
    if (!editing) return;
    const next = variables.map((variable) =>
      variable.id === editing.id ? { ...variable, ...form } : variable,
    );
    updateSettings.mutate(
      { projectId, patch: { variables: next } },
      {
        onSuccess: () => {
          toast.success("Variable updated");
          setDialogOpen(false);
        },
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Failed to update variable",
          ),
      },
    );
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const next = variables.filter((variable) => variable.id !== target.id);
    updateSettings.mutate(
      { projectId, patch: { variables: next } },
      {
        onSuccess: () => {
          toast.success("Variable deleted");
          setDeleteTarget(null);
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Failed to delete variable",
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
          {variables.length} variable
          {variables.length === 1 ? "" : "s"} — boolean flags the story can read
        </p>
        <Button type="button" size="sm" onClick={handleAdd}>
          <IconPlus className="mr-1.5 size-4" />
          New variable
        </Button>
      </div>

      {variables.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No variables yet. Variables are true/false flags (e.g. tookTheSword)
              that requirements and conditions can check.
            </p>
            <Button type="button" onClick={handleAdd}>
              <IconPlus className="mr-1.5 size-4" />
              New variable
            </Button>
          </CardContent>
        </Card>
      ) : (
        variables.map((variable) => (
          <Card key={variable.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="font-mono text-base">
                      {variable.id || "Untitled variable"}
                    </CardTitle>
                    <Badge
                      variant={variable.isTrue ? "default" : "outline"}
                    >
                      {variable.isTrue ? "true" : "false"}
                    </Badge>
                  </div>
                  <CardDescription className="mt-1">
                    {variable.isTrue
                      ? "Currently true — the story treats this flag as set."
                      : "Currently false — the story treats this flag as unset."}
                  </CardDescription>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                    onClick={() => {
                      setEditing(variable);
                      setDialogOpen(true);
                    }}
                    aria-label={`Edit ${variable.id}`}
                    title="Edit"
                  >
                    <IconPencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(variable)}
                    aria-label={`Delete ${variable.id}`}
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

      <VariableDialog
        key={editing?.id ?? "edit-variable"}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        variable={editing}
        busy={updateSettings.isPending}
        onSave={handleSave}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Delete variable "${deleteTarget?.id || "Untitled"}"?`}
        description="Requirements and conditions that reference this variable will treat it as never set until it is recreated."
        busy={updateSettings.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface VariableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variable: Variable | null;
  busy?: boolean;
  onSave: (form: VariableForm) => void;
}

function VariableDialog({
  open,
  onOpenChange,
  variable,
  busy = false,
  onSave,
}: VariableDialogProps) {
  const [id, setId] = useState(variable?.id ?? "");
  const [isTrue, setIsTrue] = useState(variable?.isTrue ?? false);

  function handleSave() {
    onSave({ id, isTrue });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit variable</DialogTitle>
          <DialogDescription>
            Variables are boolean flags. Requirements can check them to gate
            choices, rows, and point bars.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="variable-id">Id</Label>
            <Input
              id="variable-id"
              value={id}
              onChange={(event) => setId(event.target.value)}
              placeholder="e.g. tookTheSword"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={isTrue}
              onCheckedChange={(checked) => setIsTrue(checked === true)}
            />
            Variable is true
          </label>
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
            onClick={handleSave}
            disabled={busy || id.trim().length === 0}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
