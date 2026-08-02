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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useUpdateProjectSettings,
  type ProjectDetail,
} from "@/hooks/use-projects";
import type { Category } from "@shared/types";
import { createDefaultCategory } from "@shared/cyoa";

import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";

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

interface CategoryForm {
  name: string;
  type: string;
}

export function CategoriesPanel({ project }: CategoriesPanelProps) {
  const projectId = project.id;
  const categories = project.app.categories ?? [];

  const updateSettings = useUpdateProjectSettings();

  const [editing, setEditing] = useState<Category | null>(null);
  const [pendingType, setPendingType] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const groupsByType = new Map<string, Category[]>();
  for (const category of categories) {
    const list = groupsByType.get(category.type) ?? [];
    list.push(category);
    groupsByType.set(category.type, list);
  }
  const typeOptions = Array.from(
    new Set([...DEFAULT_CATEGORY_TYPES, ...groupsByType.keys()]),
  );

  function openAddDialog(type?: string) {
    setEditing(null);
    setPendingType(type ?? null);
    setDialogOpen(true);
  }

  function handleSave(form: CategoryForm) {
    if (editing) {
      const next = categories.map((category) =>
        category.idx === editing.idx && category.type === editing.type
          ? { ...category, name: form.name, type: form.type }
          : category,
      );
      updateSettings.mutate(
        { projectId, patch: { categories: next } },
        {
          onSuccess: () => {
            toast.success("Category updated");
            setDialogOpen(false);
          },
          onError: (err) =>
            toast.error(
              err instanceof Error ? err.message : "Failed to update category",
            ),
        },
      );
    } else {
      const sameType = categories.filter(
        (category) => category.type === form.type,
      );
      const idx =
        sameType.reduce((max, category) => Math.max(max, category.idx), -1) + 1;
      const next = [
        ...categories,
        { ...createDefaultCategory(form.name), idx, type: form.type },
      ];
      updateSettings.mutate(
        { projectId, patch: { categories: next } },
        {
          onSuccess: () => {
            toast.success("Category added");
            setDialogOpen(false);
          },
          onError: (err) =>
            toast.error(
              err instanceof Error ? err.message : "Failed to add category",
            ),
        },
      );
    }
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const next = categories.filter(
      (category) =>
        !(category.idx === target.idx && category.type === target.type),
    );
    updateSettings.mutate(
      { projectId, patch: { categories: next } },
      {
        onSuccess: () => {
          toast.success("Category deleted");
          setDeleteTarget(null);
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Failed to delete category",
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
          {categories.length} categor
          {categories.length === 1 ? "y" : "ies"} — group items into named
          slots per type
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
              No categories yet. Categories let you filter point types,
              variables, words, groups, design groups, and more into named
              slots.
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
                <span className="text-muted-foreground">
                  ({typeCategories.length})
                </span>
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => openAddDialog(type)}
              >
                <IconPlus className="mr-1.5 size-4" />
                Add
              </Button>
            </div>
            {typeCategories.map((category) => (
              <Card key={`${category.type}-${category.idx}-${category.name}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">
                          {category.name || "Untitled category"}
                        </CardTitle>
                        <Badge variant="secondary">Slot {category.idx}</Badge>
                      </div>
                      <CardDescription className="mt-1">
                        Type: {category.type}
                      </CardDescription>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground"
                        onClick={() => {
                          setEditing(category);
                          setDialogOpen(true);
                        }}
                        aria-label={`Edit ${category.name}`}
                        title="Edit"
                      >
                        <IconPencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(category)}
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

      <CategoryDialog
        key={
          editing
            ? `edit-${editing.type}-${editing.idx}`
            : `new-${pendingType ?? "default"}`
        }
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditing(null);
            setPendingType(null);
          }
        }}
        category={editing}
        defaultType={pendingType ?? undefined}
        typeOptions={typeOptions}
        busy={updateSettings.isPending}
        onSave={handleSave}
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
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
  defaultType?: string;
  typeOptions: string[];
  busy?: boolean;
  onSave: (form: CategoryForm) => void;
}

function CategoryDialog({
  open,
  onOpenChange,
  category,
  defaultType,
  typeOptions,
  busy = false,
  onSave,
}: CategoryDialogProps) {
  const isEdit = Boolean(category);
  const [name, setName] = useState(category?.name ?? "");
  const [type, setType] = useState(category?.type ?? defaultType ?? typeOptions[0] ?? "");

  function handleSave() {
    onSave({ name, type });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit category" : "New category"}
          </DialogTitle>
          <DialogDescription>
            Categories group items of the same type into named slots so the
            editor can filter by them.
          </DialogDescription>
        </DialogHeader>
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
            disabled={busy || name.trim().length === 0 || type.length === 0}
          >
            {isEdit ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
