import { useMemo, useState } from "react";
import { toast } from "sonner";
import { IconListCheck, IconPlus, IconTrash } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  useAddGlobalRequirement,
  useDeleteGlobalRequirement,
  useUpdateGlobalRequirement,
  type ProjectDetail,
} from "@/hooks/use-projects";
import type { GlobalRequirement, Requireds } from "@shared/types";

import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { EditorPane } from "./EditorPane";
import { MasterDetail } from "./MasterDetail";
import { RequirementListEditor } from "./RequirementListEditor";
import { PaginatedList } from "./PaginatedList";

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

  const [selected, setSelected] = useState<GlobalRequirement | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GlobalRequirement | null>(null);

  function handleSave(name: string, requireds: Requireds[]) {
    if (!name.trim()) return;
    if (selected === "new") {
      addRequirement.mutate(
        { projectId, name: name.trim() },
        {
          onSuccess: () => {
            toast.success("Requirement added");
            setSelected(null);
          },
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to add requirement"),
        },
      );
    } else if (selected) {
      updateRequirement.mutate(
        {
          projectId,
          requirementId: selected.id,
          patch: { name: name.trim(), requireds },
        },
        {
          onSuccess: () => {
            toast.success("Requirement updated");
            setSelected(null);
          },
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to update requirement"),
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
          if (selected !== null && selected !== "new" && selected.id === target.id) {
            setSelected(null);
          }
          setDeleteTarget(null);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to delete requirement");
          setDeleteTarget(null);
        },
      },
    );
  }

  const busy = addRequirement.isPending || updateRequirement.isPending;

  const detail =
    selected === "new" ? (
      <RequirementForm
        key="new"
        item={null}
        choices={choiceOptions}
        pointTypes={pointTypeOptions}
        globalRequirements={globalReqOptions}
        busy={busy}
        onCancel={() => setSelected(null)}
        onSave={handleSave}
      />
    ) : selected ? (
      <RequirementForm
        key={selected.id}
        item={selected}
        choices={choiceOptions}
        pointTypes={pointTypeOptions}
        globalRequirements={globalReqOptions}
        busy={busy}
        onCancel={() => setSelected(null)}
        onSave={handleSave}
      />
    ) : (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
          <IconListCheck className="size-6 text-muted-foreground/50" />
          <p className="max-w-sm text-sm text-muted-foreground">
            Select a global requirement to edit it here, or add a new one.
          </p>
        </CardContent>
      </Card>
    );

  const master = (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-background/95 py-2 backdrop-blur">
        <p className="text-sm text-muted-foreground">
          {requirements.length} global requirement
          {requirements.length === 1 ? "" : "s"} — reusable gates for choices
        </p>
        <Button type="button" size="sm" onClick={() => setSelected("new")}>
          <IconPlus className="mr-1.5 size-4" />
          Add requirement
        </Button>
      </div>

      {requirements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No global requirements yet. Global requirements can be attached to choices to gate
              them on other selections or point thresholds.
            </p>
            <Button type="button" onClick={() => setSelected("new")}>
              <IconPlus className="mr-1.5 size-4" />
              Add requirement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <PaginatedList
          items={requirements}
          getItemKey={(requirement) => requirement.id}
          pageSize={25}
          renderItem={(requirement) => (
            <Card
              key={requirement.id}
              className={cn(
                "cursor-pointer transition-colors",
                selected !== null &&
                  selected !== "new" &&
                  selected.id === requirement.id &&
                  "border-primary bg-primary/5",
              )}
              onClick={() => setSelected(requirement)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <IconListCheck className="size-4 shrink-0 text-muted-foreground" />
                      <CardTitle className="text-base">{requirement.name}</CardTitle>
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
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeleteTarget(requirement);
                      }}
                      aria-label={`Delete ${requirement.name}`}
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
  );

  return (
    <>
      <MasterDetail master={master} detail={detail} />
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
    </>
  );
}

/* ------------------------------------------------------------------ */

interface RequirementFormProps {
  item: GlobalRequirement | null;
  choices: { id: string; label: string }[];
  pointTypes: { id: string; name: string }[];
  globalRequirements: { id: string; name: string }[];
  busy?: boolean;
  onCancel: () => void;
  onSave: (name: string, requireds: Requireds[]) => void;
}

function RequirementForm({
  item,
  choices,
  pointTypes,
  globalRequirements,
  busy = false,
  onCancel,
  onSave,
}: RequirementFormProps) {
  const [value, setValue] = useState(item?.name ?? "");
  const [requireds, setRequireds] = useState<Requireds[]>(item?.requireds ?? []);
  const isEdit = Boolean(item);

  function handleSave() {
    onSave(value, requireds);
  }

  return (
    <EditorPane
      title={isEdit ? "Edit requirement" : "Add requirement"}
      description="Give the requirement a descriptive name and add the conditions that gate it. Conditions are AND-combined."
      busy={busy}
      saveLabel={isEdit ? "Save" : "Add"}
      canSave={value.trim().length > 0}
      onCancel={onCancel}
      onSave={handleSave}
    >
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
    </EditorPane>
  );
}
