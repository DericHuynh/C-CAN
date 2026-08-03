import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUpdateProjectSettings, type ProjectDetail } from "@/hooks/use-projects";
import { STYLE_TEMPLATE_NAMES, applyStyleTemplate } from "@shared/style-templates";

interface TemplatesPanelProps {
  project: ProjectDetail;
}

/**
 * Preset styling templates, ported from the original creator. Each template
 * merges over the current `app.styling` (it only overrides the keys it
 * contains), so existing values survive.
 */
export function TemplatesPanel({ project }: TemplatesPanelProps) {
  const updateSettings = useUpdateProjectSettings();

  function handleApply(index: number) {
    const name = STYLE_TEMPLATE_NAMES[index] ?? STYLE_TEMPLATE_NAMES[0];
    if (!window.confirm(`Replace current styling with ${name}?`)) return;
    updateSettings.mutate(
      {
        projectId: project.id,
        patch: { styling: applyStyleTemplate(project.app.styling, index) },
      },
      {
        onSuccess: () => toast.success("Template applied"),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to apply template"),
      },
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Style templates</CardTitle>
          <CardDescription>Preset looks ported from the original ICCPlus creator.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STYLE_TEMPLATE_NAMES.map((name, index) => (
              <Button
                key={name}
                type="button"
                variant="outline"
                className="h-auto flex-col gap-1 py-4"
                disabled={updateSettings.isPending}
                onClick={() => handleApply(index)}
              >
                <span className="text-sm font-medium">{name}</span>
                <span className="text-xs font-normal text-muted-foreground">Apply template</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Templates merge into your current styling — they only override the keys they include, so
        apply one and then fine-tune it in the Design tab.
      </p>
    </div>
  );
}
