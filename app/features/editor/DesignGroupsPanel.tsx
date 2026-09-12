import { useLiveSelection } from "./use-live-selection";
import { useSavedField } from "./use-saved-field";
import { useState } from "react";
import { toast } from "sonner";
import { IconPlus, IconTrash } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useUpdateProjectSettings, type ProjectDetail } from "@/features/projects/use-projects";
import type { ObjectDesignGroup, RowDesignGroup } from "@shared/types";
import { newGenericId } from "@shared/cyoa";

import { ConfirmDeleteDialog } from "@/features/editor/ConfirmDeleteDialog";
import { CopyId } from "@/features/editor/CopyId";
import { EditorPane } from "@/features/editor/EditorPane";
import { MasterDetail } from "@/features/editor/MasterDetail";
import { PaginatedList } from "@/features/editor/PaginatedList";

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

interface DesignGroupFormData {
  id: string;
  name: string;
  activatedId: string;
  members: string;
}

export function DesignGroupsPanel({ project }: DesignGroupsPanelProps) {
  const projectId = project.id;
  const [mode, setMode] = useState<DesignGroupMode>("row");

  const groups: DesignGroup[] =
    mode === "row" ? (project.app.rowDesignGroups ?? []) : (project.app.objectDesignGroups ?? []);
  const collectionKey = mode === "row" ? "rowDesignGroups" : "objectDesignGroups";

  const updateSettings = useUpdateProjectSettings();

  const [selected, setSelected] = useLiveSelection<DesignGroup>(groups);
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

  function handleSave(form: DesignGroupFormData) {
    if (selected === "new") {
      const next = [
        ...groups,
        {
          ...createGroup(),
          id: form.id,
          name: form.name,
          activatedId: form.activatedId,
          elements: parseIds(form.members),
        },
      ];
      updateSettings.mutate(
        { projectId, patch: { [collectionKey]: next } },
        {
          onSuccess: () => {
            toast.success("Design group added");
            setSelected(null);
          },
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to add design group"),
        },
      );
    } else if (selected) {
      const next = groups.map((group) =>
        group.id === selected.id
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
            setSelected(null);
          },
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to update design group"),
        },
      );
    }
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
          if (selected !== null && selected !== "new" && selected.id === target.id) {
            setSelected(null);
          }
          setDeleteTarget(null);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to delete design group");
          setDeleteTarget(null);
        },
      },
    );
  }

  const detail =
    selected === "new" ? (
      <DesignGroupForm
        key={`${mode}-new`}
        item={null}
        mode={mode}
        busy={updateSettings.isPending}
        onCancel={() => setSelected(null)}
        onSave={handleSave}
      />
    ) : selected ? (
      <DesignGroupForm
        key={`${mode}-${selected.id}`}
        item={selected}
        mode={mode}
        busy={updateSettings.isPending}
        onCancel={() => setSelected(null)}
        onSave={handleSave}
      />
    ) : (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
          <p className="max-w-sm text-sm text-muted-foreground">
            Select a design group to edit it here, or add a new one.
          </p>
        </CardContent>
      </Card>
    );

  const master = (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 bg-background/95 py-2 backdrop-blur">
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
          <Button type="button" size="sm" onClick={() => setSelected("new")}>
            <IconPlus className="mr-1.5 size-4" />
            New design group
          </Button>
        </div>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No {mode} design groups yet. Design groups bundle private styling that applies to
              every {mode === "row" ? "row" : "choice"} listed in their members.
            </p>
            <Button type="button" onClick={() => setSelected("new")}>
              <IconPlus className="mr-1.5 size-4" />
              New design group
            </Button>
          </CardContent>
        </Card>
      ) : (
        <PaginatedList
          items={groups}
          getItemKey={(group) => group.id}
          pageSize={25}
          renderItem={(group) => {
            const memberCount = group.elements?.length ?? 0;
            return (
              <Card
                key={group.id}
                className={cn(
                  "cursor-pointer transition-colors",
                  selected !== null &&
                    selected !== "new" &&
                    selected.id === group.id &&
                    "border-primary bg-primary/5",
                )}
                onClick={() => setSelected(group)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base">{group.name}</CardTitle>
                      <CardDescription className="mt-1 flex flex-wrap items-center gap-1.5">
                        <CopyId id={group.id} />
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
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteTarget(group);
                        }}
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
                      <Badge variant="secondary">Gated by {group.activatedId}</Badge>
                    ) : (
                      <Badge variant="outline">Always active</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          }}
        />
      )}
    </div>
  );

  return (
    <>
      <MasterDetail master={master} detail={detail} />
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
    </>
  );
}

/* ------------------------------------------------------------------ */

interface DesignGroupFormProps {
  item: DesignGroup | null;
  mode: DesignGroupMode;
  busy?: boolean;
  onCancel: () => void;
  onSave: (form: DesignGroupFormData) => void;
}

function DesignGroupForm({ item, mode, busy = false, onCancel, onSave }: DesignGroupFormProps) {
  const [id, setId] = useSavedField(
    item?.id ?? "",
    item ? [mode === "row" ? "rowDesignGroups" : "objectDesignGroups", item.id, "id"] : null,
  );
  const [name, setName] = useSavedField(
    item?.name ?? "",
    item ? [mode === "row" ? "rowDesignGroups" : "objectDesignGroups", item.id, "name"] : null,
  );
  const [activatedId, setActivatedId] = useSavedField(
    item?.activatedId ?? "",
    item
      ? [mode === "row" ? "rowDesignGroups" : "objectDesignGroups", item.id, "activatedId"]
      : null,
  );
  const [members, setMembers] = useSavedField(
    (item?.elements ?? []).join(", "),
    item
      ? ["$draft", mode === "row" ? "rowDesignGroups" : "objectDesignGroups", item.id, "elements"]
      : null,
  );
  const isEdit = Boolean(item);

  function handleSave() {
    onSave({ id, name, activatedId, members });
  }

  return (
    <EditorPane
      title={isEdit ? "Edit design group" : "Add design group"}
      description={`Design groups apply private styling to every ${
        mode === "row" ? "row" : "choice"
      } listed as a member.`}
      busy={busy}
      saveLabel={isEdit ? "Save" : "Add"}
      canSave={id.trim().length > 0}
      onCancel={onCancel}
      onSave={handleSave}
    >
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
            Members ({mode === "row" ? "row" : "choice"} ids, comma-separated)
          </Label>
          <Input
            id="design-group-members"
            value={members}
            onChange={(event) => setMembers(event.target.value)}
            placeholder={mode === "row" ? "row-a1b2, row-c3d4" : "choice-x9k2, choice-m7n8"}
          />
        </div>
      </div>
    </EditorPane>
  );
}
