import { useId, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { IconChevronDown } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateProjectSettings, type ProjectDetail } from "@/features/projects/use-projects";
import { defaultStyling } from "@shared/cyoa";
import type { ImageResource } from "@shared/types";

import {
  ColorField,
  NumberField,
  SectionCard,
  TextAlignField,
  TextInputField,
  ToggleField,
} from "@/features/editor/design-fields";
import { ImageResourceSelect } from "@/features/editor/ImageResourceSelect";
import { useSavedRecord } from "./use-saved-field";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const BORDER_STYLES = [
  "none",
  "solid",
  "double",
  "dotted",
  "dashed",
  "ridge",
  "inset",
  "outset",
] as const;

/** Text groups: `custom<Group>`, `<group>` font, size, color, align keys. */
const TEXT_GROUPS = [
  { id: "rowTitle", label: "Row Title", sizeKey: "rowTitleTextSize" },
  { id: "rowText", label: "Row Text", sizeKey: "rowTextTextSize" },
  { id: "objectTitle", label: "Choice Title", sizeKey: "objectTitleTextSize" },
  { id: "objectText", label: "Choice Text", sizeKey: "objectTextTextSize" },
  { id: "addonTitle", label: "Addon Title", sizeKey: "addonTitleTextSize" },
  { id: "addonText", label: "Addon Text", sizeKey: "addonTextTextSize" },
  { id: "scoreText", label: "Score Text", sizeKey: "scoreTextSize" },
] as const;

const FILTER_GROUPS = [
  { prefix: "sel", label: "Selected" },
  { prefix: "req", label: "Requirement-blocked" },
  { prefix: "unsel", label: "Not selected" },
] as const;

/** Numeric CSS filter keys; toggled by `<p><key>IsOn`, value by `<p><key>`. */
const FILTER_NUMBER_FIELDS = [
  { key: "FilterBlur", label: "Blur" },
  { key: "FilterBright", label: "Brightness" },
  { key: "FilterCont", label: "Contrast" },
  { key: "FilterGray", label: "Greyscale" },
  { key: "FilterHue", label: "Hue-rotate" },
  { key: "FilterInvert", label: "Invert" },
  { key: "FilterOpac", label: "Opacity" },
  { key: "FilterSatur", label: "Saturate" },
  { key: "FilterSepia", label: "Sepia" },
] as const;

/* ------------------------------------------------------------------ */
/* Draft accessors                                                     */
/* ------------------------------------------------------------------ */

function asBool(draft: Record<string, unknown>, key: string): boolean {
  return draft[key] === true;
}

function asNumber(draft: Record<string, unknown>, key: string): number | undefined {
  const value = draft[key];
  return typeof value === "number" ? value : undefined;
}

function asString(draft: Record<string, unknown>, key: string): string {
  const value = draft[key];
  return typeof value === "string" ? value : "";
}

interface SectionProps {
  draft: Record<string, unknown>;
  set: (key: string, value: unknown) => void;
  images?: ImageResource[];
}

/* ------------------------------------------------------------------ */

interface DesignPanelProps {
  project: ProjectDetail;
}

/**
 * Design editor for `app.styling`. All edits accumulate in one local draft
 * that is sent wholesale via update-project-settings (the action replaces
 * `app.styling`, so the full object must be sent).
 */
export function DesignPanel({ project }: DesignPanelProps) {
  const updateSettings = useUpdateProjectSettings();
  const images = project.app.images ?? [];
  const [draft, setDraft] = useSavedRecord(project.app.styling, ["styling"]);

  function set(key: string, value: unknown) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    const next = { ...draft };
    // "__custom__" is a UI-only marker for the image selects — never persist it.
    for (const key of [
      "backgroundImage",
      "rowBackgroundImage",
      "objectBackgroundImage",
      "addonBackgroundImage",
      "backpackBgImage",
    ]) {
      if (next[key] === "__custom__") next[key] = "";
    }
    updateSettings.mutate(
      { projectId: project.id, patch: { styling: next } },
      {
        onSuccess: () => toast.success("Styling saved"),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to save styling"),
      },
    );
  }

  function handleReset() {
    if (!window.confirm("Reset styling to defaults? Unsaved changes will be lost.")) {
      return;
    }
    setDraft({ ...defaultStyling });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Customize the appearance of your CYOA. Changes are applied when you save.
      </p>

      <BackgroundSection draft={draft} set={set} images={images} />
      <TextSection draft={draft} set={set} images={images} />
      <RowDesignSection draft={draft} set={set} images={images} />
      <ChoiceDesignSection draft={draft} set={set} images={images} />
      <AddonDesignSection draft={draft} set={set} images={images} />
      <FiltersSection draft={draft} set={set} images={images} />
      <PointBarSection draft={draft} set={set} images={images} />
      <BackpackSection draft={draft} set={set} images={images} />
      <MultiChoiceSection draft={draft} set={set} images={images} />

      <div className="sticky bottom-0 z-10 flex items-center justify-between gap-2 border-t border-border bg-background/95 py-3 backdrop-blur">
        <Button type="button" variant="ghost" onClick={handleReset}>
          Reset styling to defaults
        </Button>
        <Button type="button" onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Background                                                          */
/* ------------------------------------------------------------------ */

function BackgroundSection({ draft, set, images = [] }: SectionProps) {
  return (
    <>
      <SectionCard title="Background" description="Page background (what sits behind every row).">
        <ToggleField
          label="Background color"
          checked={asBool(draft, "bgColorIsOn")}
          onChange={(value) => set("bgColorIsOn", value)}
        />
        <ColorField
          label="Color"
          value={asString(draft, "backgroundColor")}
          onChange={(value) => set("backgroundColor", value)}
        />
        <ImageResourceSelect
          id="design-bg-image"
          label="Image"
          images={images}
          value={asString(draft, "backgroundImage")}
          onChange={(value) => set("backgroundImage", value)}
        />
        <div className="grid gap-2 sm:grid-cols-3">
          <ToggleField
            label="Repeat"
            checked={asBool(draft, "isBackgroundRepeat")}
            onChange={(value) => set("isBackgroundRepeat", value)}
          />
          <ToggleField
            label="Fit in"
            checked={asBool(draft, "isBackgroundFitIn")}
            onChange={(value) => set("isBackgroundFitIn", value)}
          />
          <ToggleField
            label="Overlay"
            checked={asBool(draft, "isBackgroundOverlay")}
            onChange={(value) => set("isBackgroundOverlay", value)}
          />
        </div>
      </SectionCard>

      <SectionCard title="Row background">
        <ToggleField
          label="Row background color"
          checked={asBool(draft, "rowBgColorIsOn")}
          onChange={(value) => set("rowBgColorIsOn", value)}
        />
        <ColorField
          label="Color"
          value={asString(draft, "rowBgColor")}
          onChange={(value) => set("rowBgColor", value)}
        />
        <ImageResourceSelect
          id="design-row-bg-image"
          label="Image"
          images={images}
          value={asString(draft, "rowBackgroundImage")}
          onChange={(value) => set("rowBackgroundImage", value)}
        />
        <div className="grid gap-2 sm:grid-cols-3">
          <ToggleField
            label="Repeat"
            checked={asBool(draft, "isRowBackgroundRepeat")}
            onChange={(value) => set("isRowBackgroundRepeat", value)}
          />
          <ToggleField
            label="Fit in"
            checked={asBool(draft, "isRowBackgroundFitIn")}
            onChange={(value) => set("isRowBackgroundFitIn", value)}
          />
          <ToggleField
            label="Overlay"
            checked={asBool(draft, "isRowBackgroundOverlay")}
            onChange={(value) => set("isRowBackgroundOverlay", value)}
          />
        </div>
      </SectionCard>

      <SectionCard title="Choice background">
        <ToggleField
          label="Choice background color"
          checked={asBool(draft, "objectBgColorIsOn")}
          onChange={(value) => set("objectBgColorIsOn", value)}
        />
        <ColorField
          label="Color"
          value={asString(draft, "objectBgColor")}
          onChange={(value) => set("objectBgColor", value)}
        />
        <ImageResourceSelect
          id="design-object-bg-image"
          label="Image"
          images={images}
          value={asString(draft, "objectBackgroundImage")}
          onChange={(value) => set("objectBackgroundImage", value)}
        />
        <div className="grid gap-2 sm:grid-cols-3">
          <ToggleField
            label="Repeat"
            checked={asBool(draft, "isObjectBackgroundRepeat")}
            onChange={(value) => set("isObjectBackgroundRepeat", value)}
          />
          <ToggleField
            label="Fit in"
            checked={asBool(draft, "isObjectBackgroundFitIn")}
            onChange={(value) => set("isObjectBackgroundFitIn", value)}
          />
          <ToggleField
            label="Overlay"
            checked={asBool(draft, "isObjectBackgroundOverlay")}
            onChange={(value) => set("isObjectBackgroundOverlay", value)}
          />
        </div>
      </SectionCard>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Text                                                                */
/* ------------------------------------------------------------------ */

function TextSection({ draft, set }: SectionProps) {
  return (
    <SectionCard
      title="Text"
      description="Fonts, sizes, colors, and alignment for titles and body text."
    >
      <div className="space-y-3">
        {TEXT_GROUPS.map((group) => (
          <TextGroupCard key={group.id} group={group} draft={draft} set={set} />
        ))}
      </div>
    </SectionCard>
  );
}

interface TextGroup {
  id: string;
  label: string;
  sizeKey: string;
}

function TextGroupCard({ group, draft, set }: { group: TextGroup } & SectionProps) {
  const customKey = `custom${group.id.charAt(0).toUpperCase()}${group.id.slice(1)}`;
  return (
    <CollapsibleCard title={group.label}>
      <ToggleField
        label="Use a custom font"
        checked={asBool(draft, customKey)}
        onChange={(value) => set(customKey, value)}
      />
      <TextInputField
        label="Font"
        value={asString(draft, group.id)}
        onChange={(value) => set(group.id, value)}
        placeholder="e.g. Times New Roman"
      />
      <NumberField
        label="Text size (%)"
        value={asNumber(draft, group.sizeKey)}
        onChange={(value) => set(group.sizeKey, value)}
      />
      <ColorField
        label="Text color"
        value={asString(draft, `${group.id}Color`)}
        onChange={(value) => set(`${group.id}Color`, value)}
      />
      <TextAlignField
        label="Alignment"
        value={asString(draft, `${group.id}Align`)}
        onChange={(value) => set(`${group.id}Align`, value)}
      />
    </CollapsibleCard>
  );
}

/* ------------------------------------------------------------------ */
/* Row / choice / addon shared building blocks                         */
/* ------------------------------------------------------------------ */

function RowDesignSection({ draft, set }: SectionProps) {
  return (
    <SectionCard title="Row design" description="Layout, shadow, border, and gradient for rows.">
      <Subheading>Layout</Subheading>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Row margin"
          value={asNumber(draft, "rowMargin")}
          onChange={(value) => set("rowMargin", value)}
        />
        <NumberField
          label="Body margin top"
          value={asNumber(draft, "rowBodyMarginTop")}
          onChange={(value) => set("rowBodyMarginTop", value)}
        />
        <NumberField
          label="Body margin bottom"
          value={asNumber(draft, "rowBodyMarginBottom")}
          onChange={(value) => set("rowBodyMarginBottom", value)}
        />
        <NumberField
          label="Body margin sides"
          value={asNumber(draft, "rowBodyMarginSides")}
          onChange={(value) => set("rowBodyMarginSides", value)}
        />
        <NumberField
          label="Header margin bottom"
          value={asNumber(draft, "rowHeaderMarginBottom")}
          onChange={(value) => set("rowHeaderMarginBottom", value)}
        />
        <NumberField
          label="Text padding X"
          value={asNumber(draft, "rowTextPaddingX")}
          onChange={(value) => set("rowTextPaddingX", value)}
        />
        <NumberField
          label="Text padding Y"
          value={asNumber(draft, "rowTextPaddingY")}
          onChange={(value) => set("rowTextPaddingY", value)}
        />
      </div>
      <ToggleField
        label="Overflow hidden"
        checked={asBool(draft, "rowOverflowIsOn")}
        onChange={(value) => set("rowOverflowIsOn", value)}
      />
      <ShadowFields prefix="row" draft={draft} set={set} />
      <ToggleField
        label="Use box shadow"
        checked={asBool(draft, "rowUseBoxShadowIsOn")}
        onChange={(value) => set("rowUseBoxShadowIsOn", value)}
      />
      <BorderFields prefix="row" draft={draft} set={set} />
      <RadiusFields prefix="row" draft={draft} set={set} />
      <GradientFields prefix="row" draft={draft} set={set} />
    </SectionCard>
  );
}

function ChoiceDesignSection({ draft, set }: SectionProps) {
  return (
    <SectionCard
      title="Choice design"
      description="Layout, shadow, border, and gradient for choices."
    >
      <ToggleField
        label="Every choice in a row has identical height"
        checked={asBool(draft, "objectHeight")}
        onChange={(value) => set("objectHeight", value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Margin"
          value={asNumber(draft, "objectMargin")}
          onChange={(value) => set("objectMargin", value)}
        />
        <NumberField
          label="Text padding"
          value={asNumber(draft, "objectTextPadding")}
          onChange={(value) => set("objectTextPadding", value)}
        />
      </div>
      <ToggleField
        label="Overflow hidden"
        checked={asBool(draft, "objectOverflowIsOn")}
        onChange={(value) => set("objectOverflowIsOn", value)}
      />
      <ShadowFields prefix="object" draft={draft} set={set} />
      <ToggleField
        label="Use box shadow"
        checked={asBool(draft, "objectUseBoxShadowIsOn")}
        onChange={(value) => set("objectUseBoxShadowIsOn", value)}
      />
      <BorderFields prefix="object" draft={draft} set={set} />
      <RadiusFields prefix="object" draft={draft} set={set} />
      <ToggleField
        label="Apply padding to the choice title"
        checked={asBool(draft, "titlePaddingIsOn")}
        onChange={(value) => set("titlePaddingIsOn", value)}
      />
      <GradientFields prefix="object" draft={draft} set={set} />
    </SectionCard>
  );
}

function AddonDesignSection({ draft, set, images = [] }: SectionProps) {
  return (
    <SectionCard title="Addon design" description="Design for the addon strip under choice text.">
      <ToggleField
        label="Use a separate design"
        checked={asBool(draft, "useAddonDesign")}
        onChange={(value) => set("useAddonDesign", value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Margin"
          value={asNumber(draft, "addonMargin")}
          onChange={(value) => set("addonMargin", value)}
        />
        <NumberField
          label="Text padding"
          value={asNumber(draft, "addonTextPadding")}
          onChange={(value) => set("addonTextPadding", value)}
        />
      </div>
      <ToggleField
        label="Addon background color"
        checked={asBool(draft, "addonBgColorIsOn")}
        onChange={(value) => set("addonBgColorIsOn", value)}
      />
      <ColorField
        label="Background color"
        value={asString(draft, "addonBgColor")}
        onChange={(value) => set("addonBgColor", value)}
      />
      <ToggleField
        label="Use addon background image"
        checked={asBool(draft, "useAddonBackgroundImage")}
        onChange={(value) => set("useAddonBackgroundImage", value)}
      />
      <ImageResourceSelect
        id="design-addon-bg-image"
        label="Background image"
        images={images}
        value={asString(draft, "addonBackgroundImage")}
        onChange={(value) => set("addonBackgroundImage", value)}
      />
      <div className="grid gap-2 sm:grid-cols-3">
        <ToggleField
          label="Repeat"
          checked={asBool(draft, "isAddonBackgroundRepeat")}
          onChange={(value) => set("isAddonBackgroundRepeat", value)}
        />
        <ToggleField
          label="Fit in"
          checked={asBool(draft, "isAddonBackgroundFitIn")}
          onChange={(value) => set("isAddonBackgroundFitIn", value)}
        />
        <ToggleField
          label="Overlay"
          checked={asBool(draft, "isAddonBackgroundOverlay")}
          onChange={(value) => set("isAddonBackgroundOverlay", value)}
        />
      </div>
      <BorderFields prefix="addon" draft={draft} set={set} />
      <RadiusFields prefix="addon" draft={draft} set={set} />
      <ShadowFields prefix="addon" draft={draft} set={set} />
      <ToggleField
        label="Use box shadow"
        checked={asBool(draft, "addonUseBoxShadowIsOn")}
        onChange={(value) => set("addonUseBoxShadowIsOn", value)}
      />
      <GradientFields prefix="addon" draft={draft} set={set} />
      <ToggleField
        label="Apply padding to the addon title"
        checked={asBool(draft, "addonTitlePaddingIsOn")}
        onChange={(value) => set("addonTitlePaddingIsOn", value)}
      />
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */

function FiltersSection({ draft, set }: SectionProps) {
  return (
    <SectionCard
      title="Filters"
      description="Visual filters applied to choices depending on their state."
    >
      <div className="space-y-3">
        {FILTER_GROUPS.map((group) => (
          <FilterGroupCard key={group.prefix} group={group} draft={draft} set={set} />
        ))}
      </div>
    </SectionCard>
  );
}

interface FilterGroup {
  prefix: string;
  label: string;
}

function FilterGroupCard({ group, draft, set }: { group: FilterGroup } & SectionProps) {
  const p = group.prefix;
  return (
    <CollapsibleCard title={group.label} defaultOpen={p === "sel"}>
      <ToggleField
        label="Hide choices in this state"
        checked={asBool(draft, `${p}FilterVisibleIsOn`)}
        onChange={(value) => set(`${p}FilterVisibleIsOn`, value)}
      />
      <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {FILTER_NUMBER_FIELDS.map(({ key, label }) => (
          <div key={key} className="space-y-2">
            <ToggleField
              label={label}
              checked={asBool(draft, `${p}${key}IsOn`)}
              onChange={(value) => set(`${p}${key}IsOn`, value)}
            />
            <NumberField
              label={`${label} value`}
              value={asNumber(draft, `${p}${key}`)}
              onChange={(value) => set(`${p}${key}`, value)}
            />
          </div>
        ))}
      </div>
      <ToggleField
        label="Background color"
        checked={asBool(draft, `${p}BgColorIsOn`)}
        onChange={(value) => set(`${p}BgColorIsOn`, value)}
      />
      <ColorField
        label="Background color"
        value={asString(draft, `${p}FilterBgColor`)}
        onChange={(value) => set(`${p}FilterBgColor`, value)}
      />
      <ToggleField
        label="Overlay image"
        checked={asBool(draft, `${p}OverlayOnImage`)}
        onChange={(value) => set(`${p}OverlayOnImage`, value)}
      />
      <ToggleField
        label="Border color"
        checked={asBool(draft, `${p}BorderColorIsOn`)}
        onChange={(value) => set(`${p}BorderColorIsOn`, value)}
      />
      <ColorField
        label="Border color"
        value={asString(draft, `${p}FilterBorderColor`)}
        onChange={(value) => set(`${p}FilterBorderColor`, value)}
      />
      <ToggleField
        label="Image border color"
        checked={asBool(draft, `${p}ImgBorderColorIsOn`)}
        onChange={(value) => set(`${p}ImgBorderColorIsOn`, value)}
      />
      <ColorField
        label="Image border color"
        value={asString(draft, `${p}FilterImgBorderColor`)}
        onChange={(value) => set(`${p}FilterImgBorderColor`, value)}
      />
      <ToggleField
        label="Choice title color"
        checked={asBool(draft, `${p}CTitleColorIsOn`)}
        onChange={(value) => set(`${p}CTitleColorIsOn`, value)}
      />
      <ColorField
        label="Choice title color"
        value={asString(draft, `${p}FilterCTitleColor`)}
        onChange={(value) => set(`${p}FilterCTitleColor`, value)}
      />
      <ToggleField
        label="Choice text color"
        checked={asBool(draft, `${p}CTextColorIsOn`)}
        onChange={(value) => set(`${p}CTextColorIsOn`, value)}
      />
      <ColorField
        label="Choice text color"
        value={asString(draft, `${p}FilterCTextColor`)}
        onChange={(value) => set(`${p}FilterCTextColor`, value)}
      />
      <ToggleField
        label="Addon title color"
        checked={asBool(draft, `${p}ATitleColorIsOn`)}
        onChange={(value) => set(`${p}ATitleColorIsOn`, value)}
      />
      <ColorField
        label="Addon title color"
        value={asString(draft, `${p}FilterATitleColor`)}
        onChange={(value) => set(`${p}FilterATitleColor`, value)}
      />
      <ToggleField
        label="Addon text color"
        checked={asBool(draft, `${p}ATextColorIsOn`)}
        onChange={(value) => set(`${p}ATextColorIsOn`, value)}
      />
      <ColorField
        label="Addon text color"
        value={asString(draft, `${p}FilterATextColor`)}
        onChange={(value) => set(`${p}FilterATextColor`, value)}
      />
      <ToggleField
        label="Score text color"
        checked={asBool(draft, `${p}ScoreTextColorIsOn`)}
        onChange={(value) => set(`${p}ScoreTextColorIsOn`, value)}
      />
      <ColorField
        label="Score text color"
        value={asString(draft, `${p}FilterSTextColor`)}
        onChange={(value) => set(`${p}FilterSTextColor`, value)}
      />
    </CollapsibleCard>
  );
}

/* ------------------------------------------------------------------ */
/* Point bar / backpack / multi-choice                                 */
/* ------------------------------------------------------------------ */

function PointBarSection({ draft, set }: SectionProps) {
  return (
    <SectionCard title="Point bar" description="The reader-facing score bar.">
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Text padding"
          value={asNumber(draft, "barTextPadding")}
          onChange={(value) => set("barTextPadding", value)}
        />
        <NumberField
          label="Text margin"
          value={asNumber(draft, "barTextMargin")}
          onChange={(value) => set("barTextMargin", value)}
        />
        <NumberField
          label="Bar padding"
          value={asNumber(draft, "barPadding")}
          onChange={(value) => set("barPadding", value)}
        />
        <NumberField
          label="Bar margin"
          value={asNumber(draft, "barMargin")}
          onChange={(value) => set("barMargin", value)}
        />
        <NumberField
          label="Text size"
          value={asNumber(draft, "barTextSize")}
          onChange={(value) => set("barTextSize", value)}
        />
        <ToggleField
          label="Custom text font"
          checked={asBool(draft, "customBarTextFont")}
          onChange={(value) => set("customBarTextFont", value)}
        />
        <TextInputField
          label="Text font"
          value={asString(draft, "barTextFont")}
          onChange={(value) => set("barTextFont", value)}
          placeholder="e.g. Times New Roman"
        />
        <ColorField
          label="Text color"
          value={asString(draft, "barTextColor")}
          onChange={(value) => set("barTextColor", value)}
        />
        <ColorField
          label="Positive point color"
          value={asString(draft, "barPointPos")}
          onChange={(value) => set("barPointPos", value)}
        />
        <ColorField
          label="Negative point color"
          value={asString(draft, "barPointNeg")}
          onChange={(value) => set("barPointNeg", value)}
        />
        <ColorField
          label="Icon color"
          value={asString(draft, "barIconColor")}
          onChange={(value) => set("barIconColor", value)}
        />
        <ColorField
          label="Background color"
          value={asString(draft, "barBackgroundColor")}
          onChange={(value) => set("barBackgroundColor", value)}
        />
      </div>
    </SectionCard>
  );
}

function BackpackSection({ draft, set, images = [] }: SectionProps) {
  return (
    <SectionCard title="Backpack" description="Design for the backpack screen.">
      <ToggleField
        label="Use a separate design"
        checked={asBool(draft, "useBackpackDesign")}
        onChange={(value) => set("useBackpackDesign", value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <ColorField
          label="Background color"
          value={asString(draft, "backpackBgColor")}
          onChange={(value) => set("backpackBgColor", value)}
        />
        <NumberField
          label="Backpack width"
          value={asNumber(draft, "backPackWidth")}
          onChange={(value) => set("backPackWidth", value)}
        />
        <div className="sm:col-span-2">
          <ImageResourceSelect
            id="design-backpack-bg-image"
            label="Background image"
            images={images}
            value={asString(draft, "backpackBgImage")}
            onChange={(value) => set("backpackBgImage", value)}
          />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <ToggleField
          label="Repeat background"
          checked={asBool(draft, "isBackpackBgRepeat")}
          onChange={(value) => set("isBackpackBgRepeat", value)}
        />
        <ToggleField
          label="Fit background"
          checked={asBool(draft, "isBackpackBgFitIn")}
          onChange={(value) => set("isBackpackBgFitIn", value)}
        />
      </div>
    </SectionCard>
  );
}

function MultiChoiceSection({ draft, set }: SectionProps) {
  return (
    <SectionCard title="Multi-choice" description="Text and counter for multi-choice pickers.">
      <div className="grid gap-4 sm:grid-cols-2">
        <ToggleField
          label="Custom text font"
          checked={asBool(draft, "customMultiTextFont")}
          onChange={(value) => set("customMultiTextFont", value)}
        />
        <TextInputField
          label="Text font"
          value={asString(draft, "multiChoiceTextFont")}
          onChange={(value) => set("multiChoiceTextFont", value)}
          placeholder="e.g. Times New Roman"
        />
        <NumberField
          label="Text size (%)"
          value={asNumber(draft, "multiChoiceTextSize")}
          onChange={(value) => set("multiChoiceTextSize", value)}
        />
        <SelectField
          label="Counter position"
          value={String(asNumber(draft, "multiChoiceCounterPosition") ?? 0)}
          options={["0", "1", "2", "3", "4"]}
          onChange={(value) => set("multiChoiceCounterPosition", Number(value))}
        />
        <NumberField
          label="Counter size (%)"
          value={asNumber(draft, "multiChoiceCounterSize")}
          onChange={(value) => set("multiChoiceCounterSize", value)}
        />
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/* Shared building blocks                                              */
/* ------------------------------------------------------------------ */

interface SubComponentProps extends SectionProps {
  prefix: string;
}

function ShadowFields({ prefix, draft, set }: SubComponentProps) {
  const enabled = asBool(draft, `${prefix}DropShadowIsOn`);
  return (
    <>
      <ToggleField
        label="Drop shadow"
        checked={enabled}
        onChange={(value) => set(`${prefix}DropShadowIsOn`, value)}
      />
      {enabled ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label="Horizontal offset"
            value={asNumber(draft, `${prefix}DropShadowH`)}
            onChange={(value) => set(`${prefix}DropShadowH`, value)}
          />
          <NumberField
            label="Vertical offset"
            value={asNumber(draft, `${prefix}DropShadowV`)}
            onChange={(value) => set(`${prefix}DropShadowV`, value)}
          />
          <NumberField
            label="Blur"
            value={asNumber(draft, `${prefix}DropShadowBlur`)}
            onChange={(value) => set(`${prefix}DropShadowBlur`, value)}
          />
          <NumberField
            label="Spread"
            value={asNumber(draft, `${prefix}DropShadowSpread`)}
            onChange={(value) => set(`${prefix}DropShadowSpread`, value)}
          />
          <div className="sm:col-span-2">
            <ColorField
              label="Shadow color"
              value={asString(draft, `${prefix}DropShadowColor`)}
              onChange={(value) => set(`${prefix}DropShadowColor`, value)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

function BorderFields({ prefix, draft, set }: SubComponentProps) {
  const enabled = asBool(draft, `${prefix}BorderIsOn`);
  return (
    <>
      <ToggleField
        label="Border"
        checked={enabled}
        onChange={(value) => set(`${prefix}BorderIsOn`, value)}
      />
      {enabled ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Border style"
            value={asString(draft, `${prefix}BorderStyle`) || "solid"}
            options={BORDER_STYLES}
            onChange={(value) => set(`${prefix}BorderStyle`, value)}
          />
          <NumberField
            label="Border width"
            value={asNumber(draft, `${prefix}BorderWidth`)}
            onChange={(value) => set(`${prefix}BorderWidth`, value)}
          />
          <div className="sm:col-span-2">
            <ColorField
              label="Border color"
              value={asString(draft, `${prefix}BorderColor`)}
              onChange={(value) => set(`${prefix}BorderColor`, value)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

function RadiusFields({ prefix, draft, set }: SubComponentProps) {
  return (
    <>
      <ToggleField
        label="Border radius in pixels"
        checked={asBool(draft, `${prefix}BorderRadiusIsPixels`)}
        onChange={(value) => set(`${prefix}BorderRadiusIsPixels`, value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Radius top-left"
          value={asNumber(draft, `${prefix}BorderRadiusTopLeft`)}
          onChange={(value) => set(`${prefix}BorderRadiusTopLeft`, value)}
        />
        <NumberField
          label="Radius top-right"
          value={asNumber(draft, `${prefix}BorderRadiusTopRight`)}
          onChange={(value) => set(`${prefix}BorderRadiusTopRight`, value)}
        />
        <NumberField
          label="Radius bottom-right"
          value={asNumber(draft, `${prefix}BorderRadiusBottomRight`)}
          onChange={(value) => set(`${prefix}BorderRadiusBottomRight`, value)}
        />
        <NumberField
          label="Radius bottom-left"
          value={asNumber(draft, `${prefix}BorderRadiusBottomLeft`)}
          onChange={(value) => set(`${prefix}BorderRadiusBottomLeft`, value)}
        />
      </div>
    </>
  );
}

function GradientFields({ prefix, draft, set }: SubComponentProps) {
  const enabled = asBool(draft, `${prefix}GradientIsOn`);
  return (
    <>
      <ToggleField
        label="Enable gradient"
        checked={enabled}
        onChange={(value) => set(`${prefix}GradientIsOn`, value)}
      />
      {enabled ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextInputField
              label="Gradient (not selected)"
              value={asString(draft, `${prefix}Gradient`)}
              onChange={(value) => set(`${prefix}Gradient`, value)}
              placeholder="to left, blue, red"
            />
          </div>
          {prefix !== "row" ? (
            <>
              <TextInputField
                label="Gradient when selected"
                value={asString(draft, `${prefix}GradientOnSelect`)}
                onChange={(value) => set(`${prefix}GradientOnSelect`, value)}
                placeholder="to left, blue, red"
              />
              <TextInputField
                label="Gradient when requirement missing"
                value={asString(draft, `${prefix}GradientOnReq`)}
                onChange={(value) => set(`${prefix}GradientOnReq`, value)}
                placeholder="to left, blue, red"
              />
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Small internal widgets                                              */
/* ------------------------------------------------------------------ */

interface CollapsibleCardProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

function CollapsibleCard({ title, defaultOpen = false, children }: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/50"
      >
        {title}
        <IconChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "" : "-rotate-90"
          }`}
        />
      </button>
      {open ? <CardContent className="space-y-4">{children}</CardContent> : null}
    </Card>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}

function SelectField({ label, value, options, onChange }: SelectFieldProps) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Subheading({ children }: { children: ReactNode }) {
  return <h3 className="pt-1 text-sm font-semibold text-muted-foreground">{children}</h3>;
}
