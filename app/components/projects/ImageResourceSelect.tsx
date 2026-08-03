import { useMemo } from "react";

import type { ImageResource } from "@shared/types";

import { LazySelect } from "./LazySelect";

/**
 * Image-resource picker: selects an `app.images` resource by id, with a
 * "Custom URL / data…" fallback input for legacy inline values. `__custom__`
 * is a UI-only marker — callers sanitize it before persisting.
 *
 * Options render lazily (only while the dropdown is open) — a project with
 * 1,000+ images would otherwise mount thousands of hidden SelectItems every
 * time an editor form opens.
 */
export function ImageResourceSelect({
  images,
  value,
  onChange,
  id,
  label,
  placeholder,
  searchable = true,
}: {
  images: ImageResource[];
  value: string;
  onChange: (value: string) => void;
  id?: string;
  label?: string;
  placeholder?: string;
  /** Search box inside the dropdown; on by default for large image sets. */
  searchable?: boolean;
}) {
  const items = useMemo(
    () =>
      images.map((img) => ({
        value: img.id,
        label: img.name || img.id,
        searchText: `${img.name ?? ""} ${img.id}`,
      })),
    [images],
  );

  return (
    <LazySelect
      id={id}
      label={label}
      value={value}
      onValueChange={onChange}
      items={items}
      placeholder={placeholder}
      searchable={searchable}
      allowCustom
      renderValue={(value) => images.find((img) => img.id === value)?.name ?? value}
    />
  );
}
