import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { IconFileImport, IconPlus } from "@tabler/icons-react";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ImportJsonDialog } from "@/features/projects/ImportJsonDialog";
import { ProjectCard } from "@/features/projects/ProjectCard";
import { extractProjectId, useCreateProject, useProjects } from "@/features/projects/use-projects";
import { APP_TITLE } from "@/lib/app-config";

export function meta() {
  return [{ title: `CYOA Projects — ${APP_TITLE}` }];
}

export default function ProjectsIndexRoute() {
  useSetPageTitle("CYOA Projects");
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useProjects();
  const createProject = useCreateProject();
  const [importOpen, setImportOpen] = useState(false);

  function handleNewProject() {
    if (createProject.isPending) return;
    createProject.mutate(
      {},
      {
        onSuccess: (result) => {
          toast.success("Project created");
          const id = extractProjectId(result);
          if (id) {
            navigate(`/projects/${encodeURIComponent(id)}/editor`);
          }
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to create project"),
      },
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CYOA Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Build and play interactive choose-your-own-adventure stories.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
            <IconFileImport className="mr-1.5 size-4" />
            Import JSON
          </Button>
          <Button type="button" onClick={handleNewProject} disabled={createProject.isPending}>
            <IconPlus className="mr-1.5 size-4" />
            {createProject.isPending ? "Creating…" : "New CYOA"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="space-y-3 p-5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError || !data ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Could not load projects. Please try again.
            </p>
            <Button type="button" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : data.projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-base font-medium">No projects yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Create your first CYOA to start adding rows and choices, or import an existing
              document from JSON.
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" onClick={handleNewProject} disabled={createProject.isPending}>
                <IconPlus className="mr-1.5 size-4" />
                {createProject.isPending ? "Creating…" : "New CYOA"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
                Import JSON
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      <ImportJsonDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
