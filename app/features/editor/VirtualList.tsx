import { useEffect, useRef, useState, type ReactNode } from "react";
/** Fixed-height rows keep DOM/image decoding proportional to the viewport. */
export function VirtualList<T>({
  items,
  rowHeight = 88,
  height = 440,
  renderItem,
  getItemKey,
  resetKey,
}: {
  items: readonly T[];
  rowHeight?: number;
  height?: number;
  renderItem: (item: T, index: number) => ReactNode;
  getItemKey: (item: T, index: number) => string | number;
  resetKey?: unknown;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState(0);
  useEffect(() => {
    setScroll(0);
    if (root.current) root.current.scrollTop = 0;
  }, [resetKey]);
  const start = Math.max(
    0,
    Math.min(Math.floor(scroll / rowHeight) - 3, Math.max(0, items.length - 1)),
  );
  const end = Math.min(items.length, start + Math.ceil(height / rowHeight) + 7);
  return (
    <div
      ref={root}
      data-virtual-list
      tabIndex={0}
      className="relative overflow-y-auto overscroll-contain rounded-md border"
      style={{ height, maxHeight: "65dvh" }}
      onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
    >
      <div style={{ height: items.length * rowHeight, position: "relative" }}>
        {items.slice(start, end).map((item, i) => (
          <div
            key={getItemKey(item, start + i)}
            style={{
              position: "absolute",
              top: (start + i) * rowHeight,
              height: rowHeight,
              left: 0,
              right: 0,
            }}
          >
            {renderItem(item, start + i)}
          </div>
        ))}
      </div>
      {!items.length && <p className="p-4 text-sm text-muted-foreground">No matching results.</p>}
    </div>
  );
}
