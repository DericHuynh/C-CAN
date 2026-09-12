import { ColorField } from "./design-fields";
import { useSavedField } from "./use-saved-field";
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
import { useUpdateProjectSettings, type ProjectDetail } from "@/features/projects/use-projects";
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
 * Viewer presentation settings: the page title/favicon and the loading
 * indicator shown while the viewer boots. Saves the full `viewerConfig`
 * object; `update-project-settings` shallow-merges it, so unknown keys are
 * preserved server-side.
 */
export function ViewerConfigPanel({ project }: ViewerConfigPanelProps) {
  const app = project.app;
  const updateSettings = useUpdateProjectSettings();

  // Older documents may predate individual fields; fill gaps from the
  // canonical defaults so the whole object is always round-trippable.
  const initial = { ...defaultViewerConfig, ...(app.viewerConfig ?? {}) };

  const [title, setTitle] = useSavedField(initial.title, ["viewerConfig", "title"]);
  const [favicon, setFavicon] = useSavedField(initial.favicon, ["viewerConfig", "favicon"]);
  const [loadingType, setLoadingType] = useSavedField(initial.loadingType, [
    "viewerConfig",
    "loadingType",
  ]);
  const [loadingBgColor, setLoadingBgColor] = useSavedField(initial.loadingBgColor, [
    "viewerConfig",
    "loadingBgColor",
  ]);
  const [loadingBgImage, setLoadingBgImage] = useSavedField(initial.loadingBgImage, [
    "viewerConfig",
    "loadingBgImage",
  ]);
  const [loadingCircleColor, setLoadingCircleColor] = useSavedField(initial.loadingCircleColor, [
    "viewerConfig",
    "loadingCircleColor",
  ]);
  const [loadingTrackColor, setLoadingTrackColor] = useSavedField(initial.loadingTrackColor, [
    "viewerConfig",
    "loadingTrackColor",
  ]);
  const [loadingText, setLoadingText] = useSavedField(initial.loadingText, [
    "viewerConfig",
    "loadingText",
  ]);
  const [loadingTextColor, setLoadingTextColor] = useSavedField(initial.loadingTextColor, [
    "viewerConfig",
    "loadingTextColor",
  ]);
  const [loadingTextFont, setLoadingTextFont] = useSavedField(initial.loadingTextFont, [
    "viewerConfig",
    "loadingTextFont",
  ]);
  const [loadingTextShadow, setLoadingTextShadow] = useSavedField(initial.loadingTextShadow, [
    "viewerConfig",
    "loadingTextShadow",
  ]);
  const [useSeparateImages, setUseSeparateImages] = useSavedField(initial.useSeparateImages, [
    "viewerConfig",
    "useSeparateImages",
  ]);
  const [useLocalViewer, setUseLocalViewer] = useSavedField(initial.useLocalViewer, [
    "viewerConfig",
    "useLocalViewer",
  ]);

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
          <ColorField
            id="viewer-loading-bg-color"
            label="Loading background color"
            value={loadingBgColor}
            onChange={setLoadingBgColor}
          />
          <ColorField
            id="viewer-loading-circle-color"
            label="Loading circle color"
            value={loadingCircleColor}
            onChange={setLoadingCircleColor}
          />
          <ColorField
            id="viewer-loading-track-color"
            label="Loading track color"
            value={loadingTrackColor}
            onChange={setLoadingTrackColor}
          />
          <ColorField
            id="viewer-loading-text-color"
            label="Loading text color"
            value={loadingTextColor}
            onChange={setLoadingTextColor}
          />
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
