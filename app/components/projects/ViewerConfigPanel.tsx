import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateProjectSettings, type ProjectDetail } from "@/hooks/use-projects";
import { defaultViewerConfig } from "@shared/cyoa";
import type { ViewerConfig } from "@shared/types";

interface ViewerConfigPanelProps {
  project: ProjectDetail;
}

/**
 * Raw `loadingType` values the original viewer understands. The creator
 * surfaces them as human-readable labels; only these ids are written back.
 */
const LOADING_TYPES: { value: string; label: string }[] = [
  { value: "ind1", label: "Type 1 (Loaded Size)" },
  { value: "ind2", label: "Type 2 (Loading Progress)" },
  { value: "ind3", label: "Type 3 (Loaded / Total Size)" },
];

/**
 * `<input type="color">` only accepts 6-digit hex. Stored values are
 * sometimes 8-digit "#RRGGBBAA" (the styling palette style), so normalize
 * those down to 6 digits and fall back for anything else.
 */
function normalizeHexColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const hex = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex}`;
  if (/^[0-9a-fA-F]{8}$/.test(hex)) return `#${hex.slice(0, 6)}`;
  return fallback;
}

/**
 * Viewer presentation settings: the page title/favicon and the loading
 * indicator shown while the viewer boots. Saves the full `viewerConfig`
 * object; `update-project-settings` deep-merges it, so existing values are
 * preserved server-side.
 */
export function ViewerConfigPanel({ project }: ViewerConfigPanelProps) {
  const app = project.app;
  const updateSettings = useUpdateProjectSettings();

  // Older documents may predate individual fields; fill gaps from the
  // canonical defaults so the whole object is always round-trippable.
  const initial = { ...defaultViewerConfig, ...(app.viewerConfig ?? {}) };

  const [title, setTitle] = useState(initial.title);
  const [favicon, setFavicon] = useState(initial.favicon);
  const [loadingType, setLoadingType] = useState(initial.loadingType);
  const [loadingBgColor, setLoadingBgColor] = useState(
    normalizeHexColor(initial.loadingBgColor, defaultViewerConfig.loadingBgColor),
  );
  const [loadingBgImage, setLoadingBgImage] = useState(initial.loadingBgImage);
  const [loadingCircleColor, setLoadingCircleColor] = useState(
    normalizeHexColor(initial.loadingCircleColor, defaultViewerConfig.loadingCircleColor),
  );
  const [loadingTrackColor, setLoadingTrackColor] = useState(
    normalizeHexColor(initial.loadingTrackColor, defaultViewerConfig.loadingTrackColor),
  );
  const [loadingText, setLoadingText] = useState(initial.loadingText);
  const [loadingTextColor, setLoadingTextColor] = useState(
    normalizeHexColor(initial.loadingTextColor, defaultViewerConfig.loadingTextColor),
  );
  const [loadingTextFont, setLoadingTextFont] = useState(initial.loadingTextFont);
  const [loadingTextShadow, setLoadingTextShadow] = useState(initial.loadingTextShadow);
  const [useSeparateImages, setUseSeparateImages] = useState(initial.useSeparateImages);
  const [useLocalViewer, setUseLocalViewer] = useState(initial.useLocalViewer);

  function handleSave() {
    const nextViewerConfig: ViewerConfig = {
      title,
      favicon,
      loadingType,
      loadingBgColor,
      loadingBgImage,
      loadingCircleColor,
      loadingTrackColor,
      loadingText,
      loadingTextColor,
      loadingTextFont,
      loadingTextShadow,
      useSeparateImages,
      useLocalViewer,
    };
    updateSettings.mutate(
      { projectId: project.id, patch: { viewerConfig: nextViewerConfig } },
      {
        onSuccess: () => toast.success("Viewer config saved"),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to save viewer config"),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Viewer config</CardTitle>
        <CardDescription>
          Title, favicon and loading screen shown to readers on the play page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="viewer-title">Title</Label>
            <Input
              id="viewer-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Untitled CYOA"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="viewer-favicon">Favicon URL</Label>
            <Input
              id="viewer-favicon"
              value={favicon}
              onChange={(event) => setFavicon(event.target.value)}
              placeholder="https://…/favicon.png"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="viewer-loading-type">Loading type</Label>
            <Select value={loadingType} onValueChange={setLoadingType}>
              <SelectTrigger id="viewer-loading-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOADING_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="viewer-loading-bg-image">Loading background image</Label>
            <Input
              id="viewer-loading-bg-image"
              value={loadingBgImage}
              onChange={(event) => setLoadingBgImage(event.target.value)}
              placeholder="https://… or data:image/…"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="viewer-loading-bg-color">Loading background color</Label>
            <div className="flex items-center gap-2">
              <Input
                id="viewer-loading-bg-color"
                type="color"
                className="size-10 w-16 shrink-0 cursor-pointer p-1"
                value={loadingBgColor}
                onChange={(event) => setLoadingBgColor(event.target.value)}
              />
              <span className="font-mono text-xs text-muted-foreground">{loadingBgColor}</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="viewer-loading-circle-color">Loading circle color</Label>
            <div className="flex items-center gap-2">
              <Input
                id="viewer-loading-circle-color"
                type="color"
                className="size-10 w-16 shrink-0 cursor-pointer p-1"
                value={loadingCircleColor}
                onChange={(event) => setLoadingCircleColor(event.target.value)}
              />
              <span className="font-mono text-xs text-muted-foreground">{loadingCircleColor}</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="viewer-loading-track-color">Loading track color</Label>
            <div className="flex items-center gap-2">
              <Input
                id="viewer-loading-track-color"
                type="color"
                className="size-10 w-16 shrink-0 cursor-pointer p-1"
                value={loadingTrackColor}
                onChange={(event) => setLoadingTrackColor(event.target.value)}
              />
              <span className="font-mono text-xs text-muted-foreground">{loadingTrackColor}</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="viewer-loading-text-color">Loading text color</Label>
            <div className="flex items-center gap-2">
              <Input
                id="viewer-loading-text-color"
                type="color"
                className="size-10 w-16 shrink-0 cursor-pointer p-1"
                value={loadingTextColor}
                onChange={(event) => setLoadingTextColor(event.target.value)}
              />
              <span className="font-mono text-xs text-muted-foreground">{loadingTextColor}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="viewer-loading-text">Loading text</Label>
            <Input
              id="viewer-loading-text"
              value={loadingText}
              onChange={(event) => setLoadingText(event.target.value)}
              placeholder="Loading"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="viewer-loading-text-font">Loading text font</Label>
            <Input
              id="viewer-loading-text-font"
              value={loadingTextFont}
              onChange={(event) => setLoadingTextFont(event.target.value)}
              placeholder="Arial"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="viewer-loading-text-shadow">Loading text shadow</Label>
            <Input
              id="viewer-loading-text-shadow"
              value={loadingTextShadow}
              onChange={(event) => setLoadingTextShadow(event.target.value)}
              placeholder="#fff000"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4">
          <label
            htmlFor="viewer-use-separate-images"
            className="flex cursor-pointer items-center gap-2 text-sm"
          >
            <Checkbox
              id="viewer-use-separate-images"
              checked={useSeparateImages}
              onCheckedChange={(checked) => setUseSeparateImages(checked === true)}
            />
            Use separate images
          </label>
          <label
            htmlFor="viewer-use-local-viewer"
            className="flex cursor-pointer items-center gap-2 text-sm"
          >
            <Checkbox
              id="viewer-use-local-viewer"
              checked={useLocalViewer}
              onCheckedChange={(checked) => setUseLocalViewer(checked === true)}
            />
            Use local viewer
          </label>
        </div>

        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={updateSettings.isPending} onClick={handleSave}>
            {updateSettings.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
