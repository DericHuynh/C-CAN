import { EditorProjectProvider } from "@/features/editor/EditorProjectContext";
import { PublishDialog } from "@/features/explorer/PublishDialog";
import { Suspense, lazy, useEffect, useRef } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { NotificationsBell } from "@agent-native/core/client/notifications";
import { ProjectPresence } from "./ProjectPresence";
import { DraftConflictNotice } from "@/features/editor/DraftCollaboration";
import { RunsTray } from "@agent-native/core/client/progress";
import { projectMode, projectPath } from "@shared/project-routes";
import { IconArrowLeft, IconSparkles } from "@tabler/icons-react";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell";
import { useSendToAgentChat } from "@agent-native/core/client/agent-chat";
import { appPath } from "@agent-native/core/client/api-path";
import { ShareButton } from "@agent-native/core/client/sharing";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useT } from "@agent-native/core/client/i18n";
import { useProject } from "@/features/projects/use-projects";
import { APP_TITLE } from "@/lib/app-config";
import { cn } from "@/lib/utils";

import { TAB_GROUPS } from "@/features/editor/editor-tabs";
import { EditorPanels } from "@/features/editor/EditorPanels";
import { ProjectModeNavigation } from "./ProjectModeNavigation";

const CyoaViewer = lazy(() =>
  import("@/components/editor/LiveCyoaViewer").then(({ CyoaViewer }) => ({ default: CyoaViewer })),
);
const VisualEditor = lazy(() =>
  import("@/features/editor/VisualEditor").then(({ VisualEditor }) => ({ default: VisualEditor })),
);

export function meta() {
  return [{ title: `Project Editor — ${APP_TITLE}` }];
}

export default function ProjectEditorRoute() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const { mode: modeResource } = useParams<{ mode: string }>();
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
    <EditorProjectProvider key={project.id} project={project}>
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
            <ProjectPresence projectId={project.id} />
            <NotificationsBell />
            <ShareButton
              resourceType="project"
              resourceId={project.id}
              resourceTitle={project.title || "Untitled CYOA"}
              trigger="label-icon"
              shareUrl={viewerUrl}
              shareUrlLabel="Playable viewer link"
            />
            <PublishDialog project={project} />
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
            <ProjectModeNavigation projectId={project.id} mode={mode} />
          </div>
        </div>

        <DraftConflictNotice />
        {/* The original ICCPlus viewer renders full-page — give the embedded
          viewer the same breathing room so its columns match the author's
          breakpoints instead of being squeezed into a narrow column. */}
        <Suspense
          fallback={
            <div role="status" aria-label={t("common.loading")} className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          }
        >
          {mode === "viewer" ? (
            <div className="w-full">
              <CyoaViewer
                key={
                  searchParams.has("buildCode")
                    ? (searchParams.get("preview") ?? project.id)
                    : project.id
                }
                previewBuildCode={
                  searchParams.has("preview")
                    ? (searchParams.get("buildCode") ?? undefined)
                    : undefined
                }
                app={project.app}
                projectId={project.id}
                documentRevision={project.revision}
              />
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
                      {tab.value === "history"
                        ? t("projectHistory.tab")
                        : tab.value === "review"
                          ? t("projectHistory.review")
                          : tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <Suspense
                  fallback={
                    <div role="status" aria-label={t("common.loading")} className="mt-4 space-y-3">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-64 w-full" />
                    </div>
                  }
                >
                  <EditorPanels project={project} onRestored={() => void refetch()} />
                </Suspense>
              </Tabs>
            </div>
          )}
        </Suspense>
        {codeRequiredDialog}
      </div>
    </EditorProjectProvider>
  );
}
