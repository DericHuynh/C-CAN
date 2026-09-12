import { useEffect, useRef, useState } from "react";
import { IconDownload } from "@tabler/icons-react";
import { toast } from "sonner";
import { useT } from "@agent-native/core/client/i18n";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type UseCyoaResult } from "@/features/viewer/use-cyoa";
import { cn } from "@/lib/utils";
import { isEnabled } from "@shared/cyoa-engine";
import { resolveImageRef } from "@shared/cyoa";
import { numValue, rowWidthClass } from "./cyoa-styles";
import { useViewerBackground } from "./ViewerImage";
import { exportBackpackImages } from "./viewer-export";
import { RowView } from "./RowView";

export function BackpackDialog({
  open,
  onOpenChange,
  cyoa,
  viewport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cyoa: UseCyoaResult;
  viewport: number;
}) {
  const t = useT();
  const contentRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [backpackViewport, setBackpackViewport] = useState(viewport);
  useEffect(() => {
    const content = contentRef.current;
    if (!open || !content) return;
    setBackpackViewport(content.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) =>
      setBackpackViewport(Math.round(entry.contentRect.width)),
    );
    observer.observe(content);
    return () => observer.disconnect();
  }, [open]);
  const app = cyoa.app;
  const styling = (app.styling ?? {}) as Record<string, unknown>;
  const useBackpackDesign = styling.useBackpackDesign === true;
  const bgColor = (useBackpackDesign ? styling.backpackBgColor : styling.backgroundColor) as
    | string
    | undefined;
  const rawBgImage = (useBackpackDesign ? styling.backpackBgImage : styling.backgroundImage) as
    | string
    | undefined;
  const bgImage = useViewerBackground(resolveImageRef(app, rawBgImage), open);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="cyoa-viewer max-h-[90vh] overflow-y-auto"
        style={{
          width: numValue(styling.backPackWidth, 1400),
          maxWidth: "calc(100vw - 2rem)",
          backgroundColor: bgColor || undefined,
          backgroundImage: bgImage ? `url(${bgImage})` : undefined,
          backgroundSize: "cover",
        }}
      >
        <DialogHeader>
          <DialogTitle>{app.backpack?.[0]?.title || "Backpack"}</DialogTitle>
          <Button
            type="button"
            variant="outline"
            disabled={exporting}
            onClick={async () => {
              if (!contentRef.current || exporting) return;
              setExporting(true);
              try {
                const images = await exportBackpackImages(
                  contentRef.current,
                  app.viewerSettings?.isSingleFile === true,
                );
                images.forEach((blob, index) => {
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download =
                    images.length === 1 ? "backpack.png" : `backpack-${index + 1}.png`;
                  document.body.append(link);
                  link.click();
                  link.remove();
                  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                });
              } catch {
                toast.error(t("viewer.imageExportFailed"));
              } finally {
                setExporting(false);
              }
            }}
          >
            <IconDownload className="mr-1.5 size-4" />
            {t(exporting ? "viewer.exportingImage" : "viewer.downloadImage")}
          </Button>
        </DialogHeader>
        <div
          ref={contentRef}
          className="flex flex-wrap gap-y-3"
          style={{
            backgroundColor: bgColor,
            backgroundImage: rawBgImage ? `url('${resolveImageRef(app, rawBgImage)}')` : undefined,
            backgroundSize: "cover",
          }}
        >
          {(app.backpack ?? [])
            .filter((row) => isEnabled(row.requireds, cyoa.idx, cyoa.state))
            .map((row) => (
              <div
                key={row.id}
                className={cn(rowWidthClass(row, app, backpackViewport), "min-w-0")}
              >
                <RowView cyoa={cyoa} row={row} viewport={backpackViewport} />
              </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Build form                                                         */
/* ------------------------------------------------------------------ */
