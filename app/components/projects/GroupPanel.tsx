import { useMemo, useState } from "react";
import { toast } from "sonner";
import { IconPlus, IconTrash, IconUsers } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  useAddGroup,
  useDeleteGroup,
  useUpdateGroup,
  type ProjectDetail,
} from "@/hooks/use-projects";
import type { Group, Row } from "@shared/types";

import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { EditorPane } from "./EditorPane";
import { MasterDetail } from "./MasterDetail";
import { countGroupMembers } from "./project-utils";
import { PaginatedList } from "./PaginatedList";

interface GroupPanelProps {
  project: ProjectDetail;
}

export function GroupPanel({ project }: GroupPanelProps) {
  const projectId = project.id;
  const groups = project.app.groups ?? [];

  const addGroup = useAddGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();

  const [selected, setSelected] = useState<Group | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);

  function handleSave(name: string, rowElements: string[], elements: string[]) {
    if (!name.trim()) return;
    if (selected === "new") {
      addGroup.mutate(
        { projectId, name: name.trim(), rowElements, elements },
        {
          onSuccess: () => {
            toast.success("Group added");
            setSelected(null);
          },
          onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add group"),
        },
      );
    } else if (selected) {
      updateGroup.mutate(
        {
          projectId,
          groupId: selected.id,
          patch: { name: name.trim(), rowElements, elements },
        },
        {
          onSuccess: () => {
            toast.success("Group updated");
            setSelected(null);
          },
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to update group"),
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
          toast.error(err instanceof Error ? err.message : "Failed to delete group");
          setDeleteTarget(null);
        },
      },
    );
  }

  return (
    <>
      <MasterDetail
        master={
          <div className="space-y-3">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-background/95 py-2 backdrop-blur">
              <p className="text-sm text-muted-foreground">
                {groups.length} group{groups.length === 1 ? "" : "s"} — groups tag choices so
                requirements and effects can target them together
              </p>
              <Button type="button" size="sm" onClick={() => setSelected("new")}>
                <IconPlus className="mr-1.5 size-4" />
                Add group
              </Button>
            </div>

            {groups.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    No groups yet. Groups tag choices together for requirements and effects (e.g.
                    "selected from group" requirements, discounts, activate/deactivate targets). Use
                    "not selected" requirements for exclusivity.
                  </p>
                  <Button type="button" onClick={() => setSelected("new")}>
                    <IconPlus className="mr-1.5 size-4" />
                    Add group
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <PaginatedList
                items={groups}
                getItemKey={(group) => group.id}
                pageSize={25}
                renderItem={(group) => {
                  const memberCount = countGroupMembers(project.app, group.id);
                  return (
                    <Card
                      key={group.id}
                      className={cn(
                        "cursor-pointer transition-colors",
                        selected === group && "border-primary bg-primary/5",
                      )}
                      onClick={() => setSelected(group)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <CardTitle className="text-base">{group.name}</CardTitle>
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
                    </Card>
                  );
                }}
              />
            )}
          </div>
        }
        detail={
          selected === "new" ? (
            <GroupForm
              key="new"
              group={null}
              rows={project.app.rows ?? []}
              busy={addGroup.isPending || updateGroup.isPending}
              onCancel={() => setSelected(null)}
              onSave={handleSave}
            />
          ) : selected ? (
            <GroupForm
              key={selected.id}
              group={selected}
              rows={project.app.rows ?? []}
              busy={addGroup.isPending || updateGroup.isPending}
              onCancel={() => setSelected(null)}
              onSave={handleSave}
            />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
                <p className="max-w-sm text-sm text-muted-foreground">
                  Select a group to edit it here. Groups tag choices so requirements and effects can
                  target them together.
                </p>
              </CardContent>
            </Card>
          )
        }
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Delete group "${deleteTarget?.name || "Untitled"}"?`}
        description="Choices keep their data but lose their group tagging."
        busy={deleteGroup.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */

interface GroupFormProps {
  group: Group | null;
  rows: Row[];
  busy?: boolean;
  onCancel: () => void;
  onSave: (name: string, rowElements: string[], elements: string[]) => void;
}

function GroupForm({ group, rows, busy = false, onCancel, onSave }: GroupFormProps) {
  const [value, setValue] = useState(group?.name ?? "");
  const [rowElements, setRowElements] = useState<string[]>(group?.rowElements ?? []);
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
    <EditorPane
      title={isEdit ? "Edit group" : "Add group"}
      description="Groups tag choices so requirements and effects can target them together. Adding a row auto-adds its choices; removing a row removes them too."
      busy={busy}
      saveLabel={isEdit ? "Save" : "Add"}
      canSave={value.trim().length > 0}
      onCancel={onCancel}
      onSave={() => onSave(value, rowElements, elements)}
    >
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
            <PaginatedList
              items={rows}
              getItemKey={(row) => row.id}
              pageSize={25}
              gap={4}
              renderItem={(row) => (
                <label
                  key={row.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent/50"
                >
                  <Checkbox
                    checked={rowElements.includes(row.id)}
                    onCheckedChange={() => toggleRow(row.id, row)}
                  />
                  <span className="min-w-0 truncate">{row.title || row.id}</span>
                </label>
              )}
            />
          )}
        </div>

        <div className="space-y-2">
          <Label>Choices in group</Label>
          {choiceOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No choices yet.</p>
          ) : (
            <PaginatedList
              items={choiceOptions}
              getItemKey={(choice) => choice.id}
              pageSize={25}
              gap={4}
              renderItem={(choice) => (
                <label
                  key={choice.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent/50"
                >
                  <Checkbox
                    checked={elements.includes(choice.id)}
                    onCheckedChange={(checked) =>
                      setElements((prev) =>
                        checked ? [...prev, choice.id] : prev.filter((id) => id !== choice.id),
                      )
                    }
                  />
                  <span className="min-w-0 truncate" title={choice.id}>
                    {choice.label}
                  </span>
                </label>
              )}
            />
          )}
        </div>
      </div>
    </EditorPane>
  );
}
