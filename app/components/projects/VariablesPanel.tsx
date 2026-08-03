import { useState } from "react";
import { toast } from "sonner";
import { IconPlus, IconTrash } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useUpdateProjectSettings, type ProjectDetail } from "@/hooks/use-projects";
import type { Variable } from "@shared/types";
import { createDefaultVariable } from "@shared/cyoa";

import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { CopyId } from "./CopyId";
import { EditorPane } from "./EditorPane";
import { MasterDetail } from "./MasterDetail";
import { PaginatedList } from "./PaginatedList";

interface VariablesPanelProps {
  project: ProjectDetail;
}

interface VariableFormValues {
  id: string;
  isTrue: boolean;
}

export function VariablesPanel({ project }: VariablesPanelProps) {
  const projectId = project.id;
  const variables = project.app.variables ?? [];

  const updateSettings = useUpdateProjectSettings();

  const [selected, setSelected] = useState<Variable | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Variable | null>(null);

  function handleSave(form: VariableFormValues) {
    if (selected === null) return;
    const isNew = selected === "new";
    const next = isNew
      ? [...variables, { ...createDefaultVariable(), ...form }]
      : variables.map((variable) =>
          variable.id === selected.id ? { ...variable, ...form } : variable,
        );
    updateSettings.mutate(
      { projectId, patch: { variables: next } },
      {
        onSuccess: () => {
          toast.success(isNew ? "Variable added" : "Variable updated");
          setSelected(null);
        },
        onError: (err) =>
          toast.error(
            err instanceof Error
              ? err.message
              : isNew
                ? "Failed to add variable"
                : "Failed to update variable",
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
          toast.error(err instanceof Error ? err.message : "Failed to delete variable");
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
                {variables.length} variable
                {variables.length === 1 ? "" : "s"} — boolean flags the story can read
              </p>
              <Button type="button" size="sm" onClick={() => setSelected("new")}>
                <IconPlus className="mr-1.5 size-4" />
                New variable
              </Button>
            </div>

            {variables.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    No variables yet. Variables are true/false flags (e.g. tookTheSword) that
                    requirements and conditions can check.
                  </p>
                  <Button type="button" onClick={() => setSelected("new")}>
                    <IconPlus className="mr-1.5 size-4" />
                    New variable
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <PaginatedList
                items={variables}
                getItemKey={(variable) => variable.id}
                pageSize={25}
                renderItem={(variable) => (
                  <Card
                    key={variable.id}
                    className={cn(
                      "cursor-pointer transition-colors",
                      selected === variable && "border-primary bg-primary/5",
                    )}
                    onClick={() => setSelected(variable)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <CopyId id={variable.id ?? ""} />
                            <Badge variant={variable.isTrue ? "default" : "outline"}>
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
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteTarget(variable);
                            }}
                            aria-label={`Delete ${variable.id}`}
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
          selected === "new" ? (
            <VariableForm
              key="new"
              variable={null}
              busy={updateSettings.isPending}
              onCancel={() => setSelected(null)}
              onSave={handleSave}
            />
          ) : selected ? (
            <VariableForm
              key={selected.id}
              variable={selected}
              busy={updateSettings.isPending}
              onCancel={() => setSelected(null)}
              onSave={handleSave}
            />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
                <p className="max-w-sm text-sm text-muted-foreground">
                  Select a variable to edit it here. Variables are true/false flags that
                  requirements and conditions can check.
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
        title={`Delete variable "${deleteTarget?.id || "Untitled"}"?`}
        description="Requirements and conditions that reference this variable will treat it as never set until it is recreated."
        busy={updateSettings.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */

interface VariableFormProps {
  variable: Variable | null;
  busy?: boolean;
  onCancel: () => void;
  onSave: (form: VariableFormValues) => void;
}

function VariableForm({ variable, busy = false, onCancel, onSave }: VariableFormProps) {
  const [id, setId] = useState(variable?.id ?? "");
  const [isTrue, setIsTrue] = useState(variable?.isTrue ?? false);
  const isEdit = Boolean(variable);

  function handleSave() {
    onSave({ id, isTrue });
  }

  return (
    <EditorPane
      title={isEdit ? "Edit variable" : "Add variable"}
      description="Variables are boolean flags. Requirements can check them to gate choices, rows, and point bars."
      busy={busy}
      saveLabel={isEdit ? "Save" : "Add"}
      canSave={id.trim().length > 0}
      onCancel={onCancel}
      onSave={handleSave}
    >
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
          <Checkbox checked={isTrue} onCheckedChange={(checked) => setIsTrue(checked === true)} />
          Variable is true
        </label>
      </div>
    </EditorPane>
  );
}
