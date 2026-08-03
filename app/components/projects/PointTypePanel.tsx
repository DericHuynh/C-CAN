import { useState } from "react";
import { toast } from "sonner";
import { IconPlus, IconTrash } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAddPointType,
  useDeletePointType,
  useUpdatePointType,
  type ProjectDetail,
} from "@/hooks/use-projects";
import type { ImageResource, PointType } from "@shared/types";

import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { EditorPane } from "./EditorPane";
import { ImageResourceSelect } from "./ImageResourceSelect";
import { MasterDetail } from "./MasterDetail";
import { PaginatedList } from "./PaginatedList";

interface PointTypePanelProps {
  project: ProjectDetail;
}

interface PointTypeForm {
  name: string;
  startingSum: number;
  initValue: number;
  beforeText: string;
  afterText: string;
  isNotShownPointBar: boolean;
  // Gating & limits
  belowZeroNotAllowed: boolean;
  isNotShownObjects: boolean;
  allowFloat: boolean;
  decimalPlaces: number;
  plussOrMinusAdded: boolean;
  plussOrMinusInverted: boolean;
  activatedId: string;
  // Icons
  iconIsOn: boolean;
  image: string;
  iconWidth: number;
  iconHeight: number;
  imageOnSide: boolean;
  imageSidePlacement: boolean;
  negativeIconIsOn: boolean;
  negativeImage: string;
  negativeIconWidth: number;
  negativeIconHeight: number;
  negativeImageOnSide: boolean;
  negativeImageSidePlacement: boolean;
  // Colors
  pointColorsIsOn: boolean;
  positiveColor: string;
  negativeColor: string;
  pointPrivateColorIsOn: boolean;
  privateColor: string;
  privateNegativeColor: string;
}

export function PointTypePanel({ project }: PointTypePanelProps) {
  const projectId = project.id;
  const pointTypes = project.app.pointTypes ?? [];

  const addPointType = useAddPointType();
  const updatePointType = useUpdatePointType();
  const deletePointType = useDeletePointType();

  const [selected, setSelected] = useState<PointType | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PointType | null>(null);

  function handleSave(form: PointTypeForm) {
    if (selected && selected !== "new") {
      updatePointType.mutate(
        { projectId, pointTypeId: selected.id, patch: { ...form } },
        {
          onSuccess: () => {
            toast.success("Point type updated");
            setSelected(null);
          },
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to update point type"),
        },
      );
    } else {
      addPointType.mutate(
        {
          projectId,
          name: form.name,
          startingSum: form.startingSum,
          beforeText: form.beforeText,
          afterText: form.afterText,
        },
        {
          onSuccess: () => {
            toast.success("Point type added");
            setSelected(null);
          },
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to add point type"),
        },
      );
    }
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    deletePointType.mutate(
      { projectId, pointTypeId: target.id },
      {
        onSuccess: () => {
          toast.success("Point type deleted");
          if (selected !== null && selected !== "new" && selected.id === target.id) {
            setSelected(null);
          }
          setDeleteTarget(null);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to delete point type");
          setDeleteTarget(null);
        },
      },
    );
  }

  const detail =
    selected === "new" ? (
      <PointTypeDialog
        key="new"
        item={null}
        images={project.app.images ?? []}
        busy={addPointType.isPending || updatePointType.isPending}
        onCancel={() => setSelected(null)}
        onSave={handleSave}
      />
    ) : selected ? (
      <PointTypeDialog
        key={selected.id}
        item={selected}
        images={project.app.images ?? []}
        busy={addPointType.isPending || updatePointType.isPending}
        onCancel={() => setSelected(null)}
        onSave={handleSave}
      />
    ) : (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
          <p className="max-w-sm text-sm text-muted-foreground">
            Select a point type to edit it here, or add a new one — no more dialogs.
          </p>
        </CardContent>
      </Card>
    );

  const master = (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-background/95 py-2 backdrop-blur">
        <p className="text-sm text-muted-foreground">
          {pointTypes.length} point type
          {pointTypes.length === 1 ? "" : "s"} — scores draw from these
        </p>
        <Button type="button" size="sm" onClick={() => setSelected("new")}>
          <IconPlus className="mr-1.5 size-4" />
          Add point type
        </Button>
      </div>

      {pointTypes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No point types yet. Point types back the score chips on choices (costs like gold, HP,
              sanity…).
            </p>
            <Button type="button" onClick={() => setSelected("new")}>
              <IconPlus className="mr-1.5 size-4" />
              Add point type
            </Button>
          </CardContent>
        </Card>
      ) : (
        <PaginatedList
          items={pointTypes}
          getItemKey={(pointType) => pointType.id}
          pageSize={25}
          renderItem={(pointType) => {
            const preview = [
              pointType.beforeText,
              String(pointType.startingSum ?? 0),
              pointType.afterText,
            ]
              .map((part) => (part ?? "").trim())
              .filter(Boolean)
              .join(" ");
            return (
              <Card
                key={pointType.id}
                className={cn(
                  "cursor-pointer transition-colors",
                  selected !== null &&
                    selected !== "new" &&
                    selected.id === pointType.id &&
                    "border-primary bg-primary/5",
                )}
                onClick={() => setSelected(pointType)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">{pointType.name}</CardTitle>
                        {pointType.isNotShownPointBar ? (
                          <Badge variant="outline">Hidden in bar</Badge>
                        ) : null}
                        {pointType.allowFloat ? <Badge variant="outline">Float</Badge> : null}
                        {pointType.iconIsOn ? <Badge variant="secondary">Icon</Badge> : null}
                        {pointType.pointColorsIsOn ? (
                          <Badge variant="secondary">Colors</Badge>
                        ) : null}
                      </div>
                      <CardDescription className="mt-1 flex flex-wrap gap-1.5">
                        <span>Starts at {pointType.startingSum ?? 0}</span>
                        {preview ? <span>· {preview}</span> : null}
                      </CardDescription>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteTarget(pointType);
                        }}
                        aria-label={`Delete ${pointType.name}`}
                        title="Delete"
                      >
                        <IconTrash className="size-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="secondary">Base {pointType.startingSum ?? 0}</Badge>
                    <Badge variant="secondary">Init {pointType.initValue ?? 0}</Badge>
                    <Badge variant="secondary">
                      {pointType.beforeText || "—"} … {pointType.afterText || "—"}
                    </Badge>
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
        title={`Delete point type "${deleteTarget?.name || "Untitled"}"?`}
        description="Choices that use this point type keep their data but the score will no longer resolve to a named point bar."
        busy={deletePointType.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */

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

/** `imageOnSide`/`negativeImageOnSide` are booleans; false = left, true = right. */
function sideValue(enabled: boolean | undefined): "left" | "right" {
  return enabled === true ? "right" : "left";
}

/** `imageSidePlacement` booleans; false = before, true = after. */
function placementValue(enabled: boolean | undefined): "before" | "after" {
  return enabled === true ? "after" : "before";
}

interface PointTypeDialogProps {
  item: PointType | null;
  images: ImageResource[];
  busy?: boolean;
  onCancel: () => void;
  onSave: (form: PointTypeForm) => void;
}

function PointTypeDialog({ item, images, busy = false, onCancel, onSave }: PointTypeDialogProps) {
  const isEdit = Boolean(item);
  const [name, setName] = useState(item?.name ?? "");
  const [startingSum, setStartingSum] = useState(
    item?.startingSum != null ? String(item.startingSum) : "0",
  );
  const [initValue, setInitValue] = useState(
    item?.initValue != null ? String(item.initValue) : "0",
  );
  const [beforeText, setBeforeText] = useState(item?.beforeText ?? "");
  const [afterText, setAfterText] = useState(item?.afterText ?? "");
  const [isNotShownPointBar, setIsNotShownPointBar] = useState(item?.isNotShownPointBar ?? false);

  // Gating & limits
  const [belowZeroNotAllowed, setBelowZeroNotAllowed] = useState(
    item?.belowZeroNotAllowed ?? false,
  );
  const [isNotShownObjects, setIsNotShownObjects] = useState(item?.isNotShownObjects ?? false);
  const [allowFloat, setAllowFloat] = useState(item?.allowFloat ?? false);
  const [decimalPlaces, setDecimalPlaces] = useState(
    item?.decimalPlaces != null ? String(item.decimalPlaces) : "0",
  );
  const [plussOrMinusAdded, setPlussOrMinusAdded] = useState(item?.plussOrMinusAdded ?? false);
  const [plussOrMinusInverted, setPlussOrMinusInverted] = useState(
    item?.plussOrMinusInverted ?? false,
  );
  const [activatedId, setActivatedId] = useState(item?.activatedId ?? "");

  // Icons
  const [iconIsOn, setIconIsOn] = useState(item?.iconIsOn ?? false);
  const [image, setImage] = useState(item?.image ?? "");
  const [iconWidth, setIconWidth] = useState(
    item?.iconWidth != null ? String(item.iconWidth) : "0",
  );
  const [iconHeight, setIconHeight] = useState(
    item?.iconHeight != null ? String(item.iconHeight) : "0",
  );
  const [imageOnSide, setImageOnSide] = useState(item?.imageOnSide ?? false);
  const [imageSidePlacement, setImageSidePlacement] = useState(item?.imageSidePlacement ?? false);
  const [negativeIconIsOn, setNegativeIconIsOn] = useState(item?.negativeIconIsOn ?? false);
  const [negativeImage, setNegativeImage] = useState(item?.negativeImage ?? "");
  const [negativeIconWidth, setNegativeIconWidth] = useState(
    item?.negativeIconWidth != null ? String(item.negativeIconWidth) : "0",
  );
  const [negativeIconHeight, setNegativeIconHeight] = useState(
    item?.negativeIconHeight != null ? String(item.negativeIconHeight) : "0",
  );
  const [negativeImageOnSide, setNegativeImageOnSide] = useState(
    item?.negativeImageOnSide ?? false,
  );
  const [negativeImageSidePlacement, setNegativeImageSidePlacement] = useState(
    item?.negativeImageSidePlacement ?? false,
  );

  // Colors
  const [pointColorsIsOn, setPointColorsIsOn] = useState(item?.pointColorsIsOn ?? false);
  const [positiveColor, setPositiveColor] = useState(
    normalizeHexColor(item?.positiveColor, "#00ff00"),
  );
  const [negativeColor, setNegativeColor] = useState(
    normalizeHexColor(item?.negativeColor, "#ff0000"),
  );
  const [pointPrivateColorIsOn, setPointPrivateColorIsOn] = useState(
    item?.pointPrivateColorIsOn ?? false,
  );
  const [privateColor, setPrivateColor] = useState(
    normalizeHexColor(item?.privateColor, "#0000ff"),
  );
  const [privateNegativeColor, setPrivateNegativeColor] = useState(
    normalizeHexColor(item?.privateNegativeColor, "#ff0000"),
  );

  function handleSave() {
    onSave({
      name,
      startingSum: Number(startingSum) || 0,
      initValue: Number(initValue) || 0,
      beforeText,
      afterText,
      isNotShownPointBar,
      belowZeroNotAllowed,
      isNotShownObjects,
      allowFloat,
      decimalPlaces: Number(decimalPlaces) || 0,
      plussOrMinusAdded,
      plussOrMinusInverted,
      activatedId,
      iconIsOn,
      // "__custom__" is a UI-only marker for the image selects — never persist it.
      image: image === "__custom__" ? "" : image,
      iconWidth: Number(iconWidth) || 0,
      iconHeight: Number(iconHeight) || 0,
      imageOnSide,
      imageSidePlacement,
      negativeIconIsOn,
      negativeImage: negativeImage === "__custom__" ? "" : negativeImage,
      negativeIconWidth: Number(negativeIconWidth) || 0,
      negativeIconHeight: Number(negativeIconHeight) || 0,
      negativeImageOnSide,
      negativeImageSidePlacement,
      pointColorsIsOn,
      positiveColor,
      negativeColor,
      pointPrivateColorIsOn,
      privateColor,
      privateNegativeColor,
    });
  }

  return (
    <EditorPane
      title={isEdit ? "Edit point type" : "Add point type"}
      description="Point types track a number per reader (gold, HP, sanity…). Scores on choices add or subtract from it."
      busy={busy}
      saveLabel={isEdit ? "Save" : "Add"}
      onCancel={onCancel}
      onSave={handleSave}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="point-type-name">Name</Label>
          <Input
            id="point-type-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Gold"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="point-type-start">Starting sum</Label>
            <Input
              id="point-type-start"
              type="number"
              value={startingSum}
              onChange={(event) => setStartingSum(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="point-type-init">Init value</Label>
            <Input
              id="point-type-init"
              type="number"
              value={initValue}
              onChange={(event) => setInitValue(event.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="point-type-before">Before text</Label>
            <Input
              id="point-type-before"
              value={beforeText}
              onChange={(event) => setBeforeText(event.target.value)}
              placeholder="e.g. Cost:"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="point-type-after">After text</Label>
            <Input
              id="point-type-after"
              value={afterText}
              onChange={(event) => setAfterText(event.target.value)}
              placeholder="e.g. gold"
            />
          </div>
        </div>
        <label
          htmlFor="point-type-hide-bar"
          className="flex cursor-pointer items-center gap-2 text-sm"
        >
          <Checkbox
            id="point-type-hide-bar"
            checked={isNotShownPointBar}
            onCheckedChange={(checked) => setIsNotShownPointBar(checked === true)}
          />
          Hide from the viewer's point bar
        </label>

        {/* Gating & limits */}
        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-sm font-medium">Gating &amp; limits</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label
              htmlFor="point-type-below-zero"
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox
                id="point-type-below-zero"
                checked={belowZeroNotAllowed}
                onCheckedChange={(checked) => setBelowZeroNotAllowed(checked === true)}
              />
              Block going below zero
            </label>
            <label
              htmlFor="point-type-hide-objects"
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox
                id="point-type-hide-objects"
                checked={isNotShownObjects}
                onCheckedChange={(checked) => setIsNotShownObjects(checked === true)}
              />
              Hide on choice objects
            </label>
            <label
              htmlFor="point-type-allow-float"
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox
                id="point-type-allow-float"
                checked={allowFloat}
                onCheckedChange={(checked) => setAllowFloat(checked === true)}
              />
              Allow decimal values
            </label>
            <label
              htmlFor="point-type-plus-minus"
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox
                id="point-type-plus-minus"
                checked={plussOrMinusAdded}
                onCheckedChange={(checked) => setPlussOrMinusAdded(checked === true)}
              />
              Show +/- sign
            </label>
            <label
              htmlFor="point-type-plus-minus-inverted"
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox
                id="point-type-plus-minus-inverted"
                checked={plussOrMinusInverted}
                onCheckedChange={(checked) => setPlussOrMinusInverted(checked === true)}
              />
              Invert +/- sign
            </label>
          </div>
          {allowFloat ? (
            <div className="space-y-2">
              <Label htmlFor="point-type-decimals">Decimal places</Label>
              <Input
                id="point-type-decimals"
                type="number"
                min={0}
                max={10}
                value={decimalPlaces}
                onChange={(event) => setDecimalPlaces(event.target.value)}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="point-type-activated">
              Activated by
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                choice / global requirement / variable id
              </span>
            </Label>
            <Input
              id="point-type-activated"
              value={activatedId}
              onChange={(event) => setActivatedId(event.target.value)}
              placeholder="e.g. choice-abc1 or greq-xyz2"
            />
            <p className="text-xs text-muted-foreground">
              The point only shows in the bar while this id is active.
            </p>
          </div>
        </div>

        {/* Icons */}
        <div className="space-y-3 border-t border-border pt-4">
          <label
            htmlFor="point-type-icon-on"
            className="flex cursor-pointer items-center gap-2 text-sm font-medium"
          >
            <Checkbox
              id="point-type-icon-on"
              checked={iconIsOn}
              onCheckedChange={(checked) => setIconIsOn(checked === true)}
            />
            Show an icon for this point
          </label>
          {iconIsOn ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <ImageResourceSelect
                  id="point-type-image"
                  label="Image"
                  images={images}
                  value={image}
                  onChange={setImage}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="point-type-icon-width">Icon width</Label>
                  <Input
                    id="point-type-icon-width"
                    type="number"
                    value={iconWidth}
                    onChange={(event) => setIconWidth(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="point-type-icon-height">Icon height</Label>
                  <Input
                    id="point-type-icon-height"
                    type="number"
                    value={iconHeight}
                    onChange={(event) => setIconHeight(event.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="point-type-icon-side">Side</Label>
                  <Select
                    value={sideValue(imageOnSide)}
                    onValueChange={(value) => setImageOnSide(value === "right")}
                  >
                    <SelectTrigger id="point-type-icon-side" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="point-type-icon-placement">Placement</Label>
                  <Select
                    value={placementValue(imageSidePlacement)}
                    onValueChange={(value) => setImageSidePlacement(value === "after")}
                  >
                    <SelectTrigger id="point-type-icon-placement" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="before">Before text</SelectItem>
                      <SelectItem value="after">After text</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : null}

          <label
            htmlFor="point-type-negative-icon-on"
            className="flex cursor-pointer items-center gap-2 text-sm font-medium"
          >
            <Checkbox
              id="point-type-negative-icon-on"
              checked={negativeIconIsOn}
              onCheckedChange={(checked) => setNegativeIconIsOn(checked === true)}
            />
            Show a separate negative icon
          </label>
          {negativeIconIsOn ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <ImageResourceSelect
                  id="point-type-negative-image"
                  label="Negative image"
                  images={images}
                  value={negativeImage}
                  onChange={setNegativeImage}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="point-type-neg-icon-width">Icon width</Label>
                  <Input
                    id="point-type-neg-icon-width"
                    type="number"
                    value={negativeIconWidth}
                    onChange={(event) => setNegativeIconWidth(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="point-type-neg-icon-height">Icon height</Label>
                  <Input
                    id="point-type-neg-icon-height"
                    type="number"
                    value={negativeIconHeight}
                    onChange={(event) => setNegativeIconHeight(event.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="point-type-neg-icon-side">Side</Label>
                  <Select
                    value={sideValue(negativeImageOnSide)}
                    onValueChange={(value) => setNegativeImageOnSide(value === "right")}
                  >
                    <SelectTrigger id="point-type-neg-icon-side" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="point-type-neg-icon-placement">Placement</Label>
                  <Select
                    value={placementValue(negativeImageSidePlacement)}
                    onValueChange={(value) => setNegativeImageSidePlacement(value === "after")}
                  >
                    <SelectTrigger id="point-type-neg-icon-placement" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="before">Before text</SelectItem>
                      <SelectItem value="after">After text</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Colors */}
        <div className="space-y-3 border-t border-border pt-4">
          <label
            htmlFor="point-type-colors-on"
            className="flex cursor-pointer items-center gap-2 text-sm font-medium"
          >
            <Checkbox
              id="point-type-colors-on"
              checked={pointColorsIsOn}
              onCheckedChange={(checked) => setPointColorsIsOn(checked === true)}
            />
            Color the point value
          </label>
          {pointColorsIsOn ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="point-type-pos-color">Positive color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="point-type-pos-color"
                    type="color"
                    className="size-10 w-16 shrink-0 cursor-pointer p-1"
                    value={positiveColor}
                    onChange={(event) => setPositiveColor(event.target.value)}
                  />
                  <span className="font-mono text-xs text-muted-foreground">{positiveColor}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="point-type-neg-color">Negative color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="point-type-neg-color"
                    type="color"
                    className="size-10 w-16 shrink-0 cursor-pointer p-1"
                    value={negativeColor}
                    onChange={(event) => setNegativeColor(event.target.value)}
                  />
                  <span className="font-mono text-xs text-muted-foreground">{negativeColor}</span>
                </div>
              </div>
            </div>
          ) : null}

          <label
            htmlFor="point-type-private-colors-on"
            className="flex cursor-pointer items-center gap-2 text-sm font-medium"
          >
            <Checkbox
              id="point-type-private-colors-on"
              checked={pointPrivateColorIsOn}
              onCheckedChange={(checked) => setPointPrivateColorIsOn(checked === true)}
            />
            Use separate private colors
          </label>
          {pointPrivateColorIsOn ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="point-type-private-color">Private color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="point-type-private-color"
                    type="color"
                    className="size-10 w-16 shrink-0 cursor-pointer p-1"
                    value={privateColor}
                    onChange={(event) => setPrivateColor(event.target.value)}
                  />
                  <span className="font-mono text-xs text-muted-foreground">{privateColor}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="point-type-private-neg-color">Private negative color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="point-type-private-neg-color"
                    type="color"
                    className="size-10 w-16 shrink-0 cursor-pointer p-1"
                    value={privateNegativeColor}
                    onChange={(event) => setPrivateNegativeColor(event.target.value)}
                  />
                  <span className="font-mono text-xs text-muted-foreground">
                    {privateNegativeColor}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Preview:{" "}
          <span className="text-foreground">
            {[beforeText, startingSum, afterText]
              .map((part) => part.trim())
              .filter(Boolean)
              .join(" ") || "—"}
          </span>
        </p>
      </div>
    </EditorPane>
  );
}
