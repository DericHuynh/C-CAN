import { useMemo, useState } from "react";
import { IconChevronRight } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ProjectDetail } from "@/features/projects/use-projects";
import type { App, Row } from "@shared/types";

import { cn } from "@/lib/utils";
import { CopyId } from "@/features/editor/CopyId";
import { PaginatedList } from "@/features/editor/PaginatedList";

interface IdListPanelProps {
  project: ProjectDetail;
}

interface IdRecord {
  id: string;
  title: string;
  debugTitle: string;
  type: "row" | "choice";
}

/** All rows including the backpack. */
function allRows(app: App): Row[] {
  return [...(app.rows ?? []), ...(app.backpack ?? [])];
}

/** Flatten rows and their choices into CSV records in document order. */
function csvRecords(app: App): IdRecord[] {
  const records: IdRecord[] = [];
  for (const row of allRows(app)) {
    records.push({
      id: row.id ?? "",
      title: row.title ?? "",
      debugTitle: row.debugTitle ?? "",
      type: "row",
    });
    for (const choice of row.objects ?? []) {
      records.push({
        id: choice.id ?? "",
        title: choice.title ?? "",
        debugTitle: choice.debugTitle ?? "",
        type: "choice",
      });
    }
  }
  return records;
}

/** Quote a CSV field when it contains a delimiter, quote or newline. */
function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** One row node: id chip (copy), title, and its choices as children. */
function RowNode({ row, open, onToggle }: { row: Row; open: boolean; onToggle: () => void }) {
  const choices = row.objects ?? [];
  return (
    <Collapsible open={open} onOpenChange={() => onToggle()}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {choices.length > 0 ? (
          <CollapsibleTrigger asChild>
            <button
              type="button"
              aria-label={open ? "Collapse row" : "Expand row"}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <IconChevronRight
                className={cn("size-4 transition-transform", open && "rotate-90")}
              />
            </button>
          </CollapsibleTrigger>
        ) : (
          <span className="inline-block w-5" />
        )}
        <CopyId id={row.id ?? ""} />
        {row.debugTitle ? (
          <span className="font-mono text-xs text-muted-foreground">{row.debugTitle}</span>
        ) : null}
        {row.title ? <span className="text-sm font-medium">{row.title}</span> : null}
        <Badge variant="secondary" className="ml-auto shrink-0">
          {choices.length} choice{choices.length === 1 ? "" : "s"}
        </Badge>
      </div>
      <CollapsibleContent>
        <ul className="ml-5 space-y-1 border-l border-border pl-3 pt-1">
          {choices.map((choice) => (
            <li
              key={choice.id ?? `choice-${choice.index}`}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
            >
              <CopyId id={choice.id ?? ""} />
              {choice.title ? (
                <span className="text-sm text-muted-foreground">{choice.title}</span>
              ) : null}
            </li>
          ))}
          {choices.length === 0 ? (
            <li className="text-xs text-muted-foreground">No choices</li>
          ) : null}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Read-only reference of every row and choice id (tree view, ids copy on
 * click). Useful for wiring up requirements, buttons and "activated by" ids.
 * Exports the same listing as a CSV file with a UTF-8 BOM so Excel opens it
 * correctly.
 */
export function IdListPanel({ project }: IdListPanelProps) {
  const app = project.app;
  const rows = useMemo(() => allRows(app), [app]);
  // Open-state lives here (not per node) so collapsed rows stay collapsed
  // when the virtualized list unmounts them off-screen.
  const [openRows, setOpenRows] = useState<Set<string>>(
    () => new Set(rows.map((row) => row.id ?? "")),
  );

  function toggleRow(id: string) {
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleExport() {
    const lines = ["id,title,debugTitle,type"];
    for (const record of csvRecords(app)) {
      lines.push(
        [record.id, record.title, record.debugTitle, record.type].map(csvEscape).join(","),
      );
    }
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "project-ids.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">IDs</CardTitle>
            <CardDescription>
              Every row and choice id in document order — click any id to copy it. For wiring up
              requirements, buttons and "activated by" ids.
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={handleExport}
          >
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No rows yet. Add a row to see its id here.
          </p>
        ) : (
          <PaginatedList
            items={rows}
            getItemKey={(row) => row.id ?? `row-${row.index}`}
            pageSize={25}
            renderItem={(row) => (
              <RowNode
                key={row.id ?? `row-${row.index}`}
                row={row}
                open={openRows.has(row.id ?? "")}
                onToggle={() => toggleRow(row.id ?? "")}
              />
            )}
          />
        )}
      </CardContent>
    </Card>
  );
}
