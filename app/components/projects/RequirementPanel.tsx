import { useMemo, useState } from "react";
import { toast } from "sonner";
import { IconListCheck, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  useAddGlobalRequirement,
  useDeleteGlobalRequirement,
  useUpdateGlobalRequirement,
  type ProjectDetail,
} from "@/hooks/use-projects";
import type { GlobalRequirement, Requireds } from "@shared/types";

import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { RequirementListEditor } from "./RequirementListEditor";

interface RequirementPanelProps {
  project: ProjectDetail;
}

export function RequirementPanel({ project }: RequirementPanelProps) {
  const projectId = project.id;
  const requirements = project.app.globalRequirements ?? [];

  const addRequirement = useAddGlobalRequirement();
  const updateRequirement = useUpdateGlobalRequirement();
  const deleteRequirement = useDeleteGlobalRequirement();

  const choiceOptions = useMemo(() => {
    const out: { id: string; label: string }[] = [];
    for (const row of project.app.rows ?? []) {
      for (const choice of row.objects ?? []) {
        out.push({
          id: choice.id,
          label: `${choice.title || choice.id} (${row.id})`,
        });
      }
    }
    return out;
  }, [project.app]);
  const pointTypeOptions = useMemo(
    () =>
      (project.app.pointTypes ?? []).map((pointType) => ({
        id: pointType.id,
        name: pointType.name || pointType.id,
      })),
    [project.app],
  );
  const globalReqOptions = useMemo(
    () =>
      (project.app.globalRequirements ?? []).map((req) => ({
        id: req.id,
        name: req.name || req.id,
      })),
    [project.app],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GlobalRequirement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GlobalRequirement | null>(
    null,
  );

  function handleSave(name: string, requireds: Requireds[]) {
    if (!name.trim()) return;
    if (editing) {
      updateRequirement.mutate(
        {
          projectId,
          requirementId: editing.id,
          patch: { name: name.trim(), requireds },
        },
        {
          onSuccess: () => {
            toast.success("Requirement updated");
            setDialogOpen(false);
          },
          onError: (err) =>
            toast.error(
              err instanceof Error
                ? err.message
                : "Failed to update requirement",
            ),
        },
      );
    } else {
      addRequirement.mutate(
        { projectId, name: name.trim() },
        {
          onSuccess: () => {
            toast.success("Requirement added");
            setDialogOpen(false);
          },
          onError: (err) =>
            toast.error(
              err instanceof Error ? err.message : "Failed to add requirement",
            ),
        },
      );
    }
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    deleteRequirement.mutate(
      { projectId, requirementId: target.id },
      {
        onSuccess: () => {
          toast.success("Requirement deleted");
          setDeleteTarget(null);
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Failed to delete requirement",
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
          {requirements.length} global requirement
          {requirements.length === 1 ? "" : "s"} — reusable gates for choices
        </p>
        <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
          <IconPlus className="mr-1.5 size-4" />
          Add requirement
        </Button>
      </div>

      {requirements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No global requirements yet. Global requirements can be attached to
              choices to gate them on other selections or point thresholds.
            </p>
            <Button type="button" onClick={() => setDialogOpen(true)}>
              <IconPlus className="mr-1.5 size-4" />
              Add requirement
            </Button>
          </CardContent>
        </Card>
      ) : (
        requirements.map((requirement) => (
          <Card key={requirement.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <IconListCheck className="size-4 shrink-0 text-muted-foreground" />
                    <CardTitle className="text-base">
                      {requirement.name || "Untitled requirement"}
                    </CardTitle>
                  </div>
                  <CardDescription className="mt-1">
                    {requirement.requireds?.length ?? 0} condition
                    {(requirement.requireds?.length ?? 0) === 1 ? "" : "s"}
                  </CardDescription>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                    onClick={() => {
                      setEditing(requirement);
                      setDialogOpen(true);
                    }}
                    aria-label={`Edit ${requirement.name}`}
                    title="Edit"
                  >
                    <IconPencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(requirement)}
                    aria-label={`Delete ${requirement.name}`}
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

      <RequirementDialog
        key={editing?.id ?? "new-requirement"}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        requirement={editing}
        choices={choiceOptions}
        pointTypes={pointTypeOptions}
        globalRequirements={globalReqOptions}
        busy={addRequirement.isPending || updateRequirement.isPending}
        onSave={handleSave}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Delete requirement "${deleteTarget?.name || "Untitled"}"?`}
        description="Choices that reference this requirement will treat it as unmet until it is recreated."
        busy={deleteRequirement.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface RequirementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirement: GlobalRequirement | null;
  choices: { id: string; label: string }[];
  pointTypes: { id: string; name: string }[];
  globalRequirements: { id: string; name: string }[];
  busy?: boolean;
  onSave: (name: string, requireds: Requireds[]) => void;
}

function RequirementDialog({
  open,
  onOpenChange,
  requirement,
  choices,
  pointTypes,
  globalRequirements,
  busy = false,
  onSave,
}: RequirementDialogProps) {
  const [value, setValue] = useState(requirement?.name ?? "");
  const [requireds, setRequireds] = useState<Requireds[]>(
    requirement?.requireds ?? [],
  );
  const isEdit = Boolean(requirement);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit requirement" : "Add requirement"}
          </DialogTitle>
          <DialogDescription>
            Give the requirement a descriptive name and add the conditions that
            gate it. Conditions are AND-combined.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="requirement-name">Name</Label>
            <Input
              id="requirement-name"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="e.g. Has a weapon"
            />
          </div>
          <div className="space-y-2">
            <Label>Conditions</Label>
            <RequirementListEditor
              requireds={requireds}
              onChange={setRequireds}
              choices={choices}
              pointTypes={pointTypes}
              globalRequirements={globalRequirements}
            />
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
            onClick={() => onSave(value, requireds)}
            disabled={busy || value.trim().length === 0}
          >
            {isEdit ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
