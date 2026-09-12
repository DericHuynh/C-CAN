import { TagInput } from "@/features/tags/TagInput";
import { useState } from "react";
import type { ImageResource } from "@shared/types";
import { useActionMutation } from "@agent-native/core/client/hooks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ContentBrowserControls, useContentBrowser } from "./ContentBrowser";
import { VirtualList } from "./VirtualList";
import { useEditorProject } from "./EditorProjectContext";
import { getImagePreview } from "@shared/image-preview";

export function ImageResourceSelect({
  images,
  value,
  onChange,
  id,
  label,
  placeholder,
  target,
}: {
  images: ImageResource[];
  value: string;
  onChange: (value: string) => void;
  id?: string;
  label?: string;
  placeholder?: string;
  searchable?: boolean;
  target?: { kind: "row" | "choice" | "addon"; id: string; expectedImage?: string };
}) {
  const project = useEditorProject();
  const create = useActionMutation("add-image");
  const [open, setOpen] = useState(false),
    [creating, setCreating] = useState(false),
    [name, setName] = useState(""),
    [url, setUrl] = useState(""),
    [tags, setTags] = useState<string[]>([]),
    [zoom, setZoom] = useState<ImageResource | null>(null),
    [created, setCreated] = useState<ImageResource | null>(null);
  const selected =
    images.find((img) => img.id === value) ?? (created?.id === value ? created : null);
  async function save() {
    if (!project) return;
    try {
      const result = await create.mutateAsync({
        projectId: project.id,
        name: name.trim() || undefined,
        image: url.trim(),
        tags,
        target: target
          ? { ...target, expectedImage: created?.id ?? target.expectedImage }
          : undefined,
      });
      setCreated(result.image);
      onChange(result.image.id);
      setOpen(false);
      setCreating(false);
      setName("");
      setUrl("");
      setTags([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create image");
    }
  }
  return (
    <div className="min-w-0 space-y-2">
      {label && <Label htmlFor={id}>{label}</Label>}
      <Button
        id={id}
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-auto min-h-10 w-full justify-start gap-2 whitespace-normal text-left"
      >
        {selected?.image && (
          <img
            src={getImagePreview(selected)?.data || selected.image}
            alt=""
            className="size-10 shrink-0 rounded object-contain"
            loading="lazy"
          />
        )}
        <span className="min-w-0 truncate">
          {selected?.name ||
            selected?.id ||
            (value && value !== "__custom__" ? "Custom image" : placeholder || "Select an image")}
        </span>
      </Button>
      {value && (
        <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>
          Clear image
        </Button>
      )}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setZoom(null);
        }}
      >
        <DialogContent
          className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl"
          onEscapeKeyDown={(event) => {
            if (zoom) {
              event.preventDefault();
              setZoom(null);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {zoom
                ? zoom.name || "Image preview"
                : creating
                  ? "Create and select image"
                  : "Choose an image"}
            </DialogTitle>
            <DialogDescription>
              {creating
                ? "A name is optional. Add a URL or upload a file; the new image will be selected for this field."
                : "Preview images, filter by tags and dates, or create a new image."}
            </DialogDescription>
          </DialogHeader>
          {zoom && (
            <div className="space-y-3">
              <img
                src={zoom.image}
                alt={zoom.name || "Preview"}
                className="max-h-[60dvh] w-full object-contain"
              />
              <p className="text-sm text-muted-foreground">
                {zoom.tags?.join(", ") || zoom.sourceTooltip}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    onChange(zoom.id);
                    setOpen(false);
                    setZoom(null);
                  }}
                >
                  Select this image
                </Button>
                <Button type="button" variant="outline" onClick={() => setZoom(null)}>
                  Back to images
                </Button>
              </div>
            </div>
          )}
          <div hidden={Boolean(zoom)} className="space-y-3">
            {creating ? (
              <div className="space-y-3">
                <Label>
                  Image name (optional)
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Leave blank for an anonymous image"
                  />
                </Label>
                <Label>
                  Image URL
                  <Input
                    value={url.startsWith("data:") ? "" : url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://…"
                  />
                </Label>
                <Label>
                  Upload image
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 10 * 1024 * 1024) {
                        toast.error("Choose an image under 10 MB.");
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => setUrl(String(reader.result));
                      reader.onerror = () => toast.error("Could not read image");
                      reader.readAsDataURL(file);
                    }}
                  />
                </Label>
                <TagInput value={tags} onChange={setTags} />
                {url && (
                  <img
                    src={url}
                    alt="New image preview"
                    className="max-h-52 w-full object-contain"
                  />
                )}
                <div className="flex gap-2">
                  <Button type="button" disabled={!url.trim() || create.isPending} onClick={save}>
                    {create.isPending ? "Creating…" : "Create and select"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={create.isPending}
                    onClick={() => setCreating(false)}
                  >
                    Back to images
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {open && (
                  <ImageBrowser
                    images={images}
                    value={value}
                    onPreview={setZoom}
                    onChange={(id) => {
                      onChange(id);
                      setOpen(false);
                    }}
                  />
                )}
                <div className="flex flex-wrap gap-2">
                  {project && (
                    <Button type="button" onClick={() => setCreating(true)}>
                      Create image…
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      onChange("");
                      setOpen(false);
                    }}
                  >
                    No image
                  </Button>
                </div>
                <Label>
                  Custom image URL
                  <Input
                    value={!selected && value !== "__custom__" ? value : ""}
                    placeholder="https://…"
                    onChange={(e) => onChange(e.target.value)}
                  />
                </Label>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ImageBrowser({
  images,
  value,
  onPreview,
  onChange,
}: {
  images: ImageResource[];
  value: string;
  onPreview: (image: ImageResource) => void;
  onChange: (id: string) => void;
}) {
  const browser = useContentBrowser(images);
  return (
    <>
      {" "}
      <ContentBrowserControls browser={browser} label="images" />
      <VirtualList
        items={browser.items}
        resetKey={browser.filter}
        rowHeight={104}
        getItemKey={(img) => img.id}
        renderItem={(img) => (
          <div className="flex h-full items-center gap-3 border-b p-2">
            <button
              type="button"
              className="h-full w-28 shrink-0 rounded bg-muted"
              aria-label={`Preview ${img.name || img.id}`}
              onClick={() => onPreview(img)}
            >
              <img
                src={getImagePreview(img)?.data || img.image}
                alt={img.name || img.id}
                className="h-full w-full object-contain"
                loading="lazy"
                decoding="async"
              />
            </button>
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => {
                onChange(img.id);
              }}
            >
              <span className="block truncate font-medium">{img.name || img.id}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {img.tags?.join(", ") || "No tags"}
              </span>
              <span className="text-xs text-muted-foreground">
                {img.createdAt ? new Date(img.createdAt).toLocaleDateString() : "Date unknown"}
              </span>
            </button>
            <Button
              type="button"
              size="sm"
              variant={value === img.id ? "secondary" : "outline"}
              onClick={() => {
                onChange(img.id);
              }}
            >
              Select
            </Button>
          </div>
        )}
      />
    </>
  );
}
