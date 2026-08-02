import { useState } from "react";
import { toast } from "sonner";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";

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
import type { Word } from "@shared/types";
import { createDefaultWord } from "@shared/cyoa";

import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";

interface WordsPanelProps {
  project: ProjectDetail;
}

interface WordForm {
  id: string;
  replaceText: string;
}

export function WordsPanel({ project }: WordsPanelProps) {
  const projectId = project.id;
  const words = project.app.words ?? [];

  const updateSettings = useUpdateProjectSettings();

  const [editing, setEditing] = useState<Word | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Word | null>(null);

  function handleAdd() {
    updateSettings.mutate(
      { projectId, patch: { words: [...words, createDefaultWord()] } },
      {
        onSuccess: () => toast.success("Word added"),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to add word"),
      },
    );
  }

  function handleSave(form: WordForm) {
    if (!editing) return;
    const next = words.map((word) =>
      word.id === editing.id ? { ...word, ...form } : word,
    );
    updateSettings.mutate(
      { projectId, patch: { words: next } },
      {
        onSuccess: () => {
          toast.success("Word updated");
          setDialogOpen(false);
        },
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Failed to update word",
          ),
      },
    );
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const next = words.filter((word) => word.id !== target.id);
    updateSettings.mutate(
      { projectId, patch: { words: next } },
      {
        onSuccess: () => {
          toast.success("Word deleted");
          setDeleteTarget(null);
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Failed to delete word",
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
          {words.length} word
          {words.length === 1 ? "" : "s"} — ids replaced in reader text
        </p>
        <Button type="button" size="sm" onClick={handleAdd}>
          <IconPlus className="mr-1.5 size-4" />
          New word
        </Button>
      </div>

      {words.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No words yet. Words swap an id for longer text when the story is
              rendered (e.g. replace "PC" with the reader's character name).
            </p>
            <Button type="button" onClick={handleAdd}>
              <IconPlus className="mr-1.5 size-4" />
              New word
            </Button>
          </CardContent>
        </Card>
      ) : (
        words.map((word) => (
          <Card key={word.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="font-mono text-base">
                    {word.id || "Untitled word"}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {word.replaceText
                      ? `Replaces with: ${word.replaceText}`
                      : "No replacement text set yet."}
                  </CardDescription>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                    onClick={() => {
                      setEditing(word);
                      setDialogOpen(true);
                    }}
                    aria-label={`Edit ${word.id}`}
                    title="Edit"
                  >
                    <IconPencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(word)}
                    aria-label={`Delete ${word.id}`}
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

      <WordDialog
        key={editing?.id ?? "edit-word"}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        word={editing}
        busy={updateSettings.isPending}
        onSave={handleSave}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Delete word "${deleteTarget?.id || "Untitled"}"?`}
        description="Story text that used this id will show the raw id instead of the replacement."
        busy={updateSettings.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface WordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  word: Word | null;
  busy?: boolean;
  onSave: (form: WordForm) => void;
}

function WordDialog({
  open,
  onOpenChange,
  word,
  busy = false,
  onSave,
}: WordDialogProps) {
  const [id, setId] = useState(word?.id ?? "");
  const [replaceText, setReplaceText] = useState(word?.replaceText ?? "");

  function handleSave() {
    onSave({ id, replaceText });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit word</DialogTitle>
          <DialogDescription>
            When the reader sees the id in story text, it is replaced with the
            replacement text.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="word-id">Id</Label>
            <Input
              id="word-id"
              value={id}
              onChange={(event) => setId(event.target.value)}
              placeholder="e.g. PC"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="word-replace">Replacement text</Label>
            <Input
              id="word-replace"
              value={replaceText}
              onChange={(event) => setReplaceText(event.target.value)}
              placeholder="e.g. Alex"
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
