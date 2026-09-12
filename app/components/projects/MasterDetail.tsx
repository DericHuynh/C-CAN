import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Two-pane master/detail layout used across the project editor tabs.
 *
 * The left column holds the master list (tree, card list, grid…); the right
 * column holds the editor for the selected item. On wide screens the master
 * and right columns share the available width. The master list scrolls in a
 * bounded area so the top navigation and the detail pane stay in view; the
 * detail pane is sticky. On narrow screens the panes stack (master first,
 * detail below) and the page scrolls normally.
 */
export function MasterDetail({
  master,
  detail,
  className,
}: {
  master: ReactNode;
  detail: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]", className)}
    >
      <div
        data-master-scroll
        className="min-w-0 lg:max-h-[calc(100dvh-240px)] lg:overflow-y-auto lg:pr-1"
      >
        {master}
      </div>
      <div className="min-w-0">{detail}</div>
    </div>
  );
}
