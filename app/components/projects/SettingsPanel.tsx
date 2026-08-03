import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useUpdateProject,
  useUpdateProjectSettings,
  type ProjectDetail,
} from "@/hooks/use-projects";

interface SettingsPanelProps {
  project: ProjectDetail;
}

/**
 * Project-level settings. Project record fields (title, description) go
 * through `update-project`; document settings (viewer config, editor
 * defaults) go through `update-project-settings` with an arbitrary patch.
 */
export function SettingsPanel({ project }: SettingsPanelProps) {
  const app = project.app;
  const updateProject = useUpdateProject();
  const updateSettings = useUpdateProjectSettings();

  return (
    <div className="space-y-6">
      <ProjectDetailsCard
        project={project}
        busy={updateProject.isPending}
        onSave={(title, description) =>
          updateProject.mutate(
            { id: project.id, title, description },
            {
              onSuccess: () => toast.success("Project details saved"),
              onError: (err) =>
                toast.error(err instanceof Error ? err.message : "Failed to save project details"),
            },
          )
        }
      />

      <ViewerCard
        title={app.viewerConfig?.title ?? ""}
        busy={updateSettings.isPending}
        onSave={(title) =>
          updateSettings.mutate(
            {
              projectId: project.id,
              patch: {
                viewerConfig: {
                  ...(app.viewerConfig ?? {}),
                  title,
                },
              },
            },
            {
              onSuccess: () => toast.success("Viewer settings saved"),
              onError: (err) =>
                toast.error(err instanceof Error ? err.message : "Failed to save viewer settings"),
            },
          )
        }
      />

      <DefaultsCard
        defaults={{
          defaultRowTitle: app.defaultRowTitle ?? "",
          defaultChoiceTitle: app.defaultChoiceTitle ?? "",
          defaultBeforePoint: app.defaultBeforePoint ?? "",
          defaultAfterPoint: app.defaultAfterPoint ?? "",
        }}
        busy={updateSettings.isPending}
        onSave={(patch) =>
          updateSettings.mutate(
            { projectId: project.id, patch },
            {
              onSuccess: () => toast.success("Default settings saved"),
              onError: (err) =>
                toast.error(err instanceof Error ? err.message : "Failed to save default settings"),
            },
          )
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface ProjectDetailsCardProps {
  project: ProjectDetail;
  busy?: boolean;
  onSave: (title: string, description: string) => void;
}

function ProjectDetailsCard({ project, busy = false, onSave }: ProjectDetailsCardProps) {
  const [title, setTitle] = useState(project.title ?? "");
  const [description, setDescription] = useState(project.description ?? "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Project details</CardTitle>
        <CardDescription>How this project appears on the projects list.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="settings-title">Title</Label>
          <Input
            id="settings-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Untitled CYOA"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-description">Description</Label>
          <Input
            id="settings-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="A short summary of this CYOA"
          />
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => onSave(title, description)}
          >
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface ViewerCardProps {
  title: string;
  busy?: boolean;
  onSave: (title: string) => void;
}

function ViewerCard({ title, busy = false, onSave }: ViewerCardProps) {
  const [value, setValue] = useState(title);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Viewer</CardTitle>
        <CardDescription>The title shown to readers at the top of the play page.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="settings-viewer-title">Viewer title</Label>
          <Input
            id="settings-viewer-title"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Untitled CYOA"
          />
        </div>
        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={busy} onClick={() => onSave(value)}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface DefaultsCardProps {
  defaults: {
    defaultRowTitle: string;
    defaultChoiceTitle: string;
    defaultBeforePoint: string;
    defaultAfterPoint: string;
  };
  busy?: boolean;
  onSave: (patch: Record<string, unknown>) => void;
}

function DefaultsCard({ defaults, busy = false, onSave }: DefaultsCardProps) {
  const [defaultRowTitle, setDefaultRowTitle] = useState(defaults.defaultRowTitle);
  const [defaultChoiceTitle, setDefaultChoiceTitle] = useState(defaults.defaultChoiceTitle);
  const [defaultBeforePoint, setDefaultBeforePoint] = useState(defaults.defaultBeforePoint);
  const [defaultAfterPoint, setDefaultAfterPoint] = useState(defaults.defaultAfterPoint);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Defaults</CardTitle>
        <CardDescription>Templates used when creating new rows and choices.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settings-default-row">Default row title</Label>
            <Input
              id="settings-default-row"
              value={defaultRowTitle}
              onChange={(event) => setDefaultRowTitle(event.target.value)}
              placeholder="Row"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-default-choice">Default choice title</Label>
            <Input
              id="settings-default-choice"
              value={defaultChoiceTitle}
              onChange={(event) => setDefaultChoiceTitle(event.target.value)}
              placeholder="Choice"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-default-before">Default before text</Label>
            <Input
              id="settings-default-before"
              value={defaultBeforePoint}
              onChange={(event) => setDefaultBeforePoint(event.target.value)}
              placeholder="Cost:"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-default-after">Default after text</Label>
            <Input
              id="settings-default-after"
              value={defaultAfterPoint}
              onChange={(event) => setDefaultAfterPoint(event.target.value)}
              placeholder="points"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() =>
              onSave({
                defaultRowTitle,
                defaultChoiceTitle,
                defaultBeforePoint,
                defaultAfterPoint,
              })
            }
          >
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
