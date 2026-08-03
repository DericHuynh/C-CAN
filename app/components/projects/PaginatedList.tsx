import { Fragment, useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Paginated list for the project editors — the replacement for the
 * virtualized/scrolling lists.
 *
 * Rendering every row, image or choice at once is what made the big panels
 * slow (hundreds of cards and, for images, decoded payloads in the DOM).
 * Instead of windowing against a scroll container, each list is split into
 * fixed-size pages: a short page renders fully, and Prev/Next + a range label
 * move between pages. Pages stay inside the bounded master column, so the
 * navigation and the sticky detail pane never scroll away.
 *
 * Small lists (fewer than `pageSize` items) render as one page without a
 * pager. The page stays put across project refetches (only clamped to the
 * valid range) and jumps back to 1 when `pageResetKey` changes — pass a
 * filter value to reset on filter changes.
 */
export function PaginatedList<T>({
  items,
  renderItem,
  getItemKey,
  pageSize = 25,
  gap = 16,
  className,
  pageResetKey,
  rangeLabel,
}: {
  items: readonly T[];
  renderItem: (item: T, index: number) => ReactNode;
  getItemKey: (item: T, index: number) => string | number;
  /** Rows per page. */
  pageSize?: number;
  /** Vertical gap between items, px (same spacing the lists used before). */
  gap?: number;
  className?: string;
  /** Change this to jump back to page 1 (e.g. when a filter changes). */
  pageResetKey?: string | number;
  /** Customize the pager's range label (1-based inclusive). */
  rangeLabel?: (start: number, end: number, total: number) => ReactNode;
}) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const [page, setPage] = useState(0);
  // Only an explicit filter change jumps back to page 1; refetches keep the
  // current page (clamped to the valid range) so edits don't bounce the list.
  useEffect(() => setPage(0), [pageResetKey]);
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * pageSize;
  const end = Math.min(start + pageSize, items.length);
  const pageItems = items.slice(start, end);
  const label = rangeLabel
    ? rangeLabel(start, end, items.length)
    : `${start + 1}–${end} of ${items.length}`;

  const pager =
    totalPages > 1 ? (
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={safePage === 0}
          onClick={() => setPage(safePage - 1)}
        >
          Prev
        </Button>
        <span className="text-xs text-muted-foreground">{label}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={safePage >= totalPages - 1}
          onClick={() => setPage(safePage + 1)}
        >
          Next
        </Button>
      </div>
    ) : null;

  return (
    <div className={cn("space-y-3", className)}>
      {pager}
      <div style={{ display: "flex", flexDirection: "column", gap }}>
        {pageItems.map((item, index) => (
          <Fragment key={getItemKey(item, index)}>{renderItem(item, start + index)}</Fragment>
        ))}
      </div>
      {pager}
    </div>
  );
}
