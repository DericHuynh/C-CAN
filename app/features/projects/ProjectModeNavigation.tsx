import { IconEye, IconPalette, IconPencil } from "@tabler/icons-react";
import { Link, useLocation } from "react-router";
import { projectPath, type ProjectMode } from "@shared/project-routes";
import { Button } from "@/components/ui/button";

export function ProjectModeNavigation({
  projectId,
  mode,
}: {
  projectId: string;
  mode: ProjectMode;
}) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.delete("mode");
  const query = params.toString();

  return (
    <nav aria-label="Editor / Visual editor / viewer mode" className="flex items-center gap-1">
      {(
        [
          ["editor", "Editor", IconPencil],
          ["veditor", "Visual editor", IconPalette],
          ["viewer", "Viewer", IconEye],
        ] as const
      ).map(([value, label, Icon]) => (
        <Button key={value} asChild variant={mode === value ? "secondary" : "outline"} size="sm">
          {/* Links can cancel a pending navigation even while the previous
              mode is still rendered, and retain normal open-in-new-tab behavior. */}
          <Link
            to={`${projectPath(projectId, value)}${query ? `?${query}` : ""}${location.hash}`}
            aria-current={mode === value ? "page" : undefined}
          >
            <Icon />
            {label}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
