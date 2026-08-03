import { useState } from "react";
import { toast } from "sonner";
import { IconPlus, IconTrash } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useUpdateProjectSettings, type ProjectDetail } from "@/hooks/use-projects";
import type { Word } from "@shared/types";
import { createDefaultWord } from "@shared/cyoa";

import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { CopyId } from "./CopyId";
import { EditorPane } from "./EditorPane";
import { MasterDetail } from "./MasterDetail";
import { PaginatedList } from "./PaginatedList";

interface WordsPanelProps {
  project: ProjectDetail;
}

interface WordFormValues {
  id: string;
  replaceText: string;
}

export function WordsPanel({ project }: WordsPanelProps) {
  const projectId = project.id;
  const words = project.app.words ?? [];

  const updateSettings = useUpdateProjectSettings();

  const [selected, setSelected] = useState<Word | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Word | null>(null);

  function handleSave(form: WordFormValues) {
    if (selected === null) return;
    const isNew = selected === "new";
    const next = isNew
      ? [...words, { ...createDefaultWord(), ...form }]
      : words.map((word) => (word.id === selected.id ? { ...word, ...form } : word));
    updateSettings.mutate(
      { projectId, patch: { words: next } },
      {
        onSuccess: () => {
          toast.success(isNew ? "Word added" : "Word updated");
          setSelected(null);
        },
        onError: (err) =>
          toast.error(
            err instanceof Error
              ? err.message
              : isNew
                ? "Failed to add word"
                : "Failed to update word",
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
          toast.error(err instanceof Error ? err.message : "Failed to delete word");
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
                {words.length} word
                {words.length === 1 ? "" : "s"} — ids replaced in reader text
              </p>
              <Button type="button" size="sm" onClick={() => setSelected("new")}>
                <IconPlus className="mr-1.5 size-4" />
                New word
              </Button>
            </div>

            {words.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    No words yet. Words swap an id for longer text when the story is rendered (e.g.
                    replace "PC" with the reader's character name).
                  </p>
                  <Button type="button" onClick={() => setSelected("new")}>
                    <IconPlus className="mr-1.5 size-4" />
                    New word
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <PaginatedList
                items={words}
                getItemKey={(word) => word.id}
                pageSize={25}
                renderItem={(word) => (
                  <Card
                    key={word.id}
                    className={cn(
                      "cursor-pointer transition-colors",
                      selected === word && "border-primary bg-primary/5",
                    )}
                    onClick={() => setSelected(word)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <CopyId id={word.id ?? ""} />
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
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteTarget(word);
                            }}
                            aria-label={`Delete ${word.id}`}
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
            <WordForm
              key="new"
              word={null}
              busy={updateSettings.isPending}
              onCancel={() => setSelected(null)}
              onSave={handleSave}
            />
          ) : selected ? (
            <WordForm
              key={selected.id}
              word={selected}
              busy={updateSettings.isPending}
              onCancel={() => setSelected(null)}
              onSave={handleSave}
            />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
                <p className="max-w-sm text-sm text-muted-foreground">
                  Select a word to edit it here. Words swap an id for longer text when the story is
                  rendered.
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
        title={`Delete word "${deleteTarget?.id || "Untitled"}"?`}
        description="Story text that used this id will show the raw id instead of the replacement."
        busy={updateSettings.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */

interface WordFormProps {
  word: Word | null;
  busy?: boolean;
  onCancel: () => void;
  onSave: (form: WordFormValues) => void;
}

function WordForm({ word, busy = false, onCancel, onSave }: WordFormProps) {
  const [id, setId] = useState(word?.id ?? "");
  const [replaceText, setReplaceText] = useState(word?.replaceText ?? "");
  const isEdit = Boolean(word);

  function handleSave() {
    onSave({ id, replaceText });
  }

  return (
    <EditorPane
      title={isEdit ? "Edit word" : "Add word"}
      description="When the reader sees the id in story text, it is replaced with the replacement text."
      busy={busy}
      saveLabel={isEdit ? "Save" : "Add"}
      canSave={id.trim().length > 0}
      onCancel={onCancel}
      onSave={handleSave}
    >
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
    </EditorPane>
  );
}
