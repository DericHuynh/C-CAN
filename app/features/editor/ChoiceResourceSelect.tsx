import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { describeContent } from "@shared/content-browser";
import { getImagePreview } from "@shared/image-preview";
import { useEditorProject } from "./EditorProjectContext";
import { ContentBrowserControls, useContentBrowser } from "./ContentBrowser";
import { VirtualList } from "./VirtualList";

type Option = { id: string; label: string };
/** The expensive project index is mounted only while picking a requirement. */
export function ChoiceResourceSelect({
  choices,
  value,
  onChange,
}: {
  choices: Option[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-auto min-h-10 w-full justify-start whitespace-normal text-left"
        onClick={() => setOpen(true)}
      >
        {choices.find((c) => c.id === value)?.label || value || "Select a choice"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Choose a requirement target</DialogTitle>
            <DialogDescription>
              Search titles, prose or IDs. Preview choices and addons, and filter by section, group
              or content.
            </DialogDescription>
          </DialogHeader>
          {open && (
            <ChoiceBrowser
              choices={choices}
              value={value}
              onChange={(id) => {
                onChange(id);
                setOpen(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
function ChoiceBrowser({
  choices,
  value,
  onChange,
}: {
  choices: Option[];
  value: string;
  onChange: (id: string) => void;
}) {
  const project = useEditorProject();
  const entries = useMemo(() => {
    const app = project?.app;
    const entities = new Map<string, { entity: any; parent: string; type: string }>();
    for (const row of app?.rows ?? []) {
      entities.set(row.id, { entity: row, parent: "", type: "Row" });
      for (const choice of row.objects ?? []) {
        entities.set(choice.id, {
          entity: choice,
          parent: row.title || row.id,
          type: choice.isSelectableMultiple ? "Multiple selection" : "Choice",
        });
        for (const addon of choice.addons ?? [])
          entities.set(addon.id, {
            entity: addon,
            parent: `${row.title || row.id} / ${choice.title || choice.id}`,
            type: "Addon",
          });
      }
    }
    const images = new Map((app?.images ?? []).map((img) => [img.id, img]));
    const groups = new Map((app?.groups ?? []).map((group) => [group.id, group.name || group.id]));
    return choices.map((option, index) => {
      const found = entities.get(option.id);
      const entity = found?.entity ?? option;
      const meta = describeContent(entity, index);
      const resource = images.get(entity.image);
      return {
        ...meta,
        id: option.id,
        label: option.label,
        parent: found?.parent ?? "",
        type: found?.type ?? "Reference",
        text: `${meta.text} ${option.label} ${found?.parent ?? ""}`.toLowerCase(),
        tags: [
          ...meta.tags.map((tag) => groups.get(tag) || tag),
          ...(found?.parent ? [found.parent] : []),
        ],
        thumbnail: resource ? getImagePreview(resource)?.data || resource.image : entity.image,
        image: resource?.image || entity.image,
        prose: String(entity.text || entity.titleText || "").replace(/<[^>]*>/g, " "),
        requirements: entity.requireds?.length ?? 0,
      };
    });
  }, [choices, project?.app]);
  const browser = useContentBrowser(entries, describeChoice);
  const [preview, setPreview] = useState<(typeof entries)[number] | null>(null);
  return (
    <>
      <ContentBrowserControls browser={browser} label="choices and addons" />
      <VirtualList
        items={browser.items}
        rowHeight={120}
        resetKey={browser.filter}
        getItemKey={(item) => item.id}
        renderItem={(item) => (
          <div className="flex h-full items-center gap-3 border-b p-2">
            <button
              type="button"
              className="h-full w-24 shrink-0 overflow-hidden rounded bg-muted text-xs"
              aria-label={`Preview ${item.label}`}
              onClick={() => setPreview(item)}
            >
              {item.thumbnail ? (
                <img
                  src={item.thumbnail}
                  alt=""
                  className="h-full w-full object-contain"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                "Preview"
              )}
            </button>
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => setPreview(item)}
            >
              <span className="block truncate font-medium">{item.label}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {item.parent} · {item.type} · {item.id}
              </span>
              <span className="line-clamp-2 text-sm text-muted-foreground">{item.prose}</span>
            </button>
            <Button
              type="button"
              size="sm"
              variant={value === item.id ? "secondary" : "outline"}
              onClick={() => onChange(item.id)}
            >
              Select
            </Button>
          </div>
        )}
      />
      {preview && (
        <section
          className="space-y-2 rounded-md border p-3"
          aria-label="Requirement target preview"
        >
          <div className="flex justify-between gap-2">
            <strong>{preview.label}</strong>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPreview(null)}>
              Close preview
            </Button>
          </div>
          {preview.image && (
            <img
              src={preview.image}
              alt={preview.label}
              className="max-h-44 w-full object-contain"
            />
          )}
          <p className="text-xs text-muted-foreground">
            {preview.parent} · {preview.id} · {preview.requirements} requirements
          </p>
          <p className="max-h-36 overflow-y-auto whitespace-pre-wrap text-sm">
            {preview.prose || "No description"}
          </p>
          <Button type="button" onClick={() => onChange(preview.id)}>
            Select this target
          </Button>
        </section>
      )}
    </>
  );
}
// Stable identity avoids rebuilding the search index on each keystroke.
const describeChoice = (entry: ReturnType<typeof describeContent>) => entry;
