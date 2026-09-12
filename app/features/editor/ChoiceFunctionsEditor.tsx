import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import type { Choice, PointType } from "@shared/types";

export interface FunctionsOption {
  id: string;
  label: string;
}

export interface ChoiceFunctionsEditorProps {
  /** Current function-field values (partial ChoiceFunc). */
  value: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  choices: FunctionsOption[];
  rows: FunctionsOption[];
  groups: FunctionsOption[];
  pointTypes: PointType[];
  soundEffects: FunctionsOption[];
}

const DISCOUNT_OPERATORS = [
  { value: "+", label: "Add (+)" },
  { value: "-", label: "Subtract (−)" },
  { value: "×", label: "Multiply (×)" },
  { value: "÷", label: "Divide (÷)" },
  { value: "=", label: "Set (=)" },
];

const HIDDEN_CONTENT_TYPES = [
  { value: "1", label: "Choice titles" },
  { value: "2", label: "Choice images" },
  { value: "3", label: "Choice text" },
  { value: "4", label: "Scores" },
  { value: "5", label: "Requirements" },
  { value: "6", label: "Addon titles" },
  { value: "7", label: "Addon images" },
  { value: "8", label: "Addon text" },
  { value: "9", label: "Unselected addons" },
  { value: "10", label: "Addons with unmet requirements" },
];

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group rounded-md border border-border">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium hover:bg-accent/40">
        {title}
      </summary>
      <div className="space-y-3 border-t border-border p-3">{children}</div>
    </details>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  indent = false,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  indent?: boolean;
}) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2 text-sm", indent && "pl-4")}>
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <span>{label}</span>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-8 text-sm"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: string;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          const num = Number(event.target.value);
          onChange(Number.isFinite(num) ? num : 0);
        }}
        className="h-8 text-sm"
      />
    </div>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = "Select…",
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value || " "} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger className="h-8 w-full text-sm">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TargetListField({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  options: FunctionsOption[];
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? "choice-id, group-id, …"}
        className="h-8 text-sm"
      />
      {options.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent"
              onClick={() => onChange(value ? `${value},${option.id}` : option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Comma-joined string helper for array-ish fields. */
function toCsv(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  return typeof value === "string" ? value : "";
}

function toArray(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* The functions editor                                                */
/* ------------------------------------------------------------------ */

/**
 * Editor for the ICCPlus choice "functions" — the runtime behaviors a choice
 * can carry (`ChoiceFunc`): linked activation, discounts, duplication,
 * template/width/background changes, BGM, fades, point modifiers, textfields,
 * delays, SFX and more. Controlled component; the dialog merges `value` into
 * the saved patch.
 */
export function ChoiceFunctionsEditor({
  value,
  onChange,
  choices,
  rows,
  groups,
  pointTypes,
  soundEffects,
}: ChoiceFunctionsEditorProps) {
  const get = (key: string): unknown => value[key];
  const bool = (key: string): boolean => value[key] === true;
  const num = (key: string): string => (value[key] == null ? "" : String(value[key]));
  const str = (key: string): string =>
    typeof value[key] === "string" ? (value[key] as string) : "";

  const set = (key: string, next: unknown) => onChange({ [key]: next });
  const setNum = (key: string) => (next: number) => onChange({ [key]: Number(next) || 0 });
  const setStr = (key: string) => (next: string) => onChange({ [key]: next });
  const setBool = (key: string) => (next: boolean) => onChange({ [key]: next });
  const setCsv = (key: string) => (next: string) => onChange({ [key]: toArray(next) });
  const setStrList = (key: string) => (next: string) => onChange({ [key]: next });

  const pointTypeOptions = pointTypes.map((pt) => ({ value: pt.id, label: pt.name }));
  const sfxOptions = soundEffects.map((sfx) => ({ value: sfx.id, label: sfx.label }));

  return (
    <div className="space-y-2">
      {/* Multiple-selection extras */}
      <Section title="Multiple selection">
        <Toggle
          label="Show a slider instead of a counter"
          checked={bool("useSlider")}
          onChange={setBool("useSlider")}
        />
        <Toggle
          label="Hide the counter"
          checked={bool("hideCounter")}
          onChange={setBool("hideCounter")}
        />
        <Toggle
          label="Hide counter on multiple choices"
          checked={bool("hideMultipleCounter")}
          onChange={setBool("hideMultipleCounter")}
        />
        <Toggle
          label="Don't count toward the row's selection limit"
          checked={bool("isCountDisabled")}
          onChange={setBool("isCountDisabled")}
        />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Show linked point value"
            value={str("multipleScoreId") || " "}
            options={[{ value: " ", label: "None" }, ...pointTypeOptions]}
            onChange={(v) => set("multipleScoreId", v === " " ? undefined : v)}
          />
        </div>
      </Section>

      {/* Activation */}
      <Section title="Activate other choices">
        <Toggle
          label="Activate other choices on select"
          checked={bool("activateOtherChoice")}
          onChange={setBool("activateOtherChoice")}
        />
        {bool("activateOtherChoice") ? (
          <div className="space-y-3">
            <TargetListField
              label="Choices / groups to activate"
              value={str("activateThisChoice")}
              options={[...choices, ...groups]}
              onChange={setStrList("activateThisChoice")}
              placeholder="choice-id, group-id, choice-id/ON#2"
            />
            <Toggle
              label="Linked choices can be deselected"
              checked={bool("isAllowDeselect")}
              onChange={setBool("isAllowDeselect")}
              indent
            />
            <Toggle
              label="Linked choices stay active on deselect"
              checked={bool("isNotDeactivate")}
              onChange={setBool("isNotDeactivate")}
              indent
            />
            <Toggle
              label="Re-activate after reset"
              checked={bool("activateAfterReset")}
              onChange={setBool("activateAfterReset")}
              indent
            />
            <Toggle
              label="Activate a random subset"
              checked={bool("isActivateRandom")}
              onChange={setBool("isActivateRandom")}
              indent
            />
            {bool("isActivateRandom") ? (
              <NumberField
                label="Number to activate randomly"
                value={num("numActivateRandom")}
                onChange={setNum("numActivateRandom")}
                min={0}
              />
            ) : null}
            <Toggle
              label="Skip non-selectable targets"
              checked={bool("isNotActiveUnselectable")}
              onChange={setBool("isNotActiveUnselectable")}
              indent
            />
          </div>
        ) : null}
      </Section>

      {/* Deactivation */}
      <Section title="Deactivate other choices">
        <Toggle
          label="Deactivate other choices on select"
          checked={bool("deactivateOtherChoice")}
          onChange={setBool("deactivateOtherChoice")}
        />
        {bool("deactivateOtherChoice") ? (
          <TargetListField
            label="Choices / groups to deactivate"
            value={str("deactivateThisChoice")}
            options={[...choices, ...groups]}
            onChange={setStrList("deactivateThisChoice")}
            placeholder="choice-id, group-id, choice-id/ON#2"
          />
        ) : null}
      </Section>

      {/* Discounts */}
      <Section title="Discount other choices">
        <Toggle
          label="Discount other choices' scores"
          checked={bool("discountOther")}
          onChange={setBool("discountOther")}
        />
        {bool("discountOther") ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Operator"
                value={str("discountOperator") || "+"}
                options={DISCOUNT_OPERATORS}
                onChange={(v) => set("discountOperator", v)}
              />
              <NumberField
                label="Value"
                value={num("discountValue")}
                onChange={setNum("discountValue")}
                step={0.01}
              />
            </div>
            <Toggle
              label="Stackable with other discounts"
              checked={bool("stackableDiscount")}
              onChange={setBool("stackableDiscount")}
            />
            <Toggle
              label="Limit to specific choices / rows / groups"
              checked={bool("isDisChoices")}
              onChange={setBool("isDisChoices")}
            />
            {bool("isDisChoices") ? (
              <div className="space-y-3">
                <TargetListField
                  label="Choice ids"
                  value={toCsv(get("discountChoices"))}
                  options={choices}
                  onChange={setCsv("discountChoices")}
                  placeholder="choice-id"
                />
                <TargetListField
                  label="Row ids"
                  value={toCsv(get("discountRows"))}
                  options={rows}
                  onChange={setCsv("discountRows")}
                  placeholder="row-id"
                />
                <TargetListField
                  label="Group ids"
                  value={toCsv(get("discountGroups"))}
                  options={groups}
                  onChange={setCsv("discountGroups")}
                  placeholder="group-id"
                />
                <TargetListField
                  label="Point type ids"
                  value={toCsv(get("discountPointTypes"))}
                  options={pointTypes.map((pt) => ({ id: pt.id, label: pt.name }))}
                  onChange={setCsv("discountPointTypes")}
                  placeholder="point-id"
                />
              </div>
            ) : null}
            <Toggle
              label="Enforce a minimum discounted value"
              checked={bool("discountLowLimitIsOn")}
              onChange={setBool("discountLowLimitIsOn")}
            />
            {bool("discountLowLimitIsOn") ? (
              <NumberField
                label="Minimum value"
                value={num("discountLowLimit")}
                onChange={setNum("discountLowLimit")}
                step={0.01}
              />
            ) : null}
            <Toggle
              label="Only apply after N targets are selected"
              checked={bool("useDiscountCount")}
              onChange={setBool("useDiscountCount")}
            />
            {bool("useDiscountCount") ? (
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="Target count"
                  value={num("discountCount")}
                  onChange={setNum("discountCount")}
                  min={1}
                />
                <Toggle
                  label="Count each selection separately"
                  checked={bool("countPerSelection")}
                  onChange={setBool("countPerSelection")}
                />
              </div>
            ) : null}
            <Toggle
              label="Show the discount on target choices"
              checked={bool("discountShow")}
              onChange={setBool("discountShow")}
            />
            {bool("discountShow") ? (
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Before text"
                  value={str("discountBeforeText")}
                  onChange={setStr("discountBeforeText")}
                />
                <TextField
                  label="After text"
                  value={str("discountAfterText")}
                  onChange={setStr("discountAfterText")}
                />
                <Toggle
                  label="Replace the score text"
                  checked={bool("replaceScoreText")}
                  onChange={setBool("replaceScoreText")}
                />
                <div className="space-y-1">
                  <Toggle
                    label="Hide the value"
                    checked={bool("hideScoreValue")}
                    onChange={setBool("hideScoreValue")}
                  />
                  <Toggle
                    label="Hide the icon"
                    checked={bool("hideScoreIcon")}
                    onChange={setBool("hideScoreIcon")}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Section>

      {/* Duplicate row */}
      <Section title="Duplicate a row">
        <Toggle
          label="Duplicate a row when selected"
          checked={bool("duplicateRow")}
          onChange={setBool("duplicateRow")}
        />
        {bool("duplicateRow") ? (
          <div className="space-y-3">
            <SelectField
              label="Row to duplicate"
              value={str("duplicateRowId") || " "}
              options={[
                { value: " ", label: "None" },
                ...rows.map((r) => ({ value: r.id, label: r.label })),
              ]}
              onChange={(v) => set("duplicateRowId", v === " " ? undefined : v)}
            />
            <SelectField
              label="Insert after row"
              value={str("duplicateRowPlace") || " "}
              options={[
                { value: " ", label: "None" },
                ...rows.map((r) => ({ value: r.id, label: r.label })),
              ]}
              onChange={(v) => set("duplicateRowPlace", v === " " ? undefined : v)}
            />
            <Toggle
              label="Keep original requirement references"
              checked={bool("dRowAddSufReq")}
              onChange={setBool("dRowAddSufReq")}
            />
            <Toggle
              label="Keep original function references"
              checked={bool("dRowAddSufFunc")}
              onChange={setBool("dRowAddSufFunc")}
            />
          </div>
        ) : null}
      </Section>

      {/* Hidden contents */}
      <Section title="Hide contents">
        <Toggle
          label="Hide parts of other rows when selected"
          checked={bool("isContentHidden")}
          onChange={setBool("isContentHidden")}
        />
        {bool("isContentHidden") ? (
          <div className="space-y-3">
            <TargetListField
              label="Rows to affect"
              value={toCsv(get("hiddenContentsRow"))}
              options={rows}
              onChange={setCsv("hiddenContentsRow")}
              placeholder="row-id"
            />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Contents to hide</Label>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {HIDDEN_CONTENT_TYPES.map((type) => {
                  const current = toArray(toCsv(get("hiddenContentsType")));
                  const active = current.includes(type.value);
                  return (
                    <label
                      key={type.value}
                      className="flex cursor-pointer items-center gap-2 rounded border border-border px-2 py-1 text-xs hover:bg-accent/40"
                    >
                      <Checkbox
                        checked={active}
                        onCheckedChange={(v) => {
                          const next = new Set(current);
                          if (v === true) next.add(type.value);
                          else next.delete(type.value);
                          onChange({ hiddenContentsType: [...next] });
                        }}
                      />
                      {type.label}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </Section>

      {/* Allow choices */}
      <Section title="Increase row limits">
        <Toggle
          label="Raise another row's selection limit"
          checked={bool("addToAllowChoice")}
          onChange={setBool("addToAllowChoice")}
        />
        {bool("addToAllowChoice") ? (
          <div className="space-y-3">
            <TargetListField
              label="Rows to raise"
              value={toCsv(get("idOfAllowChoice"))}
              options={rows}
              onChange={setCsv("idOfAllowChoice")}
              placeholder="row-id"
            />
            <NumberField
              label="Extra slots"
              value={num("numbAddToAllowChoice")}
              onChange={setNum("numbAddToAllowChoice")}
              min={1}
            />
          </div>
        ) : null}
      </Section>

      {/* Show all addons */}
      <Section title="Addons">
        <Toggle
          label="Show all addons (ignore requirements)"
          checked={bool("showAllAddons")}
          onChange={setBool("showAllAddons")}
        />
        <Toggle
          label="Keep addons when clean / clear"
          checked={bool("notDeselectedByClean")}
          onChange={setBool("notDeselectedByClean")}
        />
        <Toggle
          label="Use separate addon area (side templates)"
          checked={bool("useSeperateAddon")}
          onChange={setBool("useSeperateAddon")}
        />
        <Toggle
          label="Show scores inside the first addon"
          checked={bool("showScoreInAddon")}
          onChange={setBool("showScoreInAddon")}
        />
        <Toggle
          label="Show requirements inside the first addon"
          checked={bool("showReqInAddon")}
          onChange={setBool("showReqInAddon")}
        />
        <Toggle
          label="Deselect parent when no addons remain"
          checked={bool("deselectWhenNoAddon")}
          onChange={setBool("deselectWhenNoAddon")}
        />
      </Section>

      {/* Change templates */}
      <Section title="Change templates">
        <Toggle
          label="Change other choices' templates"
          checked={bool("changeTemplates")}
          onChange={setBool("changeTemplates")}
        />
        {bool("changeTemplates") ? (
          <div className="space-y-3">
            <TargetListField
              label="Choices / rows / groups"
              value={str("changeTemplatesList")}
              options={[...choices, ...rows, ...groups]}
              onChange={setStrList("changeTemplatesList")}
              placeholder="choice-id, row-id, group-id"
            />
            <NumberField
              label="Template to apply (1–5)"
              value={num("changeToThisTemplate")}
              onChange={setNum("changeToThisTemplate")}
              min={1}
              max={5}
            />
            <Toggle
              label="Also change the targets' addons"
              checked={bool("changeAddonTemplate")}
              onChange={setBool("changeAddonTemplate")}
            />
          </div>
        ) : null}
      </Section>

      {/* Change width */}
      <Section title="Change widths">
        <Toggle
          label="Change other choices' widths"
          checked={bool("changeWidth")}
          onChange={setBool("changeWidth")}
        />
        {bool("changeWidth") ? (
          <div className="space-y-3">
            <TargetListField
              label="Choices / rows / groups"
              value={str("changeWidthList")}
              options={[...choices, ...rows, ...groups]}
              onChange={setStrList("changeWidthList")}
              placeholder="choice-id, row-id, group-id"
            />
            <TextField
              label="Width class to apply"
              value={str("changeToThisWidth")}
              onChange={setStr("changeToThisWidth")}
              placeholder="col-sm-6"
            />
          </div>
        ) : null}
      </Section>

      {/* Scroll */}
      <Section title="Scroll on select">
        <Toggle
          label="Scroll to a row / choice when selected"
          checked={bool("scrollToRow")}
          onChange={setBool("scrollToRow")}
        />
        {bool("scrollToRow") ? (
          <div className="space-y-3">
            <Toggle
              label="Scroll to a specific choice instead of a row"
              checked={bool("scrollToObject")}
              onChange={setBool("scrollToObject")}
            />
            {bool("scrollToObject") ? (
              <TargetListField
                label="Choice to scroll to"
                value={str("scrollObjectId")}
                options={choices}
                onChange={setStr("scrollObjectId")}
                placeholder="choice-id"
              />
            ) : (
              <TargetListField
                label="Row to scroll to"
                value={str("scrollRowId")}
                options={rows}
                onChange={setStr("scrollRowId")}
                placeholder="row-id"
              />
            )}
          </div>
        ) : null}
      </Section>

      {/* Change point bar */}
      <Section title="Change point bar">
        <Toggle
          label="Change the point bar colors"
          checked={bool("changePointBar")}
          onChange={setBool("changePointBar")}
        />
        {bool("changePointBar") ? (
          <div className="space-y-2">
            <Toggle
              label="Background color"
              checked={bool("changeBarBgColorIsOn")}
              onChange={setBool("changeBarBgColorIsOn")}
            />
            {bool("changeBarBgColorIsOn") ? (
              <TextField
                label="Background color"
                value={str("changedBarBgColor")}
                onChange={setStr("changedBarBgColor")}
                placeholder="#RRGGBB"
              />
            ) : null}
            <Toggle
              label="Text color"
              checked={bool("changeBarTextColorIsOn")}
              onChange={setBool("changeBarTextColorIsOn")}
            />
            {bool("changeBarTextColorIsOn") ? (
              <TextField
                label="Text color"
                value={str("changedBarTextColor")}
                onChange={setStr("changedBarTextColor")}
                placeholder="#RRGGBB"
              />
            ) : null}
            <Toggle
              label="Icon color"
              checked={bool("changeBarIconColorIsOn")}
              onChange={setBool("changeBarIconColorIsOn")}
            />
            {bool("changeBarIconColorIsOn") ? (
              <TextField
                label="Icon color"
                value={str("changedBarIconColor")}
                onChange={setStr("changedBarIconColor")}
                placeholder="#RRGGBB"
              />
            ) : null}
          </div>
        ) : null}
      </Section>

      {/* Change background */}
      <Section title="Change background">
        <Toggle
          label="Change the page background"
          checked={bool("changeBackground")}
          onChange={setBool("changeBackground")}
        />
        {bool("changeBackground") ? (
          <div className="space-y-3">
            <Toggle
              label="Use an image instead of a color"
              checked={bool("changeBgImage")}
              onChange={setBool("changeBgImage")}
            />
            {bool("changeBgImage") ? (
              <TextField
                label="Background image URL"
                value={str("bgImage")}
                onChange={setStr("bgImage")}
                placeholder="https://…"
              />
            ) : (
              <TextField
                label="Background color"
                value={str("changedBgColorCode")}
                onChange={setStr("changedBgColorCode")}
                placeholder="#RRGGBB"
              />
            )}
          </div>
        ) : null}
      </Section>

      {/* BGM */}
      <Section title="Music / BGM">
        <Toggle
          label="Play music when selected"
          checked={bool("setBgmIsOn")}
          onChange={setBool("setBgmIsOn")}
        />
        {bool("setBgmIsOn") ? (
          <div className="space-y-3">
            <TextField
              label="Audio URL or YouTube video id"
              value={str("bgmId")}
              onChange={setStr("bgmId")}
              placeholder="https://…/track.mp3 or dQw4w9WgXcQ"
            />
            <Toggle
              label="This is an audio URL (not YouTube)"
              checked={bool("useAudioURL")}
              onChange={setBool("useAudioURL")}
            />
            <div className="grid grid-cols-2 gap-3">
              <Toggle label="Fade in" checked={bool("bgmFadeIn")} onChange={setBool("bgmFadeIn")} />
              <Toggle
                label="Fade out"
                checked={bool("bgmFadeOut")}
                onChange={setBool("bgmFadeOut")}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Fade-in seconds"
                value={num("bgmFadeInSec")}
                onChange={setNum("bgmFadeInSec")}
                step={0.1}
              />
              <NumberField
                label="Fade-out seconds"
                value={num("bgmFadeOutSec")}
                onChange={setNum("bgmFadeOutSec")}
                step={0.1}
              />
            </div>
            <Toggle
              label="Don't loop"
              checked={bool("bgmNoLoop")}
              onChange={setBool("bgmNoLoop")}
            />
            <Toggle
              label="Mute other music"
              checked={bool("muteBgm")}
              onChange={setBool("muteBgm")}
            />
          </div>
        ) : null}
      </Section>

      {/* Fade transition */}
      <Section title="Fade transition">
        <Toggle
          label="Fade the screen when selected"
          checked={bool("isFadeTransition")}
          onChange={setBool("isFadeTransition")}
        />
        {bool("isFadeTransition") ? (
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Color"
              value={str("fadeTransitionColor")}
              onChange={setStr("fadeTransitionColor")}
              placeholder="#000000"
            />
            <NumberField
              label="Fade-in seconds"
              value={num("fadeInTransitionTime")}
              onChange={setNum("fadeInTransitionTime")}
              step={0.05}
            />
            <NumberField
              label="Fade-out seconds"
              value={num("fadeOutTransitionTime")}
              onChange={setNum("fadeOutTransitionTime")}
              step={0.05}
            />
          </div>
        ) : null}
      </Section>

      {/* Point modifiers */}
      <Section title="Multiply / divide / set points">
        <Toggle
          label="Multiply point types"
          checked={bool("multiplyPointtypeIsOn")}
          onChange={setBool("multiplyPointtypeIsOn")}
        />
        {bool("multiplyPointtypeIsOn") ? (
          <div className="space-y-3">
            <TargetListField
              label="Point types to multiply"
              value={toCsv(get("pointTypeToMultiply"))}
              options={pointTypes.map((pt) => ({ id: pt.id, label: pt.name }))}
              onChange={setCsv("pointTypeToMultiply")}
              placeholder="point-id"
            />
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Multiply by"
                value={num("multiplyWithThis")}
                onChange={setNum("multiplyWithThis")}
                step={0.01}
              />
              <Toggle
                label="Multiply by another point's total"
                checked={bool("multiplyPointtypeIsId")}
                onChange={setBool("multiplyPointtypeIsId")}
              />
            </div>
          </div>
        ) : null}
        <Toggle
          label="Divide point types"
          checked={bool("dividePointtypeIsOn")}
          onChange={setBool("dividePointtypeIsOn")}
        />
        {bool("dividePointtypeIsOn") ? (
          <div className="space-y-3">
            <TargetListField
              label="Point types to divide"
              value={toCsv(get("pointTypeToDivide"))}
              options={pointTypes.map((pt) => ({ id: pt.id, label: pt.name }))}
              onChange={setCsv("pointTypeToDivide")}
              placeholder="point-id"
            />
            <NumberField
              label="Divide by"
              value={num("divideWithThis")}
              onChange={setNum("divideWithThis")}
              step={0.01}
            />
          </div>
        ) : null}
        <Toggle
          label="Set point types to a value"
          checked={bool("setPointtypeIsOn")}
          onChange={setBool("setPointtypeIsOn")}
        />
        {bool("setPointtypeIsOn") ? (
          <div className="space-y-3">
            <TargetListField
              label="Point types to set"
              value={toCsv(get("pointTypeToSet"))}
              options={pointTypes.map((pt) => ({ id: pt.id, label: pt.name }))}
              onChange={setCsv("pointTypeToSet")}
              placeholder="point-id"
            />
            <TextField
              label="Value (or expression like {other_point} * 2)"
              value={str("setWithThis")}
              onChange={setStr("setWithThis")}
              placeholder="5"
            />
          </div>
        ) : null}
      </Section>

      {/* Textfield */}
      <Section title="Text input">
        <Toggle
          label="Prompt for text when selected"
          checked={bool("textfieldIsOn")}
          onChange={setBool("textfieldIsOn")}
        />
        {bool("textfieldIsOn") ? (
          <div className="space-y-3">
            <TargetListField
              label="Word id the text is stored in"
              value={str("idOfTheTextfieldWord")}
              options={[]}
              onChange={setStr("idOfTheTextfieldWord")}
              placeholder="word-id"
            />
            <TextField
              label="Prompt text"
              value={str("wordPromptText")}
              onChange={setStr("wordPromptText")}
              placeholder="Enter your name…"
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Default when selected"
                value={str("wordChangeSelect")}
                onChange={setStr("wordChangeSelect")}
              />
              <TextField
                label="Reset value on deselect"
                value={str("wordChangeDeselect")}
                onChange={setStr("wordChangeDeselect")}
              />
            </div>
          </div>
        ) : null}
      </Section>

      {/* Confirm */}
      <Section title="Confirmation">
        <Toggle
          label="Ask for confirmation before selecting"
          checked={bool("confirmIsOn")}
          onChange={setBool("confirmIsOn")}
        />
        {bool("confirmIsOn") ? (
          <TextField
            label="Confirmation text"
            value={str("wordPromptText")}
            onChange={setStr("wordPromptText")}
            placeholder="Confirm selection?"
          />
        ) : null}
      </Section>

      {/* Delays */}
      <Section title="Selection delay">
        <Toggle
          label="Delay selection (fade-in)"
          checked={bool("isSelectDelayed")}
          onChange={setBool("isSelectDelayed")}
        />
        {bool("isSelectDelayed") ? (
          <NumberField
            label="Delay milliseconds"
            value={num("selectDelayTime")}
            onChange={setNum("selectDelayTime")}
            min={0}
          />
        ) : null}
        <Toggle
          label="Delay deselection"
          checked={bool("isDeselectDelayed")}
          onChange={setBool("isDeselectDelayed")}
        />
        {bool("isDeselectDelayed") ? (
          <NumberField
            label="Delay milliseconds"
            value={num("deselectDelayTime")}
            onChange={setNum("deselectDelayTime")}
            min={0}
          />
        ) : null}
      </Section>

      {/* SFX */}
      <Section title="Sound effects">
        <Toggle
          label="Use a custom sound effect"
          checked={bool("useSfx")}
          onChange={setBool("useSfx")}
        />
        {bool("useSfx") ? (
          <div className="space-y-3">
            <Toggle
              label="Play on select"
              checked={bool("sfxOnSelect")}
              onChange={setBool("sfxOnSelect")}
            />
            {bool("sfxOnSelect") ? (
              <SelectField
                label="Select sound"
                value={str("sfxIdOnSelect") || " "}
                options={[{ value: " ", label: "None" }, ...sfxOptions]}
                onChange={(v) => set("sfxIdOnSelect", v === " " ? undefined : v)}
              />
            ) : null}
            <Toggle
              label="Play on deselect"
              checked={bool("sfxOnDeselect")}
              onChange={setBool("sfxOnDeselect")}
            />
            {bool("sfxOnDeselect") ? (
              <SelectField
                label="Deselect sound"
                value={str("sfxIdOnDeselect") || " "}
                options={[{ value: " ", label: "None" }, ...sfxOptions]}
                onChange={(v) => set("sfxIdOnDeselect", v === " " ? undefined : v)}
              />
            ) : null}
          </div>
        ) : null}
      </Section>

      {/* Misc */}
      <Section title="Misc">
        <Toggle
          label="Require to show the backpack button"
          checked={bool("backpackBtnRequirement")}
          onChange={setBool("backpackBtnRequirement")}
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Random weight (row buttons)"
            value={num("randomWeight")}
            onChange={setNum("randomWeight")}
            min={0}
          />
          <TextField
            label="Default image (image upload reset)"
            value={str("defaultImage")}
            onChange={setStr("defaultImage")}
            placeholder="https://…"
          />
        </div>
        {value && Object.keys(value).length > 0 ? (
          <div className="flex flex-wrap gap-1 pt-1">
            <span className="text-xs text-muted-foreground">Active:</span>
            {Object.keys(value)
              .filter((key) => value[key] !== false && value[key] !== undefined)
              .map((key) => (
                <Badge key={key} variant="outline" className="text-[10px]">
                  {key}
                </Badge>
              ))}
          </div>
        ) : null}
      </Section>
    </div>
  );
}
