import { useDeferredValue, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  describeContent,
  emptyContentFilter,
  filterContent,
  type ContentEntry,
  type ContentFilter,
} from "@shared/content-browser";

export function useContentBrowser<T>(
  items: readonly T[],
  describe?: (item: T, index: number) => ContentEntry,
) {
  const [filter, setFilter] = useState<ContentFilter>(emptyContentFilter);
  const deferred = useDeferredValue(filter);
  const entries = useMemo(
    () =>
      items.map((item, index) => ({
        item,
        index,
        meta: describe ? describe(item, index) : describeContent(item, index),
      })),
    [items, describe],
  );
  const results = useMemo(() => filterContent(entries, deferred), [entries, deferred]);
  const visibleItems = useMemo(() => results.map((r) => r.item), [results]);
  return {
    filter,
    setFilter,
    entries,
    results,
    items: visibleItems,
    reset: () => setFilter(emptyContentFilter),
  };
}
export function ContentBrowserControls({
  browser,
  label = "content",
}: {
  browser: ReturnType<typeof useContentBrowser<any>>;
  label?: string;
}) {
  const { filter, setFilter, entries, results } = browser;
  const change = (key: keyof ContentFilter, value: string) =>
    setFilter((prev) => ({ ...prev, [key]: value }));
  const tags = useMemo(() => [...new Set(entries.flatMap((e) => e.meta.tags))].sort(), [entries]);
  const types = useMemo(
    () => [...new Set(entries.map((e) => e.meta.type).filter(Boolean))].sort(),
    [entries],
  );
  const dates = entries.some((e) => e.meta.createdAt);
  const selectClass = "h-9 max-w-full rounded-md border border-input bg-background px-2 text-sm";
  return (
    <div
      className="space-y-2 rounded-md border border-border bg-background p-2"
      role="search"
      aria-label={`Search ${label}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={filter.query}
          onChange={(e) => change("query", e.target.value)}
          placeholder={`Search ${label}…`}
          aria-label={`Search ${label}`}
          className="min-w-32 flex-1"
        />
        <select
          className={selectClass}
          aria-label={`Sort ${label}`}
          value={filter.sort}
          onChange={(e) => change("sort", e.target.value)}
        >
          <option value="order">Document order</option>
          <option value="name">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
          <option value="newest">Added: newest first</option>
          <option value="oldest">Added: oldest first</option>
          {dates && <option value="updated">Recently updated</option>}
        </select>
        <details className="text-sm">
          <summary className="cursor-pointer rounded border px-3 py-2">Filters</summary>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            {tags.length > 0 && (
              <label>
                Tag
                <select
                  aria-label={`Filter ${label} by tag`}
                  className={selectClass}
                  value={filter.tag}
                  onChange={(e) => change("tag", e.target.value)}
                >
                  <option value="">All tags</option>
                  {tags.map((tag) => (
                    <option key={tag}>{tag}</option>
                  ))}
                </select>
              </label>
            )}
            {types.length > 0 && (
              <label>
                Type
                <select
                  aria-label={`Filter ${label} by type`}
                  className={selectClass}
                  value={filter.type}
                  onChange={(e) => change("type", e.target.value)}
                >
                  <option value="">All types</option>
                  {types.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
            )}
            <select
              aria-label={`Filter ${label} by content`}
              className={selectClass}
              value={filter.has}
              onChange={(e) => change("has", e.target.value)}
            >
              <option value="">All content</option>
              <option value="image">With images</option>
              <option value="no-image">Without images</option>
              <option value="requirements">With requirements</option>
            </select>
            <label>
              Added after
              <Input
                type="date"
                aria-label="Added after"
                value={filter.from}
                onChange={(e) => change("from", e.target.value)}
              />
            </label>
            <label>
              Added before
              <Input
                type="date"
                aria-label="Added before"
                value={filter.to}
                onChange={(e) => change("to", e.target.value)}
              />
            </label>
            <p className="w-full text-xs text-muted-foreground">
              Use quotes for phrases, -word to exclude, or tag:name. Undated imports use document
              order for added sorting and are excluded by date filters.
            </p>
          </div>
        </details>
        <Button type="button" size="sm" variant="ghost" onClick={browser.reset}>
          Reset
        </Button>
      </div>
      <p className="text-xs text-muted-foreground" role="status">
        {results.length} of {entries.length} results
      </p>
    </div>
  );
}
