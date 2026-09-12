import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { IconPhoto, IconPlus, IconTrash } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useAddImage,
  useGenerateImagePreviews,
  useDeleteImage,
  useUpdateImage,
  type ProjectDetail,
} from "@/hooks/use-projects";
import { getImagePreview } from "@shared/image-preview";
import type { ImageResource } from "@shared/types";

import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { CopyId } from "./CopyId";
import { EditorPane } from "./EditorPane";
import { MasterDetail } from "./MasterDetail";
import { PaginatedList } from "./PaginatedList";

interface ImagesPanelProps {
  project: ProjectDetail;
}

/**
 * Image resource management. Entities (choices, rows, addons) reference image
 * resources by id — old ICCPlus documents with inline images are translated
 * into resources on import (see aclImportImages).
 */
export function ImagesPanel({ project }: ImagesPanelProps) {
  const projectId = project.id;
  const [params] = useSearchParams();
  const images = project.app.images ?? [];

  // Column count for the responsive grid, measured from the container so the
  // virtualized rows always match the visible layout.
  const gridRef = useRef<HTMLDivElement>(null);
  // Triple column by default; the ResizeObserver tightens to fewer columns on
  // narrow widths.
  const [cols, setCols] = useState(3);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const compute = () => {
      const width = el.clientWidth;
      setCols(Math.max(2, Math.floor((width + 12) / 240)));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [images.length]);

  // Chunk the flat resource list into grid rows of `cols` cards.
  const rowGroups = useMemo(() => {
    const groups: ImageResource[][] = [];
    for (let i = 0; i < images.length; i += cols) {
      groups.push(images.slice(i, i + cols));
    }
    return groups;
  }, [images, cols]);

  const queryClient = useQueryClient();
  const generatePreviews = useGenerateImagePreviews();
  const [previewProgress, setPreviewProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const previewRun = useRef<{ cancelled: boolean } | null>(null);
  useEffect(
    () => () => {
      if (previewRun.current) previewRun.current.cancelled = true;
    },
    [projectId],
  );
  const previewCount = images.filter((image) => getImagePreview(image)).length;
  async function handleGeneratePreviews() {
    if (previewRun.current) return;
    const run = { cancelled: false };
    previewRun.current = run;
    const ids = images
      .filter((image) => image.image && !getImagePreview(image))
      .map((image) => image.id);
    let done = 0;
    let failed = 0;
    setPreviewProgress({ done, total: ids.length });
    try {
      for (let i = 0; i < ids.length && !run.cancelled; i += 8) {
        const batch = ids.slice(i, i + 8);
        const result = await generatePreviews.mutateAsync({ projectId, imageIds: batch });
        done += batch.length;
        failed += result.failed.length;
        if (!run.cancelled) setPreviewProgress({ done, total: ids.length });
      }
      if (!run.cancelled) {
        if (failed)
          toast.warning(
            `Previews ready for ${done - failed} images. ${failed} images could not be processed; check their URLs and retry.`,
          );
        else toast.success(`Viewer previews ready for ${done} images`);
      }
    } catch (error) {
      if (!run.cancelled)
        toast.error(error instanceof Error ? error.message : "Could not generate previews");
    } finally {
      // Refresh once: fetching a multi-megabyte project after every batch is costly.
      await queryClient.invalidateQueries({ queryKey: ["action"] });
      if (previewRun.current === run) {
        previewRun.current = null;
        setPreviewProgress(null);
      }
    }
  }

  const addImage = useAddImage();
  const updateImage = useUpdateImage();
  const deleteImage = useDeleteImage();

  const [selected, setSelected] = useState<ImageResource | "new" | null>(null);
  const linkedImageId = params.get("imageId");
  useEffect(() => {
    if (linkedImageId) setSelected(images.find((image) => image.id === linkedImageId) ?? null);
  }, [linkedImageId]);
  const [deleteTarget, setDeleteTarget] = useState<ImageResource | null>(null);

  function handleSave(
    name: string,
    image: string,
    sourceTooltip: string,
    description: string,
    tags: string,
    source: string,
  ) {
    if (!image.trim()) {
      toast.error("Image URL / data is required");
      return;
    }
    const tagList = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const patch = {
      name: name.trim() || "Image",
      image: image.trim(),
      ...(sourceTooltip.trim() ? { sourceTooltip: sourceTooltip.trim() } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(tagList.length > 0 ? { tags: tagList } : {}),
      ...(source.trim() ? { source: source.trim() } : {}),
    };
    if (selected === "new") {
      addImage.mutate(
        { projectId, ...patch },
        {
          onSuccess: () => {
            toast.success("Image added");
            setSelected(null);
          },
          onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add image"),
        },
      );
    } else if (selected) {
      updateImage.mutate(
        { projectId, imageId: selected.id, patch },
        {
          onSuccess: () => {
            toast.success("Image updated");
            setSelected(null);
          },
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to update image"),
        },
      );
    }
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    deleteImage.mutate(
      { projectId, imageId: target.id },
      {
        onSuccess: () => {
          toast.success("Image deleted");
          if (selected !== null && selected !== "new" && selected.id === target.id) {
            setSelected(null);
          }
          setDeleteTarget(null);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to delete image");
          setDeleteTarget(null);
        },
      },
    );
  }

  const busy = addImage.isPending || updateImage.isPending;

  const detail =
    selected === "new" ? (
      <ImageForm
        key="new"
        item={null}
        busy={busy}
        onCancel={() => setSelected(null)}
        onSave={handleSave}
      />
    ) : selected ? (
      <ImageForm
        key={selected.id}
        item={selected}
        busy={busy}
        onCancel={() => setSelected(null)}
        onSave={handleSave}
      />
    ) : (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
          <IconPhoto className="size-6 text-muted-foreground/50" />
          <p className="max-w-sm text-sm text-muted-foreground">
            Select an image to edit it here, or add a new one.
          </p>
        </CardContent>
      </Card>
    );

  const master = (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-background/95 py-2 backdrop-blur">
        <p className="text-sm text-muted-foreground">
          {images.length} image{images.length === 1 ? "" : "s"} — choices, rows and addons reference
          these by id
        </p>
        <Button type="button" size="sm" onClick={() => setSelected("new")}>
          <IconPlus className="mr-1.5 size-4" />
          Add image
        </Button>
      </div>

      {images.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border p-3">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground" role="status">
            {previewProgress
              ? `Preparing viewer previews: ${previewProgress.done} / ${previewProgress.total}`
              : `${previewCount} / ${images.length} images have instant viewer previews.`}
          </p>
          {previewProgress ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (previewRun.current) previewRun.current.cancelled = true;
              }}
            >
              Stop after this batch
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={!images.some((image) => image.image && !getImagePreview(image))}
              onClick={handleGeneratePreviews}
            >
              Generate previews
            </Button>
          )}
          <p className="w-full text-xs text-muted-foreground">
            Tiny embedded previews appear immediately; full images download as readers scroll. New
            uploads get previews automatically.
          </p>
        </div>
      )}

      {images.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <IconPhoto className="size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No image resources yet. Add images here, then reference them from choices (image
              field), rows and addons. Old ICCPlus documents are translated into resources
              automatically on import.
            </p>
            <Button type="button" onClick={() => setSelected("new")}>
              <IconPlus className="mr-1.5 size-4" />
              Add image
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div ref={gridRef}>
          <PaginatedList
            items={rowGroups}
            getItemKey={(group) => group[0]?.id ?? ""}
            pageSize={9}
            gap={12}
            rangeLabel={(start, end) =>
              `${start * cols + 1}–${Math.min(end * cols, images.length)} of ${images.length}`
            }
            renderItem={(group) => (
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
              >
                {group.map((image) => (
                  <Card
                    key={image.id}
                    className={cn(
                      "cursor-pointer overflow-hidden transition-colors",
                      selected !== null &&
                        selected !== "new" &&
                        selected.id === image.id &&
                        "border-primary bg-primary/5",
                    )}
                    onClick={() => setSelected(image)}
                  >
                    <div className="flex h-28 items-center justify-center bg-muted/40 p-2">
                      {image.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={image.image}
                          alt={image.name || image.id}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <IconPhoto className="size-8 text-muted-foreground/40" />
                      )}
                    </div>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <CardTitle className="truncate text-sm">{image.name}</CardTitle>
                          <div className="mt-1 flex items-center gap-1.5">
                            <CopyId id={image.id} />
                            {image.sourceTooltip ? (
                              <span className="truncate text-xs text-muted-foreground">
                                {image.sourceTooltip}
                              </span>
                            ) : null}
                          </div>
                          {(image.tags?.length ?? 0) > 0 || image.source ? (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {image.tags?.length ? (
                                <span className="text-[10px] text-muted-foreground">
                                  {image.tags.length} tag{image.tags.length === 1 ? "" : "s"}
                                </span>
                              ) : null}
                              {image.source ? (
                                <a
                                  href={image.source}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(event) => event.stopPropagation()}
                                  className="truncate text-[10px] text-primary underline underline-offset-2 hover:text-primary/80"
                                  title={image.source}
                                >
                                  source
                                </a>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-destructive"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteTarget(image);
                            }}
                            aria-label={`Delete ${image.name || image.id}`}
                            title="Delete"
                          >
                            <IconTrash className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          />
        </div>
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
        title={`Delete image "${deleteTarget?.name || deleteTarget?.id || "Untitled"}"?`}
        description="Choices, rows and addons that reference this image will show nothing until re-pointed at another image."
        busy={deleteImage.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}

function ImageForm({
  item,
  busy,
  onCancel,
  onSave,
}: {
  item: ImageResource | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (
    name: string,
    image: string,
    sourceTooltip: string,
    description: string,
    tags: string,
    source: string,
  ) => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [value, setValue] = useState(item?.image ?? "");
  const [sourceTooltip, setSourceTooltip] = useState(item?.sourceTooltip ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [tags, setTags] = useState(item?.tags?.join(", ") ?? "");
  const [source, setSource] = useState(item?.source ?? "");
  const isEdit = Boolean(item);

  useEffect(() => {
    setName(item?.name ?? "");
    setValue(item?.image ?? "");
    setSourceTooltip(item?.sourceTooltip ?? "");
    setDescription(item?.description ?? "");
    setTags(item?.tags?.join(", ") ?? "");
    setSource(item?.source ?? "");
  }, [item]);

  function handleSave() {
    onSave(name, value, sourceTooltip, description, tags, source);
  }

  return (
    <EditorPane
      title={isEdit ? "Edit image" : "Add image"}
      description="Paste a remote URL or an inline data URL. Entities reference the resource by id (shown under the thumbnail)."
      busy={busy}
      saveLabel={isEdit ? "Save" : "Add"}
      onCancel={onCancel}
      onSave={handleSave}
    >
      <div className="space-y-3">
        {value ? (
          <div className="flex h-32 items-center justify-center rounded-md border bg-muted/40 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Preview" className="max-h-full max-w-full object-contain" />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="image-name">Name</Label>
          <Input
            id="image-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Image name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="image-url">Image URL or data</Label>
          <Input
            id="image-url"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="https://… or data:image/webp;base64,…"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="image-tooltip">Source tooltip (optional)</Label>
          <Textarea
            id="image-tooltip"
            value={sourceTooltip}
            onChange={(event) => setSourceTooltip(event.target.value)}
            placeholder="Short attribution, e.g. 'e621 #123456'"
            rows={2}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="image-description">Description (optional)</Label>
          <Textarea
            id="image-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Original post description / notes"
            rows={3}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="image-tags">Tags (optional, comma-separated)</Label>
          <Input
            id="image-tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="canine, rating:safe, forest"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="image-source">Source URL (optional)</Label>
          <Input
            id="image-source"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="https://e621.net/posts/… or artist page"
          />
        </div>
      </div>
    </EditorPane>
  );
}
