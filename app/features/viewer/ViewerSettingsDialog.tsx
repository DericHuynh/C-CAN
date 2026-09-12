import { useT } from "@agent-native/core/client/i18n";
import type { App } from "@shared/types";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ViewerPreferences } from "./viewer-preferences";

export function ViewerSettingsDialog({
  app,
  onClose,
  onChange,
  onReset,
}: {
  app: App;
  onClose: () => void;
  onChange: (value: ViewerPreferences) => void;
  onReset: () => void;
}) {
  const t = useT();
  const toggles = [
    "minimizeTemplate",
    "enableHalfRow",
    "buildAutoSaveIsOn",
    "preloadImages",
    "allowDeselect",
    "isSingleFile",
    "showMusicPlayer",
  ] as const;
  const numberFields = [
    ["smallerScreenPx", 0, 1280, app.smallerScreenPx ?? 720],
    ["backPackWidth", 240, 16384, app.styling.backPackWidth ?? 1400],
    ["buildAutoSaveInterval", 1, 1440, app.buildAutoSaveInterval ?? 10],
  ] as const;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("viewer.settings")}</DialogTitle>
          <DialogDescription>{t("viewer.settingsDescription")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="reader-columns">{t("viewer.objectsPerRow")}</Label>
            <Select
              value={app.objectsPerRow}
              onValueChange={(objectsPerRow) => onChange({ objectsPerRow })}
            >
              <SelectTrigger id="reader-columns">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="default">{t("viewer.authorDefault")}</SelectItem>
                  {[2, 3, 4].map((count) => (
                    <SelectItem key={count} value={`col-${12 / count}`}>
                      {count}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          {numberFields.map(([key, min, max, value]) =>
            key === "buildAutoSaveInterval" && !app.buildAutoSaveIsOn ? null : (
              <div className="grid gap-2" key={key}>
                <Label htmlFor={`reader-${key}`}>{t(`viewer.${key}`)}</Label>
                <Input
                  id={`reader-${key}`}
                  type="number"
                  min={min}
                  max={max}
                  value={Number(value)}
                  onChange={(event) => {
                    if (event.target.value !== "") onChange({ [key]: event.target.valueAsNumber });
                  }}
                />
              </div>
            ),
          )}
          {toggles.map((key) => (
            <div className="flex items-center gap-3" key={key}>
              <Checkbox
                id={`reader-${key}`}
                checked={
                  (key === "allowDeselect" || key === "isSingleFile"
                    ? app.viewerSettings?.[key]
                    : app[key]) === true
                }
                onCheckedChange={(value) => onChange({ [key]: value === true })}
              />
              <Label htmlFor={`reader-${key}`}>{t(`viewer.${key}`)}</Label>
            </div>
          ))}
          <div className="grid gap-2">
            <Label htmlFor="reader-crop-position">{t("viewer.cropperPosition")}</Label>
            <Select
              value={String(app.cropperPosition ?? 4)}
              onValueChange={(value) => onChange({ cropperPosition: Number(value) })}
            >
              <SelectTrigger id="reader-crop-position">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {[
                    "topLeft",
                    "top",
                    "topRight",
                    "left",
                    "center",
                    "right",
                    "bottomLeft",
                    "bottom",
                    "bottomRight",
                  ].map((key, i) => (
                    <SelectItem key={key} value={String(i)}>
                      {t(`viewer.${key}`)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onReset}>
            {t("viewer.authorDefault")}
          </Button>
          <Button onClick={onClose}>{t("viewer.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
