import { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { NotificationsBell } from "@agent-native/core/client/notifications";
import { RunsTray } from "@agent-native/core/client/progress";
import { projectMode, projectPath } from "@shared/project-routes";
import { IconArrowLeft, IconEye, IconPalette, IconPencil, IconSparkles } from "@tabler/icons-react";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell";
import { useSendToAgentChat } from "@agent-native/core/client/agent-chat";
import { appPath } from "@agent-native/core/client/api-path";
import { ShareButton } from "@agent-native/core/client/sharing";

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
import { PlanningPanel } from "@/components/projects/PlanningPanel";
import { ProjectHistoryPanel } from "@/components/projects/ProjectHistoryPanel";
import { ProjectReviewPanel } from "@/components/projects/ProjectReviewPanel";
import { useT } from "@agent-native/core/client/i18n";
import { RowsPanel } from "@/components/projects/RowsPanel";
import { SettingsPanel } from "@/components/projects/SettingsPanel";
import { SoundEffectsPanel } from "@/components/projects/SoundEffectsPanel";
import { TemplatesPanel } from "@/components/projects/TemplatesPanel";
import { VariablesPanel } from "@/components/projects/VariablesPanel";
import { ViewerConfigPanel } from "@/components/projects/ViewerConfigPanel";
import { VisualEditor } from "@/components/projects/VisualEditor";
import { WordsPanel } from "@/components/projects/WordsPanel";
import { useProject } from "@/hooks/use-projects";
import { APP_TITLE } from "@/lib/app-config";
import { cn } from "@/lib/utils";

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
      { value: "plan", label: "Plan" },
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
      { value: "history", label: "History" },
      { value: "review", label: "Review" },
      { value: "id-list", label: "ID List" },
      { value: "settings", label: "Settings" },
      { value: "json", label: "JSON" },
    ],
  },
];

export default function ProjectEditorRoute() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const { mode: modeResource } = useParams<{ mode: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: project, isLoading, isError, error, refetch } = useProject(id);
  // Hand the current project off to the in-app agent (drop-in agent surface).
  const { send: sendToAgentChat, isGenerating, codeRequiredDialog } = useSendToAgentChat();
  // The URL is the source of truth, including browser history and agent navigation.
  const activeTab =
    TAB_GROUPS.flatMap((group) => group.tabs).find((tab) => tab.value === searchParams.get("tab"))
      ?.value ?? "rows";
  const activeGroup =
    TAB_GROUPS.find((group) => group.tabs.some((tab) => tab.value === activeTab)) ?? TAB_GROUPS[0];
  const tabGroup = activeGroup.id;
  const requestedTab = useRef(activeTab);
  useEffect(() => {
    requestedTab.current = activeTab;
  }, [activeTab]);

  const mode = projectMode(modeResource);

  useSetPageTitle(
    project
      ? mode === "viewer"
        ? `View — ${project.title || "Untitled CYOA"}`
        : mode === "veditor"
          ? `Visual editor — ${project.title || "Untitled CYOA"}`
          : project.title || "Project Editor"
      : "Project Editor",
  );

  function handleModeChange(next: string) {
    if (!next || next === mode) return;
    const params = new URLSearchParams(searchParams);
    params.delete("mode");
    const query = params.toString();
    navigate(`${projectPath(id!, next)}${query ? `?${query}` : ""}${location.hash}`);
  }

  function syncTabParam(tab: string) {
    // Radix can request the same tab on both pointer-down and focus before
    // the router commits. Add only one history entry for that interaction.
    if (requestedTab.current === tab) return;
    requestedTab.current = tab;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === "rows") next.delete("tab");
      else next.set("tab", tab);
      return next;
    });
  }

  function handleTabChange(value: string) {
    syncTabParam(value);
  }

  function handleGroupChange(value: string) {
    if (!value || value === tabGroup) return;
    const group = TAB_GROUPS.find((g) => g.id === value);
    if (!group) return;
    // If the active tab doesn't live in the newly selected group, fall back to
    // the group's first tab so the content never points at a hidden tab.
    if (!group.tabs.some((tab) => tab.value === activeTab)) {
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
    const status = (error as { status?: number } | null | undefined)?.status;
    const noAccess = status === 401 || status === 403;
    return (
      <div className="mx-auto w-full max-w-5xl p-4 lg:p-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <p className="text-sm text-muted-foreground">
              {noAccess
                ? "You don't have access to this project. Ask its owner to share it with you."
                : status === 404
                  ? "Project not found. It may have been deleted, or the link is incorrect."
                  : "Could not load this project. Please try again."}
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
  const viewerUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${appPath(projectPath(project.id, "viewer"))}`;

  return (
    <div
      className={cn(
        "mx-auto w-full space-y-6 p-4 lg:p-6",
        mode === "veditor" &&
          "xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:gap-6 xl:space-y-0 xl:overflow-hidden",
      )}
    >
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
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
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <RunsTray />
          <NotificationsBell />
          <ShareButton
            resourceType="project"
            resourceId={project.id}
            resourceTitle={project.title || "Untitled CYOA"}
            trigger="label-icon"
            shareUrl={viewerUrl}
            shareUrlLabel="Playable viewer link"
          />
          <Button
            type="button"
            variant="outline"
            disabled={isGenerating}
            onClick={() =>
              sendToAgentChat({
                message: "Work on this CYOA project",
                context: `Project id: ${project.id}\nTitle: ${project.title ?? "Untitled"}\nCurrent editor tab: ${activeTab}\nSelected row: ${searchParams.get("rowId") ?? "none"}\nSelected choice: ${searchParams.get("choiceId") ?? "none"}\nSelected addon: ${searchParams.get("addonId") ?? "none"}\nPlanning tools: get-project-plan and update-planning-entry. Read the current draft and revision before writing.`,
                submit: true,
              })
            }
          >
            <IconSparkles className="mr-1.5 size-4" />
            {isGenerating ? "Sending…" : "Ask agent"}
          </Button>
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={handleModeChange}
            variant="outline"
            size="sm"
            aria-label="Editor / Visual editor / viewer mode"
          >
            <ToggleGroupItem value="editor">
              <IconPencil />
              Editor
            </ToggleGroupItem>
            <ToggleGroupItem value="veditor">
              <IconPalette />
              Visual editor
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
          <CyoaViewer app={project.app} projectId={project.id} />
        </div>
      ) : mode === "veditor" ? (
        <VisualEditor project={project} />
      ) : (
        <div className="space-y-3">
          <ToggleGroup
            type="single"
            value={tabGroup}
            onValueChange={handleGroupChange}
            variant="outline"
            size="sm"
            aria-label="Editor section"
            className="h-auto flex-wrap justify-start"
          >
            {TAB_GROUPS.map((group) => (
              <ToggleGroupItem key={group.id} value={group.id} className="gap-1.5">
                {group.label}
                {group.id === "content" ? (
                  <span className="hidden text-muted-foreground sm:inline">
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
                  {tab.value === "plan"
                    ? t("planning.tab")
                    : tab.value === "history"
                      ? t("projectHistory.tab")
                      : tab.value === "review"
                        ? t("projectHistory.review")
                        : tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="rows" className="mt-4">
              <RowsPanel project={project} />
            </TabsContent>
            <TabsContent value="plan" className="mt-4">
              <PlanningPanel project={project} />
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
            <TabsContent value="history" className="mt-4">
              <ProjectHistoryPanel
                key={project.id}
                project={project}
                onRestored={() => void refetch()}
              />
            </TabsContent>
            <TabsContent value="review" className="mt-4">
              <ProjectReviewPanel key={project.id} project={project} />
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
      {codeRequiredDialog}
    </div>
  );
}
