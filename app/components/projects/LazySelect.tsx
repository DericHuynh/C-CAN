import { useMemo, useState, type ReactNode } from "react";
import { IconSearch } from "@tabler/icons-react";

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

export interface LazySelectItem {
  value: string;
  label: ReactNode;
  /** Extra text used by the optional search filter. */
  searchText?: string;
}

/** UI-only marker for the "custom URL / data…" option (never persisted). */
export const CUSTOM_MARKER = "__custom__";

/**
 * Select whose options are only rendered while the dropdown is open.
 *
 * Radix renders every `SelectItem` of a closed `SelectContent` into a hidden
 * `DocumentFragment` (it keeps them registered for value text + collection).
 * On this project the choice pickers hold 1,000+ items, so mounting an editor
 * form with several such selects created ~3,000+ hidden items per mount and
 * took seconds. This component keeps the trigger label stable via explicit
 * `SelectValue` children and only mounts the option list on open — the cost
 * moves to the user-initiated open, and closed selects are trivial.
 *
 * Large lists can pass `searchable` to filter with a text input inside the
 * dropdown (the toolkits' Select has no built-in search, and 1,000+ items are
 * otherwise unusable). `allowCustom` adds the "Custom URL / data…" option and
 * a fallback text input for legacy inline values.
 */
export function LazySelect({
  value,
  onValueChange,
  items,
  placeholder,
  id,
  label,
  className,
  triggerClassName,
  disabled,
  searchable = false,
  allowCustom = false,
  customMarker = CUSTOM_MARKER,
  customPlaceholder,
  customLabel = "Custom URL / data…",
  renderValue,
}: {
  value: string;
  onValueChange: (value: string) => void;
  items: LazySelectItem[];
  placeholder?: string;
  id?: string;
  label?: ReactNode;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  /** Filter options with a text input while open (for large lists). */
  searchable?: boolean;
  /** Add a "custom" tail option + fallback text input for unknown values. */
  allowCustom?: boolean;
  customMarker?: string;
  customPlaceholder?: string;
  customLabel?: string;
  /** Trigger label for the current value (items are unmounted while closed). */
  renderValue?: (value: string) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        String(item.label).toLowerCase().includes(q) ||
        (item.searchText ?? "").toLowerCase().includes(q),
    );
  }, [items, query]);

  const known = items.some((item) => item.value === value);
  const showCustomInput = allowCustom && value !== "" && !known && value !== customMarker;
  const triggerLabel = value === customMarker ? customLabel : (renderValue?.(value) ?? null);

  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
      ) : null}
      <Select
        value={value}
        onValueChange={onValueChange}
        open={open}
        onOpenChange={setOpen}
        disabled={disabled}
      >
        <SelectTrigger id={id} className={cn("w-full", triggerClassName)}>
          <SelectValue placeholder={placeholder}>{triggerLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {open ? (
            <>
              {searchable ? (
                <div
                  className="sticky top-0 z-10 border-b bg-popover p-1.5"
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <div className="relative">
                    <IconSearch className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      autoFocus
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search…"
                      className="h-8 pl-7 text-sm"
                      aria-label="Search options"
                      onKeyDown={(event) => {
                        // Let Radix handle Escape/Enter/arrows; keep typing in
                        // the input instead of Radix's typeahead.
                        if (event.key.length === 1 || event.key === "Backspace" || event.key === " ") {
                          event.stopPropagation();
                        }
                      }}
                    />
                  </div>
                </div>
              ) : null}
              {filtered.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
              {allowCustom ? (
                <SelectItem value={customMarker}>{customLabel}</SelectItem>
              ) : null}
              {searchable && filtered.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                  No matches for “{query.trim()}”.
                </p>
              ) : null}
            </>
          ) : null}
        </SelectContent>
      </Select>
      {showCustomInput ? (
        <Input
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={customPlaceholder ?? "https://… or data:image/…"}
          aria-label={`${typeof label === "string" ? label : "Custom"} URL or data`}
        />
      ) : null}
    </div>
  );
}
