import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { IconCopy, IconDownload } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectDetail } from "@/features/projects/use-projects";

interface JsonPanelProps {
  project: ProjectDetail;
}

function prettify(json: string | object | null | undefined): string {
  if (json == null) return "";
  if (typeof json === "string") {
    try {
      return JSON.stringify(JSON.parse(json), null, 2);
    } catch {
      return json;
    }
  }
  return JSON.stringify(json, null, 2);
}

export function JsonPanel({ project }: JsonPanelProps) {
  const [copied, setCopied] = useState(false);
  // get-project and export-project-json return the same saved App. Derive
  // this view from the live query so background edits also update exports.
  const jsonText = useMemo(() => prettify(project.app), [project.app]);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(jsonText);
      setCopied(true);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  function handleDownload() {
    const blob = new Blob([jsonText], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.title || "cyoa"}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success("Downloaded .json file");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">CYOA document (JSON)</CardTitle>
              <CardDescription className="mt-1">
                The full document as stored. Export it to back up or re-import the CYOA.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                <IconCopy className="mr-1.5 size-4" />
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button type="button" size="sm" onClick={handleDownload}>
                <IconDownload className="mr-1.5 size-4" />
                Download .json
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[60vh] overflow-auto rounded-md border border-border bg-muted/40 p-4 text-xs leading-5 text-foreground">
            {jsonText}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
