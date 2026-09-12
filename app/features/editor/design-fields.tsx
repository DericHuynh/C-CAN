import { useId, type ReactNode } from "react";

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

/* ------------------------------------------------------------------ */
/* Small controlled field components shared by the styling editor.     */
/* ------------------------------------------------------------------ */

interface ToggleFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** Checkbox + label, e.g. for the `*IsOn` styling toggles. */
export function ToggleField({ label, checked, onChange }: ToggleFieldProps) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm">
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      {label}
    </label>
  );
}

interface NumberFieldProps {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
}

/** Number input; reports `undefined` when cleared or non-numeric. */
export function NumberField({ label, value, onChange, min, max, step }: NumberFieldProps) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === "") {
            onChange(undefined);
            return;
          }
          const next = Number(raw);
          onChange(Number.isNaN(next) ? undefined : next);
        }}
      />
    </div>
  );
}

interface ColorFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * ICCPlus stores colors like `#70FF7EFF` (hex with alpha), which the native
 * `<input type="color">` cannot represent. Show the picker with the alpha
 * chopped off and keep a text input for the full hex string.
 */
function toPickerColor(value: string): string {
  if (/^#[0-9a-fA-F]{6}/.test(value)) return value.slice(0, 7);
  return "#000000";
}

export function ColorField({ id: providedId, label, value, onChange }: ColorFieldProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="color"
          className="h-10 w-14 shrink-0 cursor-pointer p-1"
          value={toPickerColor(value)}
          onChange={(event) =>
            onChange(event.target.value + (/^#[0-9a-f]{8}$/i.test(value) ? value.slice(7) : ""))
          }
        />
        <Input
          type="text"
          aria-label={`${label} value`}
          className="font-mono"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="#RRGGBB or #RRGGBBAA"
        />
      </div>
    </div>
  );
}

const TEXT_ALIGNMENTS = ["left", "center", "right", "justify"] as const;

interface TextAlignFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function TextAlignField({ label, value, onChange }: TextAlignFieldProps) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Select alignment" />
        </SelectTrigger>
        <SelectContent>
          {TEXT_ALIGNMENTS.map((alignment) => (
            <SelectItem key={alignment} value={alignment}>
              {alignment}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface TextInputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** Plain text input (font names, image URLs, gradient CSS strings). */
export function TextInputField({ label, value, onChange, placeholder }: TextInputFieldProps) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

interface SectionCardProps {
  title: string;
  description?: string;
  children: ReactNode;
}

/** Card wrapper used for every styling section. */
export function SectionCard({ title, description, children }: SectionCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
