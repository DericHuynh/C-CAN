import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  IconCoins,
  IconCopy,
  IconDots,
  IconEye,
  IconList,
  IconPencil,
  IconTable,
  IconTrash,
} from "@tabler/icons-react";
import { appPath } from "@agent-native/core/client/api-path";
import { ShareButton } from "@agent-native/core/client/sharing";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteProject, useDuplicateProject, type ProjectSummary } from "@/hooks/use-projects";

import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { formatDate } from "./project-utils";

interface ProjectCardProps {
  project: ProjectSummary;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const duplicateProject = useDuplicateProject();
  const deleteProject = useDeleteProject();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const title = project.title || "Untitled CYOA";
  const projectPath = `/projects/${encodeURIComponent(project.id)}/editor`;
  const viewPath = `/projects/${encodeURIComponent(project.id)}/viewer`;
  const absoluteViewUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${appPath(viewPath)}`
      : appPath(viewPath);

  function handleDuplicate() {
    duplicateProject.mutate(
      { id: project.id },
      {
        onSuccess: () => toast.success("Project duplicated"),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to duplicate project"),
      },
    );
  }

  function handleDelete() {
    deleteProject.mutate(
      { id: project.id },
      {
        onSuccess: () => {
          toast.success("Project deleted");
          setDeleteOpen(false);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to delete project");
          setDeleteOpen(false);
        },
      },
    );
  }

  return (
    <Card className="flex flex-col overflow-hidden transition-colors hover:border-muted-foreground/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-2 text-base leading-snug">{title}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="-mt-1 -mr-2 size-8 shrink-0 text-muted-foreground"
                aria-label={`Actions for ${title}`}
              >
                <IconDots className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={duplicateProject.isPending} onSelect={handleDuplicate}>
                <IconCopy className="mr-2 size-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setDeleteOpen(true)}
              >
                <IconTrash className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2">
          {project.isSeed ? (
            <Badge variant="outline" className="text-[10px]">
              Sample
            </Badge>
          ) : null}
        </div>
        {project.description ? (
          <CardDescription className="line-clamp-2">{project.description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <IconTable className="size-3.5" />
            {project.rowCount} rows
          </span>
          <span className="flex items-center gap-1.5">
            <IconList className="size-3.5" />
            {project.choiceCount} choices
          </span>
          <span className="flex items-center gap-1.5">
            <IconCoins className="size-3.5" />
            {project.pointTypeCount} points
          </span>
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            Updated {formatDate(project.updatedAt)}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <ShareButton
              resourceType="project"
              resourceId={project.id}
              resourceTitle={title}
              trigger="icon"
              shareUrl={absoluteViewUrl}
              shareUrlLabel="Playable viewer link"
            />
            <Button size="sm" variant="outline" asChild>
              <Link to={viewPath}>
                <IconEye className="mr-1.5 size-3.5" />
                View
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link to={projectPath}>
                <IconPencil className="mr-1.5 size-3.5" />
                Edit
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete "${title}"?`}
        description="This permanently deletes the project and its CYOA document. This action cannot be undone."
        busy={deleteProject.isPending}
        onConfirm={handleDelete}
      />
    </Card>
  );
}
