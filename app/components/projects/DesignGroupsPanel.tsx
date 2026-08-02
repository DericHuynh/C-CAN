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
import type { ObjectDesignGroup, RowDesignGroup } from "@shared/types";
import { newGenericId } from "@shared/cyoa";

import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";

type DesignGroup = RowDesignGroup | ObjectDesignGroup;
type DesignGroupMode = "row" | "choice";

/** Split a comma-separated id list into trimmed, non-empty ids. */
function parseIds(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

interface DesignGroupsPanelProps {
  project: ProjectDetail;
}

interface DesignGroupForm {
  id: string;
  name: string;
  activatedId: string;
  members: string;
}

export function DesignGroupsPanel({ project }: DesignGroupsPanelProps) {
  const projectId = project.id;
  const [mode, setMode] = useState<DesignGroupMode>("row");

  const groups: DesignGroup[] =
    mode === "row"
      ? (project.app.rowDesignGroups ?? [])
      : (project.app.objectDesignGroups ?? []);
  const collectionKey =
    mode === "row" ? "rowDesignGroups" : "objectDesignGroups";

  const updateSettings = useUpdateProjectSettings();

  const [editing, setEditing] = useState<DesignGroup | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DesignGroup | null>(null);

  function createGroup(): DesignGroup {
    return {
      id: newGenericId("design"),
      name: `Design Group ${groups.length + 1}`,
      activatedId: "",
      elements: [],
      backpackElements: [],
      groupElements: [],
      styling: {},
    };
  }

  function handleAdd() {
    updateSettings.mutate(
      { projectId, patch: { [collectionKey]: [...groups, createGroup()] } },
      {
        onSuccess: () => toast.success("Design group added"),
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Failed to add design group",
          ),
      },
    );
  }

  function handleSave(form: DesignGroupForm) {
    if (!editing) return;
    const next = groups.map((group) =>
      group.id === editing.id
        ? {
            ...group,
            id: form.id,
            name: form.name,
            activatedId: form.activatedId,
            elements: parseIds(form.members),
          }
        : group,
    );
    updateSettings.mutate(
      { projectId, patch: { [collectionKey]: next } },
      {
        onSuccess: () => {
          toast.success("Design group updated");
          setDialogOpen(false);
        },
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Failed to update design group",
          ),
      },
    );
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const next = groups.filter((group) => group.id !== target.id);
    updateSettings.mutate(
      { projectId, patch: { [collectionKey]: next } },
      {
        onSuccess: () => {
          toast.success("Design group deleted");
          setDeleteTarget(null);
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Failed to delete design group",
          );
          setDeleteTarget(null);
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {groups.length} {mode} design group
          {groups.length === 1 ? "" : "s"} — private styling applied to{" "}
          {mode === "row" ? "rows" : "choices"} in the list
        </p>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
            <Button
              type="button"
              size="sm"
              variant={mode === "row" ? "secondary" : "ghost"}
              className="h-7 px-3"
              onClick={() => setMode("row")}
            >
              Row
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "choice" ? "secondary" : "ghost"}
              className="h-7 px-3"
              onClick={() => setMode("choice")}
            >
              Choice
            </Button>
          </div>
          <Button type="button" size="sm" onClick={handleAdd}>
            <IconPlus className="mr-1.5 size-4" />
            New design group
          </Button>
        </div>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No {mode} design groups yet. Design groups bundle private styling
              that applies to every {mode === "row" ? "row" : "choice"} listed
              in their members.
            </p>
            <Button type="button" onClick={handleAdd}>
              <IconPlus className="mr-1.5 size-4" />
              New design group
            </Button>
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => {
          const memberCount = group.elements?.length ?? 0;
          return (
            <Card key={group.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base">
                      {group.name || "Untitled design group"}
                    </CardTitle>
                    <CardDescription className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-xs">{group.id}</span>
                      <span>
                        · {memberCount} member
                        {memberCount === 1 ? "" : "s"}
                      </span>
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
              <CardContent>
                <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                  {group.activatedId ? (
                    <Badge variant="secondary">
                      Gated by {group.activatedId}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Always active</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      <DesignGroupDialog
        key={`${mode}-${editing?.id ?? "new"}`}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        group={editing}
        mode={mode}
        busy={updateSettings.isPending}
        onSave={handleSave}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Delete design group "${deleteTarget?.name || "Untitled"}"?`}
        description="Rows and choices keep their styling references but the design group's private styling stops applying."
        busy={updateSettings.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface DesignGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: DesignGroup | null;
  mode: DesignGroupMode;
  busy?: boolean;
  onSave: (form: DesignGroupForm) => void;
}

function DesignGroupDialog({
  open,
  onOpenChange,
  group,
  mode,
  busy = false,
  onSave,
}: DesignGroupDialogProps) {
  const [id, setId] = useState(group?.id ?? "");
  const [name, setName] = useState(group?.name ?? "");
  const [activatedId, setActivatedId] = useState(group?.activatedId ?? "");
  const [members, setMembers] = useState((group?.elements ?? []).join(", "));

  function handleSave() {
    onSave({ id, name, activatedId, members });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit design group</DialogTitle>
          <DialogDescription>
            Design groups apply private styling to every{" "}
            {mode === "row" ? "row" : "choice"} listed as a member.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="design-group-id">Id</Label>
              <Input
                id="design-group-id"
                value={id}
                onChange={(event) => setId(event.target.value)}
                placeholder="e.g. design-a1b2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="design-group-name">Name</Label>
              <Input
                id="design-group-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Dark mode"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="design-group-activated">
              Activated by (choice/global requirement id)
            </Label>
            <Input
              id="design-group-activated"
              value={activatedId}
              onChange={(event) => setActivatedId(event.target.value)}
              placeholder="e.g. choice-x9k2 — leave empty for always active"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="design-group-members">
              Members ({mode === "row" ? "row" : "choice"} ids,
              comma-separated)
            </Label>
            <Input
              id="design-group-members"
              value={members}
              onChange={(event) => setMembers(event.target.value)}
              placeholder={mode === "row" ? "row-a1b2, row-c3d4" : "choice-x9k2, choice-m7n8"}
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
