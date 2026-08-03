import { useMemo, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  IconArrowDown,
  IconArrowUp,
  IconMusic,
  IconPlayerPlay,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useUpdateProjectSettings, type ProjectDetail } from "@/hooks/use-projects";
import type { Requireds, SoundEffect } from "@shared/types";

import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { CopyId } from "./CopyId";
import { EditorPane } from "./EditorPane";
import { MasterDetail } from "./MasterDetail";
import { PaginatedList } from "./PaginatedList";
import { RequirementListEditor } from "./RequirementListEditor";

interface SoundEffectsPanelProps {
  project: ProjectDetail;
}

interface SoundEffectForm {
  id: string;
  name: string;
  audio: string;
  volume: number;
  pitch: number;
  isDefault: boolean;
  onSelected: boolean;
  onDeselected: boolean;
  groups: string[];
  requireds: Requireds[];
}

/** Estimate the decoded size of a base64 data URL in KB. */
function dataUrlSizeKb(dataUrl: string): number | null {
  if (!dataUrl) return null;
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const base64 = dataUrl.slice(comma + 1);
  const bytes = Math.floor((base64.length * 3) / 4);
  return Math.round(bytes / 1024);
}

export function SoundEffectsPanel({ project }: SoundEffectsPanelProps) {
  const projectId = project.id;
  const soundEffects = project.app.soundEffects ?? [];

  const updateSettings = useUpdateProjectSettings();

  const [selected, setSelected] = useState<SoundEffect | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SoundEffect | null>(null);

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

  function handleSave(form: SoundEffectForm) {
    if (selected === "new") {
      updateSettings.mutate(
        { projectId, patch: { soundEffects: [...soundEffects, { ...form }] } },
        {
          onSuccess: () => {
            toast.success("Sound effect added");
            setSelected(null);
          },
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to add sound effect"),
        },
      );
    } else if (selected) {
      const next = soundEffects.map((sfx) => (sfx.id === selected.id ? { ...sfx, ...form } : sfx));
      updateSettings.mutate(
        { projectId, patch: { soundEffects: next } },
        {
          onSuccess: () => {
            toast.success("Sound effect updated");
            setSelected(null);
          },
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to update sound effect"),
        },
      );
    }
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const next = soundEffects.filter((sfx) => sfx.id !== target.id);
    updateSettings.mutate(
      { projectId, patch: { soundEffects: next } },
      {
        onSuccess: () => {
          toast.success("Sound effect deleted");
          if (selected !== null && selected !== "new" && selected.id === target.id) {
            setSelected(null);
          }
          setDeleteTarget(null);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to delete sound effect");
          setDeleteTarget(null);
        },
      },
    );
  }

  function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= soundEffects.length) return;
    const next = [...soundEffects];
    [next[index], next[target]] = [next[target], next[index]];
    updateSettings.mutate(
      { projectId, patch: { soundEffects: next } },
      {
        onSuccess: () => toast.success("Sound effect moved"),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to move sound effect"),
      },
    );
  }

  function playSound(sfx: SoundEffect) {
    if (!sfx.audio) {
      toast.error("This sound effect has no audio file yet");
      return;
    }
    try {
      const audio = new Audio(sfx.audio);
      void audio.play().catch(() => toast.error("Could not play audio"));
    } catch {
      toast.error("Could not play audio");
    }
  }

  const detail =
    selected === "new" ? (
      <SoundEffectDialog
        key="new"
        item={null}
        choices={choiceOptions}
        pointTypes={pointTypeOptions}
        globalRequirements={globalReqOptions}
        busy={updateSettings.isPending}
        onCancel={() => setSelected(null)}
        onSave={handleSave}
      />
    ) : selected ? (
      <SoundEffectDialog
        key={selected.id}
        item={selected}
        choices={choiceOptions}
        pointTypes={pointTypeOptions}
        globalRequirements={globalReqOptions}
        busy={updateSettings.isPending}
        onCancel={() => setSelected(null)}
        onSave={handleSave}
      />
    ) : (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
          <IconMusic className="size-6 text-muted-foreground/50" />
          <p className="max-w-sm text-sm text-muted-foreground">
            Select a sound effect to edit it here, or add a new one — no more dialogs.
          </p>
        </CardContent>
      </Card>
    );

  const master = (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-background/95 py-2 backdrop-blur">
        <p className="text-sm text-muted-foreground">
          {soundEffects.length} sound effect
          {soundEffects.length === 1 ? "" : "s"} — played when choices are selected or deselected
        </p>
        <Button type="button" size="sm" onClick={() => setSelected("new")}>
          <IconPlus className="mr-1.5 size-4" />
          Add sound effect
        </Button>
      </div>

      {soundEffects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No sound effects yet. Sound effects play on choice selection (and deselection) when
              they are marked as default.
            </p>
            <Button type="button" onClick={() => setSelected("new")}>
              <IconPlus className="mr-1.5 size-4" />
              Add sound effect
            </Button>
          </CardContent>
        </Card>
      ) : (
        <PaginatedList
          items={soundEffects}
          getItemKey={(sfx) => sfx.id}
          pageSize={25}
          renderItem={(sfx, index) => {
            const groupCount = sfx.groups?.length ?? 0;
            const requiredCount = sfx.requireds?.length ?? 0;
            return (
              <Card
                key={sfx.id}
                className={cn(
                  "cursor-pointer transition-colors",
                  selected !== null &&
                    selected !== "new" &&
                    selected.id === sfx.id &&
                    "border-primary bg-primary/5",
                )}
                onClick={() => setSelected(sfx)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <IconMusic className="size-4 shrink-0 text-muted-foreground" />
                        <CardTitle className="font-mono text-base">{sfx.name || sfx.id}</CardTitle>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {sfx.name ? <CopyId id={sfx.id} /> : null}
                        {sfx.isDefault ? (
                          <Badge>Default</Badge>
                        ) : (
                          <Badge variant="outline">Not default</Badge>
                        )}
                        {sfx.onSelected ? <Badge variant="secondary">On select</Badge> : null}
                        {sfx.onDeselected ? <Badge variant="secondary">On deselect</Badge> : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleMove(index, -1);
                        }}
                        disabled={index === 0}
                        aria-label={`Move ${sfx.name || sfx.id} up`}
                        title="Move up"
                      >
                        <IconArrowUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleMove(index, 1);
                        }}
                        disabled={index === soundEffects.length - 1}
                        aria-label={`Move ${sfx.name || sfx.id} down`}
                        title="Move down"
                      >
                        <IconArrowDown className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground"
                        onClick={(event) => {
                          event.stopPropagation();
                          playSound(sfx);
                        }}
                        disabled={!sfx.audio}
                        aria-label={`Play ${sfx.name || sfx.id}`}
                        title="Play test"
                      >
                        <IconPlayerPlay className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteTarget(sfx);
                        }}
                        aria-label={`Delete ${sfx.name || sfx.id}`}
                        title="Delete"
                      >
                        <IconTrash className="size-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="secondary">Volume {sfx.volume ?? 1}</Badge>
                    <Badge variant="secondary">Pitch {sfx.pitch ?? 0}</Badge>
                    <Badge variant="secondary">
                      {groupCount} group{groupCount === 1 ? "" : "s"}
                    </Badge>
                    <Badge variant="secondary">
                      {requiredCount} requirement
                      {requiredCount === 1 ? "" : "s"}
                    </Badge>
                    {sfx.audio ? (
                      <Badge variant="outline">{dataUrlSizeKb(sfx.audio) ?? "?"} KB</Badge>
                    ) : (
                      <Badge variant="outline">No audio</Badge>
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
        title={`Delete sound effect "${deleteTarget?.name || deleteTarget?.id || "Untitled"}"?`}
        description="Choices that reference this sound effect will play no audio until it is recreated."
        busy={updateSettings.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */

interface SoundEffectDialogProps {
  item: SoundEffect | null;
  choices: { id: string; label: string }[];
  pointTypes: { id: string; name: string }[];
  globalRequirements: { id: string; name: string }[];
  busy?: boolean;
  onCancel: () => void;
  onSave: (form: SoundEffectForm) => void;
}

function SoundEffectDialog({
  item,
  choices,
  pointTypes,
  globalRequirements,
  busy = false,
  onCancel,
  onSave,
}: SoundEffectDialogProps) {
  const isEdit = Boolean(item);
  const [id, setId] = useState(item?.id ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [audio, setAudio] = useState(item?.audio ?? "");
  const [volume, setVolume] = useState(
    item?.volume != null ? String(item.volume) : "1",
  );
  const [pitch, setPitch] = useState(item?.pitch != null ? String(item.pitch) : "0");
  const [isDefault, setIsDefault] = useState(item?.isDefault ?? false);
  const [onSelected, setOnSelected] = useState(item?.onSelected ?? false);
  const [onDeselected, setOnDeselected] = useState(item?.onDeselected ?? false);
  const [groups, setGroups] = useState((item?.groups ?? []).join(", "));
  const [requireds, setRequireds] = useState<Requireds[]>(item?.requireds ?? []);

  const audioSizeKb = dataUrlSizeKb(audio);

  function handleAudioFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setAudio(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function handleSave() {
    onSave({
      id,
      name,
      audio,
      volume: Number(volume) || 0,
      pitch: Number(pitch) || 0,
      isDefault,
      onSelected,
      onDeselected,
      groups: groups
        .split(",")
        .map((group) => group.trim())
        .filter(Boolean),
      requireds,
    });
  }

  return (
    <EditorPane
      title={isEdit ? "Edit sound effect" : "Add sound effect"}
      description="Sound effects play when choices are selected or deselected. Mark one as default to play it whenever a matching choice changes."
      busy={busy}
      saveLabel={isEdit ? "Save" : "Add"}
      canSave={id.trim().length > 0}
      onCancel={onCancel}
      onSave={handleSave}
    >
      <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sfx-id">Id</Label>
              <Input
                id="sfx-id"
                value={id}
                onChange={(event) => setId(event.target.value)}
                placeholder="e.g. sfx-click"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sfx-name">Name</Label>
              <Input
                id="sfx-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Click pop"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sfx-audio">Audio file</Label>
            <Input id="sfx-audio" type="file" accept="audio/*" onChange={handleAudioFile} />
            {audioSizeKb !== null ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={audioSizeKb > 100 ? "destructive" : "secondary"}>
                  {audioSizeKb} KB
                </Badge>
                {audioSizeKb > 100 ? (
                  <p className="text-xs text-destructive">
                    Large audio files bloat the project and can slow the viewer. Prefer a short clip
                    under 100 KB.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Stored inline in the project as a data URL.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No audio loaded yet. Pick a file above to embed it.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sfx-volume">Volume (0–1)</Label>
              <Input
                id="sfx-volume"
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(event) => setVolume(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sfx-pitch">Pitch (semitones, −12..12)</Label>
              <Input
                id="sfx-pitch"
                type="number"
                min={-12}
                max={12}
                value={pitch}
                onChange={(event) => setPitch(event.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label
              htmlFor="sfx-is-default"
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox
                id="sfx-is-default"
                checked={isDefault}
                onCheckedChange={(checked) => setIsDefault(checked === true)}
              />
              Default sound
            </label>
            <label
              htmlFor="sfx-on-selected"
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox
                id="sfx-on-selected"
                checked={onSelected}
                onCheckedChange={(checked) => setOnSelected(checked === true)}
              />
              Play on select
            </label>
            <label
              htmlFor="sfx-on-deselected"
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox
                id="sfx-on-deselected"
                checked={onDeselected}
                onCheckedChange={(checked) => setOnDeselected(checked === true)}
              />
              Play on deselect
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sfx-groups">
              Groups
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                comma-separated group ids
              </span>
            </Label>
            <Input
              id="sfx-groups"
              value={groups}
              onChange={(event) => setGroups(event.target.value)}
              placeholder="e.g. ui, combat"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to play for every group. When set, only choices in one of these groups
              trigger the sound.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Requirements</Label>
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
