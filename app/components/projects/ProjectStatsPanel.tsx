import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectDetail } from "@/hooks/use-projects";
import type { App, Row } from "@shared/types";

interface ProjectStatsPanelProps {
  project: ProjectDetail;
}

type ItemKind = "row" | "choice" | "addon";

interface ContentItem {
  kind: ItemKind;
  title: string;
  text: string;
  image: string | undefined;
}

const KIND_LABEL: Record<ItemKind, string> = {
  row: "Row",
  choice: "Choice",
  addon: "Addon",
};

/** All rows including the backpack. */
function allRows(app: App): Row[] {
  return [...(app.rows ?? []), ...(app.backpack ?? [])];
}

/** Flatten rows → choices → addons with the text/image fields we tally. */
function contentItems(app: App): ContentItem[] {
  const items: ContentItem[] = [];
  for (const row of allRows(app)) {
    items.push({
      kind: "row",
      title: row.title ?? "",
      text: row.titleText ?? "",
      image: row.image,
    });
    for (const choice of row.objects ?? []) {
      items.push({
        kind: "choice",
        title: choice.title ?? "",
        text: choice.text ?? "",
        image: choice.image,
      });
      for (const addon of choice.addons ?? []) {
        items.push({
          kind: "addon",
          title: addon.title ?? "",
          text: addon.text ?? "",
          image: addon.image,
        });
      }
    }
  }
  return items;
}

/**
 * Estimated size of an image in KB. Data URLs are base64, so the byte count
 * is roughly `length * 3 / 4`; remote URLs are not downloadable here and
 * count as 0 KB (they still participate in largest/smallest via length).
 */
function estimateKb(image: string): number {
  const trimmed = image.trim();
  if (trimmed.startsWith("data:")) {
    return Math.round((trimmed.length * 3) / 4) / 1024;
  }
  return 0;
}

interface RankedImage {
  kb: number;
  length: number;
  label: string;
}

/** Pick the largest/smallest image, comparing by KB then by string length. */
function rankImages(items: ContentItem[]): {
  largest: RankedImage | null;
  smallest: RankedImage | null;
} {
  const images: RankedImage[] = [];
  for (const item of items) {
    const image = item.image?.trim();
    if (!image) continue;
    images.push({
      kb: estimateKb(image),
      length: image.length,
      label: `${KIND_LABEL[item.kind]}: ${item.title || "Untitled"}`,
    });
  }
  if (images.length === 0) return { largest: null, smallest: null };
  images.sort((a, b) => a.kb - b.kb || a.length - b.length);
  return { largest: images[images.length - 1], smallest: images[0] };
}

function formatKb(kb: number): string {
  return `${kb.toFixed(1)} KB`;
}

/**
 * Rough build-time guesstimate: ~175 characters of prose per minute of
 * writing plus ~5 minutes per image, rendered as "Xh Ym".
 */
function timeEstimate(chars: number, images: number): string {
  const totalMinutes = Math.round(chars / 175 + images * 5);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

/** Read-only stats over the whole document: counts, size and a time estimate. */
export function ProjectStatsPanel({ project }: ProjectStatsPanelProps) {
  const app = project.app;
  const items = contentItems(app);

  const rowCount = allRows(app).length;
  const choiceCount = items.filter((item) => item.kind === "choice").length;
  const addonCount = items.filter((item) => item.kind === "addon").length;

  const chars = items.reduce((sum, item) => sum + item.title.length + item.text.length, 0);

  const images = items.filter((item) => Boolean(item.image?.trim()));
  const { largest, smallest } = rankImages(items);

  const stats: { label: string; value: string }[] = [
    { label: "Rows", value: String(rowCount) },
    { label: "Choices", value: String(choiceCount) },
    { label: "Addons", value: String(addonCount) },
    {
      label: "Point types",
      value: String(app.pointTypes?.length ?? 0),
    },
    { label: "Groups", value: String(app.groups?.length ?? 0) },
    { label: "Variables", value: String(app.variables?.length ?? 0) },
    { label: "Words", value: String(app.words?.length ?? 0) },
    {
      label: "Sound effects",
      value: String(app.soundEffects?.length ?? 0),
    },
    { label: "Characters", value: chars.toLocaleString() },
    { label: "Images", value: String(images.length) },
    { label: "Time guesstimate", value: timeEstimate(chars, images.length) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Project stats</CardTitle>
        <CardDescription>
          A quick snapshot of the document — content counts, asset sizes and a rough build-time
          estimate.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-1.5"
            >
              <dt className="text-sm text-muted-foreground">{stat.label}</dt>
              <dd className="font-mono text-sm font-medium tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>

        <div className="space-y-2 border-t border-border pt-3 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-muted-foreground">Largest image</span>
            <span className="text-right font-mono text-xs text-foreground">
              {largest ? `${formatKb(largest.kb)} · ${largest.label}` : "—"}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-muted-foreground">Smallest image</span>
            <span className="text-right font-mono text-xs text-foreground">
              {smallest ? `${formatKb(smallest.kb)} · ${smallest.label}` : "—"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
