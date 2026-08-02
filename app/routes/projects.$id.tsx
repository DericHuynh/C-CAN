import { Link, useParams, useSearchParams } from "react-router";
import { IconArrowLeft, IconEye, IconPencil } from "@tabler/icons-react";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { BackpackPanel } from "@/components/projects/BackpackPanel";
import { CategoriesPanel } from "@/components/projects/CategoriesPanel";
import { CustomCssPanel } from "@/components/projects/CustomCssPanel";
import { CyoaViewer } from "@/components/projects/CyoaViewer";
import { DesignGroupsPanel } from "@/components/projects/DesignGroupsPanel";
import { DesignPanel } from "@/components/projects/DesignPanel";
import { GroupPanel } from "@/components/projects/GroupPanel";
import { IdListPanel } from "@/components/projects/IdListPanel";
import { JsonPanel } from "@/components/projects/JsonPanel";
import { PointTypePanel } from "@/components/projects/PointTypePanel";
import { ProjectStatsPanel } from "@/components/projects/ProjectStatsPanel";
import { RequirementPanel } from "@/components/projects/RequirementPanel";
import { RowsPanel } from "@/components/projects/RowsPanel";
import { SettingsPanel } from "@/components/projects/SettingsPanel";
import { SoundEffectsPanel } from "@/components/projects/SoundEffectsPanel";
import { TemplatesPanel } from "@/components/projects/TemplatesPanel";
import { VariablesPanel } from "@/components/projects/VariablesPanel";
import { ViewerConfigPanel } from "@/components/projects/ViewerConfigPanel";
import { WordsPanel } from "@/components/projects/WordsPanel";
import { useProject } from "@/hooks/use-projects";
import { APP_TITLE } from "@/lib/app-config";

export function meta() {
  return [{ title: `Project Editor — ${APP_TITLE}` }];
}

export default function ProjectEditorRoute() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: project, isLoading, isError, refetch } = useProject(id);

  const mode =
    searchParams.get("mode") === "viewer" ? "viewer" : "editor";

  useSetPageTitle(
    project
      ? mode === "viewer"
        ? `View — ${project.title || "Untitled CYOA"}`
        : project.title || "Project Editor"
      : "Project Editor",
  );

  function handleModeChange(next: string) {
    if (!next || next === mode) return;
    setSearchParams(next === "viewer" ? { mode: "viewer" } : {}, {
      replace: true,
    });
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 lg:p-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Card>
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="mx-auto w-full max-w-5xl p-4 lg:p-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <p className="text-sm text-muted-foreground">
              Could not load this project. It may have been deleted.
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
              <Button type="button" variant="ghost" asChild>
                <Link to="/projects">Back to projects</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const title = project.title || "Untitled CYOA";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-ml-2 size-8 shrink-0 text-muted-foreground"
              asChild
            >
              <Link to="/projects" aria-label="Back to projects">
                <IconArrowLeft className="size-4" />
              </Link>
            </Button>
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {title}
            </h1>
          </div>
          {project.description ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {project.description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/projects">Projects</Link>
          </Button>
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={handleModeChange}
            variant="outline"
            size="sm"
            aria-label="Editor / viewer mode"
          >
            <ToggleGroupItem value="editor">
              <IconPencil />
              Editor
            </ToggleGroupItem>
            <ToggleGroupItem value="viewer">
              <IconEye />
              Viewer
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {mode === "viewer" ? (
        <div className="mx-auto w-full max-w-4xl">
          <CyoaViewer app={project.app} />
        </div>
      ) : (
        <Tabs defaultValue="rows">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="rows">Rows</TabsTrigger>
            <TabsTrigger value="points">Points</TabsTrigger>
            <TabsTrigger value="groups">Groups</TabsTrigger>
            <TabsTrigger value="requirements">Requirements</TabsTrigger>
            <TabsTrigger value="variables">Variables</TabsTrigger>
            <TabsTrigger value="words">Words</TabsTrigger>
            <TabsTrigger value="design-groups">Design Groups</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="backpack">Backpack</TabsTrigger>
            <TabsTrigger value="design">Design</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="sound-effects">Sound Effects</TabsTrigger>
            <TabsTrigger value="viewer-config">Viewer Config</TabsTrigger>
            <TabsTrigger value="custom-css">Custom CSS</TabsTrigger>
            <TabsTrigger value="stats">Stats</TabsTrigger>
            <TabsTrigger value="id-list">ID List</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>
          <TabsContent value="rows" className="mt-4">
            <RowsPanel project={project} />
          </TabsContent>
          <TabsContent value="points" className="mt-4">
            <PointTypePanel project={project} />
          </TabsContent>
          <TabsContent value="groups" className="mt-4">
            <GroupPanel project={project} />
          </TabsContent>
          <TabsContent value="requirements" className="mt-4">
            <RequirementPanel project={project} />
          </TabsContent>
          <TabsContent value="variables" className="mt-4">
            <VariablesPanel project={project} />
          </TabsContent>
          <TabsContent value="words" className="mt-4">
            <WordsPanel project={project} />
          </TabsContent>
          <TabsContent value="design-groups" className="mt-4">
            <DesignGroupsPanel project={project} />
          </TabsContent>
          <TabsContent value="categories" className="mt-4">
            <CategoriesPanel project={project} />
          </TabsContent>
          <TabsContent value="backpack" className="mt-4">
            <BackpackPanel project={project} />
          </TabsContent>
          <TabsContent value="design" className="mt-4">
            <DesignPanel project={project} />
          </TabsContent>
          <TabsContent value="templates" className="mt-4">
            <TemplatesPanel project={project} />
          </TabsContent>
          <TabsContent value="sound-effects" className="mt-4">
            <SoundEffectsPanel project={project} />
          </TabsContent>
          <TabsContent value="viewer-config" className="mt-4">
            <ViewerConfigPanel project={project} />
          </TabsContent>
          <TabsContent value="custom-css" className="mt-4">
            <CustomCssPanel project={project} />
          </TabsContent>
          <TabsContent value="stats" className="mt-4">
            <ProjectStatsPanel project={project} />
          </TabsContent>
          <TabsContent value="id-list" className="mt-4">
            <IdListPanel project={project} />
          </TabsContent>
          <TabsContent value="settings" className="mt-4">
            <SettingsPanel project={project} />
          </TabsContent>
          <TabsContent value="json" className="mt-4">
            <JsonPanel project={project} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
