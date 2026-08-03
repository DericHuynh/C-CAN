import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { IconArrowLeft, IconEye, IconPencil } from "@tabler/icons-react";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BackpackPanel } from "@/components/projects/BackpackPanel";
import { CategoriesPanel } from "@/components/projects/CategoriesPanel";
import { CustomCssPanel } from "@/components/projects/CustomCssPanel";
import { CyoaViewer } from "@/components/projects/CyoaViewer";
import { DesignGroupsPanel } from "@/components/projects/DesignGroupsPanel";
import { DesignPanel } from "@/components/projects/DesignPanel";
import { GroupPanel } from "@/components/projects/GroupPanel";
import { IdListPanel } from "@/components/projects/IdListPanel";
import { ImagesPanel } from "@/components/projects/ImagesPanel";
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

/** Editor tabs grouped into a two-level navigation. */
const TAB_GROUPS: { id: string; label: string; tabs: { value: string; label: string }[] }[] = [
  {
    id: "content",
    label: "Content",
    tabs: [
      { value: "rows", label: "Rows" },
      { value: "points", label: "Points" },
      { value: "groups", label: "Groups" },
      { value: "images", label: "Images" },
      { value: "requirements", label: "Requirements" },
      { value: "variables", label: "Variables" },
      { value: "words", label: "Words" },
    ],
  },
  {
    id: "design",
    label: "Design",
    tabs: [
      { value: "design-groups", label: "Design Groups" },
      { value: "categories", label: "Categories" },
      { value: "backpack", label: "Backpack" },
      { value: "design", label: "Design" },
      { value: "templates", label: "Templates" },
      { value: "sound-effects", label: "Sound Effects" },
    ],
  },
  {
    id: "viewer",
    label: "Viewer",
    tabs: [
      { value: "viewer-config", label: "Viewer Config" },
      { value: "custom-css", label: "Custom CSS" },
    ],
  },
  {
    id: "project",
    label: "Project",
    tabs: [
      { value: "stats", label: "Stats" },
      { value: "id-list", label: "ID List" },
      { value: "settings", label: "Settings" },
      { value: "json", label: "JSON" },
    ],
  },
];

export default function ProjectEditorRoute() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: project, isLoading, isError, refetch } = useProject(id);
  // Two-level nav: the active tab plus the group that owns it. Seeded from
  // ?tab= so individual editor tabs can be deep-linked.
  const [activeTab, setActiveTab] = useState(
    () =>
      TAB_GROUPS.flatMap((group) => group.tabs).find((tab) => tab.value === searchParams.get("tab"))
        ?.value ?? "rows",
  );
  const [tabGroup, setTabGroup] = useState(
    () =>
      TAB_GROUPS.find((group) => group.tabs.some((tab) => tab.value === activeTab))?.id ??
      "content",
  );

  const mode = searchParams.get("mode") === "viewer" ? "viewer" : "editor";

  useSetPageTitle(
    project
      ? mode === "viewer"
        ? `View — ${project.title || "Untitled CYOA"}`
        : project.title || "Project Editor"
      : "Project Editor",
  );

  const activeGroup = TAB_GROUPS.find((group) => group.id === tabGroup) ?? TAB_GROUPS[0];

  function handleModeChange(next: string) {
    if (!next || next === mode) return;
    setSearchParams(next === "viewer" ? { mode: "viewer" } : {}, {
      replace: true,
    });
  }

  function syncTabParam(tab: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tab === "rows") next.delete("tab");
        else next.set("tab", tab);
        return next;
      },
      { replace: true },
    );
  }

  function handleTabChange(value: string) {
    setActiveTab(value);
    syncTabParam(value);
  }

  function handleGroupChange(value: string) {
    if (!value || value === tabGroup) return;
    const group = TAB_GROUPS.find((g) => g.id === value);
    if (!group) return;
    setTabGroup(value);
    // If the active tab doesn't live in the newly selected group, fall back to
    // the group's first tab so the content never points at a hidden tab.
    if (!group.tabs.some((tab) => tab.value === activeTab)) {
      setActiveTab(group.tabs[0].value);
      syncTabParam(group.tabs[0].value);
    }
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
  const rowCount = project.app.rows?.length ?? 0;
  const choiceCount =
    project.app.rows?.reduce((sum, row) => sum + (row.objects?.length ?? 0), 0) ?? 0;

  return (
    <div className="mx-auto w-full space-y-6 p-4 lg:p-6">
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
            <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
          </div>
          {project.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
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

      {/* The original ICCPlus viewer renders full-page — give the embedded
          viewer the same breathing room so its columns match the author's
          breakpoints instead of being squeezed into a narrow column. */}
      {mode === "viewer" ? (
        <div className="w-full">
          <CyoaViewer app={project.app} />
        </div>
      ) : (
        <div className="space-y-3">
          <ToggleGroup
            type="single"
            value={tabGroup}
            onValueChange={handleGroupChange}
            variant="outline"
            size="sm"
            aria-label="Editor section"
            className="justify-start"
          >
            {TAB_GROUPS.map((group) => (
              <ToggleGroupItem key={group.id} value={group.id} className="gap-1.5">
                {group.label}
                {group.id === "content" ? (
                  <span className="text-muted-foreground">
                    · {rowCount} row{rowCount === 1 ? "" : "s"} · {choiceCount} choice
                    {choiceCount === 1 ? "" : "s"}
                  </span>
                ) : null}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
              {activeGroup.tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
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
            <TabsContent value="images" className="mt-4">
              <ImagesPanel project={project} />
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
        </div>
      )}
    </div>
  );
}
