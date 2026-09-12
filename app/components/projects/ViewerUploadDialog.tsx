import { useEffect, useRef, useState } from "react";
import { useT } from "@agent-native/core/client/i18n";
import type Cropper from "cropperjs";
import "cropperjs/dist/cropper.min.css";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ViewerUploadDialog({
  initialImage,
  position,
  onClose,
  onSave,
}: {
  initialImage: string;
  position: number;
  onClose: () => void;
  onSave: (image: string) => void;
}) {
  const t = useT();
  const [source, setSource] = useState(initialImage);
  const [url, setUrl] = useState(initialImage.startsWith("data:") ? "" : initialImage);
  const [crop, setCrop] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [ratio, setRatio] = useState("");
  const [quality, setQuality] = useState(90);
  const [scale, setScale] = useState(100);
  const imageRef = useRef<HTMLImageElement>(null);
  const cropperRef = useRef<Cropper | null>(null);
  const readVersion = useRef(0);
  useEffect(() => {
    setReady(false);
    if (!crop || !source || !imageRef.current) return;
    let disposed = false;
    void import("cropperjs")
      .then(({ default: Cropper }) => {
        if (disposed || !imageRef.current) return;
        const cropper = new Cropper(imageRef.current, {
          viewMode: 1,
          autoCropArea: 0.8,
          ready() {
            if (disposed) return;
            const image = cropper.getImageData();
            const area = cropper.getData();
            const cell = Math.max(0, Math.min(8, Math.round(position)));
            cropper.setData({
              x: ((image.naturalWidth - area.width) * (cell % 3)) / 2,
              y: ((image.naturalHeight - area.height) * Math.floor(cell / 3)) / 2,
            });
            setReady(true);
          },
        });
        cropperRef.current = cropper;
      })
      .catch(() => {
        if (!disposed) setError(true);
      });
    return () => {
      disposed = true;
      cropperRef.current?.destroy();
      cropperRef.current = null;
    };
  }, [crop, source, position]);
  useEffect(() => {
    cropperRef.current?.setAspectRatio(Number(ratio) > 0 ? Number(ratio) : NaN);
  }, [ratio, ready]);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto"
        style={{ width: 720, maxWidth: "calc(100vw - 2rem)" }}
      >
        <DialogHeader>
          <DialogTitle>{t("viewer.uploadImage")}</DialogTitle>
          <DialogDescription>{t("viewer.uploadDescription")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="reader-image-file">{t("viewer.imageFile")}</Label>
            <Input
              id="reader-image-file"
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const version = ++readVersion.current;
                const reader = new FileReader();
                reader.onload = () => {
                  if (version === readVersion.current) {
                    setSource(String(reader.result));
                    setUrl("");
                    setError(false);
                  }
                };
                reader.onerror = () => {
                  if (version === readVersion.current) setError(true);
                };
                reader.readAsDataURL(file);
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reader-image-url">{t("viewer.imageUrl")}</Label>
            <div className="flex gap-2">
              <Input
                id="reader-image-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
              <Button
                variant="outline"
                onClick={() => {
                  if (!/^(https?:\/\/|data:image\/|blob:|\/)/i.test(url.trim())) {
                    setError(true);
                    return;
                  }
                  readVersion.current++;
                  setSource(url.trim());
                  setError(false);
                }}
              >
                {t("viewer.preview")}
              </Button>
            </div>
          </div>
          {source ? (
            <>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="reader-crop"
                  checked={crop}
                  onCheckedChange={(value) => setCrop(value === true)}
                />
                <Label htmlFor="reader-crop">{t("viewer.cropImage")}</Label>
              </div>
              <div className="h-64 overflow-hidden bg-muted">
                <img
                  key={`${source}:${crop}`}
                  ref={imageRef}
                  src={source}
                  alt={t("viewer.preview")}
                  className="mx-auto max-h-full max-w-full object-contain"
                  onError={() => setError(true)}
                />
              </div>
              {crop ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="reader-aspect">{t("viewer.aspectRatio")}</Label>
                    <Input
                      id="reader-aspect"
                      type="number"
                      min="0.01"
                      step="0.1"
                      value={ratio}
                      onChange={(event) => setRatio(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="reader-quality">{t("viewer.imageQuality")}</Label>
                    <Input
                      id="reader-quality"
                      type="number"
                      min="1"
                      max="100"
                      value={quality}
                      onChange={(event) =>
                        setQuality(Math.max(1, Math.min(100, event.target.valueAsNumber || 90)))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="reader-scale">{t("viewer.imageScale")}</Label>
                    <Input
                      id="reader-scale"
                      type="number"
                      min="1"
                      max="100"
                      value={scale}
                      onChange={(event) =>
                        setScale(Math.max(1, Math.min(100, event.target.valueAsNumber || 100)))
                      }
                    />
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <Button
                      variant="outline"
                      disabled={!ready}
                      onClick={() => cropperRef.current?.rotate(90)}
                    >
                      {t("viewer.rotate")}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!ready}
                      onClick={() => {
                        cropperRef.current?.reset();
                        setRatio("");
                      }}
                    >
                      {t("viewer.resetImage")}
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {t("viewer.uploadFailed")}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("viewer.cancel")}
          </Button>
          <Button
            disabled={!source || (crop && !ready)}
            onClick={() => {
              try {
                let result = source;
                if (crop) {
                  const cropper = cropperRef.current;
                  if (!cropper) return;
                  const area = cropper.getData();
                  const canvas = cropper.getCroppedCanvas({
                    width: Math.max(1, Math.round((area.width * scale) / 100)),
                    maxWidth: 8192,
                    maxHeight: 8192,
                  });
                  result = canvas.toDataURL("image/webp", quality / 100);
                  if (!result.startsWith("data:image/")) throw new Error("Empty image");
                }
                onSave(result);
                onClose();
              } catch {
                setError(true);
              }
            }}
          >
            {t("viewer.useImage")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
