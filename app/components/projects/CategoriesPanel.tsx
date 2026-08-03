import { useState } from "react";
import { toast } from "sonner";
import { IconPlus, IconTrash } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useUpdateProjectSettings, type ProjectDetail } from "@/hooks/use-projects";
import type { Category } from "@shared/types";
import { createDefaultCategory } from "@shared/cyoa";

import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { EditorPane } from "./EditorPane";
import { MasterDetail } from "./MasterDetail";

/** Types offered when creating a category; existing types are added too. */
const DEFAULT_CATEGORY_TYPES = [
  "pointType",
  "variable",
  "word",
  "group",
  "designGroup",
  "globalRequirement",
  "soundEffect",
];

const TYPE_LABELS: Record<string, string> = {
  pointType: "Point Types",
  variable: "Variables",
  word: "Words",
  group: "Groups",
  designGroup: "Design Groups",
  globalRequirement: "Global Requirements",
  soundEffect: "Sound Effects",
};

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
}

interface CategoriesPanelProps {
  project: ProjectDetail;
}

interface CategoryFormValues {
  name: string;
  type: string;
}

export function CategoriesPanel({ project }: CategoriesPanelProps) {
  const projectId = project.id;
  const categories = project.app.categories ?? [];

  const updateSettings = useUpdateProjectSettings();

  const [selected, setSelected] = useState<Category | "new" | null>(null);
  const [pendingType, setPendingType] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const groupsByType = new Map<string, Category[]>();
  for (const category of categories) {
    const list = groupsByType.get(category.type) ?? [];
    list.push(category);
    groupsByType.set(category.type, list);
  }
  const typeOptions = Array.from(new Set([...DEFAULT_CATEGORY_TYPES, ...groupsByType.keys()]));

  function openAddDialog(type?: string) {
    setPendingType(type ?? null);
    setSelected("new");
  }

  function handleSave(form: CategoryFormValues) {
    if (selected === "new") {
      const sameType = categories.filter((category) => category.type === form.type);
      const idx = sameType.reduce((max, category) => Math.max(max, category.idx), -1) + 1;
      const next = [...categories, { ...createDefaultCategory(form.name), idx, type: form.type }];
      updateSettings.mutate(
        { projectId, patch: { categories: next } },
        {
          onSuccess: () => {
            toast.success("Category added");
            setSelected(null);
            setPendingType(null);
          },
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to add category"),
        },
      );
    } else if (selected) {
      const next = categories.map((category) =>
        category.idx === selected.idx && category.type === selected.type
          ? { ...category, name: form.name, type: form.type }
          : category,
      );
      updateSettings.mutate(
        { projectId, patch: { categories: next } },
        {
          onSuccess: () => {
            toast.success("Category updated");
            setSelected(null);
            setPendingType(null);
          },
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to update category"),
        },
      );
    }
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const next = categories.filter(
      (category) => !(category.idx === target.idx && category.type === target.type),
    );
    updateSettings.mutate(
      { projectId, patch: { categories: next } },
      {
        onSuccess: () => {
          toast.success("Category deleted");
          setDeleteTarget(null);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to delete category");
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
                {categories.length} categor
                {categories.length === 1 ? "y" : "ies"} — group items into named slots per type
              </p>
              <Button type="button" size="sm" onClick={() => openAddDialog()}>
                <IconPlus className="mr-1.5 size-4" />
                New category
              </Button>
            </div>

            {categories.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    No categories yet. Categories let you filter point types, variables, words,
                    groups, design groups, and more into named slots.
                  </p>
                  <Button type="button" onClick={() => openAddDialog()}>
                    <IconPlus className="mr-1.5 size-4" />
                    New category
                  </Button>
                </CardContent>
              </Card>
            ) : (
              Array.from(groupsByType.entries()).map(([type, typeCategories]) => (
                <div key={type} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {typeLabel(type)}{" "}
                      <span className="text-muted-foreground">({typeCategories.length})</span>
                    </p>
                    <Button type="button" variant="ghost" size="sm" onClick={() => openAddDialog(type)}>
                      <IconPlus className="mr-1.5 size-4" />
                      Add
                    </Button>
                  </div>
                  {typeCategories.map((category) => (
                    <Card
                      key={`${category.type}-${category.idx}-${category.name}`}
                      className={cn(
                        "cursor-pointer transition-colors",
                        selected === category && "border-primary bg-primary/5",
                      )}
                      onClick={() => setSelected(category)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <CardTitle className="text-base">{category.name}</CardTitle>
                              <Badge variant="secondary">Slot {category.idx}</Badge>
                            </div>
                            <CardDescription className="mt-1">Type: {category.type}</CardDescription>
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-destructive"
                              onClick={(event) => {
                                event.stopPropagation();
                                setDeleteTarget(category);
                              }}
                              aria-label={`Delete ${category.name}`}
                              title="Delete"
                            >
                              <IconTrash className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              ))
            )}
          </div>
        }
        detail={
          selected === "new" ? (
            <CategoryForm
              key={`new-${pendingType ?? "default"}`}
              category={null}
              defaultType={pendingType ?? undefined}
              typeOptions={typeOptions}
              busy={updateSettings.isPending}
              onCancel={() => {
                setSelected(null);
                setPendingType(null);
              }}
              onSave={handleSave}
            />
          ) : selected ? (
            <CategoryForm
              key={`edit-${selected.type}-${selected.idx}`}
              category={selected}
              typeOptions={typeOptions}
              busy={updateSettings.isPending}
              onCancel={() => setSelected(null)}
              onSave={handleSave}
            />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
                <p className="max-w-sm text-sm text-muted-foreground">
                  Select a category to edit it here. Categories group items of the same type into
                  named slots so the editor can filter by them.
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
        title={`Delete category "${deleteTarget?.name || "Untitled"}"?`}
        description="Items assigned to this category keep their data but lose their category slot."
        busy={updateSettings.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */

interface CategoryFormProps {
  category: Category | null;
  defaultType?: string;
  typeOptions: string[];
  busy?: boolean;
  onCancel: () => void;
  onSave: (form: CategoryFormValues) => void;
}

function CategoryForm({
  category,
  defaultType,
  typeOptions,
  busy = false,
  onCancel,
  onSave,
}: CategoryFormProps) {
  const isEdit = Boolean(category);
  const [name, setName] = useState(category?.name ?? "");
  const [type, setType] = useState(category?.type ?? defaultType ?? typeOptions[0] ?? "");

  function handleSave() {
    onSave({ name, type });
  }

  return (
    <EditorPane
      title={isEdit ? "Edit category" : "New category"}
      description="Categories group items of the same type into named slots so the editor can filter by them."
      busy={busy}
      saveLabel={isEdit ? "Save" : "Add"}
      canSave={name.trim().length > 0 && type.length > 0}
      onCancel={onCancel}
      onSave={handleSave}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="category-name">Name</Label>
          <Input
            id="category-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Main story"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category-type">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="category-type" className="w-full">
              <SelectValue placeholder="Select a type" />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {typeLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </EditorPane>
  );
}
