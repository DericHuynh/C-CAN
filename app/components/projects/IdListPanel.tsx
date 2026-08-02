import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ProjectDetail } from "@/hooks/use-projects";
import type { App, Row } from "@shared/types";

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

/**
 * Read-only reference of every row and choice id. Useful for wiring up
 * requirements, buttons and "activated by" ids. Exports the same listing as
 * a CSV file with a UTF-8 BOM so Excel opens it correctly.
 */
export function IdListPanel({ project }: IdListPanelProps) {
  const app = project.app;
  const rows = allRows(app);

  function handleExport() {
    const lines = ["id,title,debugTitle,type"];
    for (const record of csvRecords(app)) {
      lines.push(
        [record.id, record.title, record.debugTitle, record.type]
          .map(csvEscape)
          .join(","),
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
              Every row and choice id in document order, for wiring up
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
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No rows yet. Add a row to see its id here.
          </p>
        ) : (
          rows.map((row) => (
            <div key={row.id ?? `row-${row.index}`} className="space-y-1.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  {row.id}
                </code>
                {row.debugTitle ? (
                  <span className="font-mono text-xs text-muted-foreground">
                    {row.debugTitle}
                  </span>
                ) : null}
                <span className="text-sm font-medium">
                  {row.title || "Untitled row"}
                </span>
              </div>
              <ul className="ml-5 space-y-1 border-l border-border pl-3">
                {(row.objects ?? []).map((choice) => (
                  <li
                    key={choice.id ?? `choice-${choice.index}`}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
                  >
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {choice.id}
                    </code>
                    <span className="text-sm text-muted-foreground">
                      {choice.title || "Untitled choice"}
                    </span>
                  </li>
                ))}
                {(row.objects ?? []).length === 0 ? (
                  <li className="text-xs text-muted-foreground">
                    No choices
                  </li>
                ) : null}
              </ul>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
