import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateProjectSettings, type ProjectDetail } from "@/hooks/use-projects";

interface CustomCssPanelProps {
  project: ProjectDetail;
}

/** CSS hooks the viewer exposes for custom styling. */
const CSS_HOOKS = [".row-{id}", ".choice-{id}", ".choice-enabled", ".choice-selected", ".addon"];

/**
 * Author custom CSS for the viewer. The applied value is injected into
 * `document.head` as `<style id="cyoa-custom-css">` so the author can
 * preview the effects live; the tag is torn down on unmount or when the
 * applied value changes.
 */
export function CustomCssPanel({ project }: CustomCssPanelProps) {
  const app = project.app;
  const updateSettings = useUpdateProjectSettings();

  const appliedCss = app.customCSS ?? "";
  const [text, setText] = useState(appliedCss);

  useEffect(() => {
    const style = document.createElement("style");
    style.id = "cyoa-custom-css";
    style.textContent = appliedCss;
    if (appliedCss) {
      document.head.appendChild(style);
    }
    return () => {
      document.getElementById("cyoa-custom-css")?.remove();
    };
  }, [appliedCss]);

  function handleApply() {
    updateSettings.mutate(
      { projectId: project.id, patch: { customCSS: text } },
      {
        onSuccess: () => toast.success("Custom CSS applied"),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to apply custom CSS"),
      },
    );
  }

  function handleClear() {
    setText("");
    updateSettings.mutate(
      { projectId: project.id, patch: { customCSS: "" } },
      {
        onSuccess: () => toast.success("Custom CSS cleared"),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to clear custom CSS"),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Custom CSS</CardTitle>
        <CardDescription>
          Raw CSS injected into the viewer. Applied styles preview live in the play page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          id="custom-css"
          rows={12}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={".row-abc123 .choice-enabled { … }"}
          className="font-mono text-xs"
          spellCheck={false}
        />
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>Hooks:</span>
          {CSS_HOOKS.map((hook) => (
            <code key={hook} className="rounded bg-muted px-1.5 py-0.5 font-mono">
              {hook}
            </code>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={updateSettings.isPending}
            onClick={handleClear}
          >
            Clear
          </Button>
          <Button type="button" size="sm" disabled={updateSettings.isPending} onClick={handleApply}>
            {updateSettings.isPending ? "Applying…" : "Apply CSS"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
