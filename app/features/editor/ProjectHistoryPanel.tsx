import { useState } from "react";
import {
  useCreateResourceVersion,
  useResourceVersions,
  useRestoreResourceVersion,
} from "@agent-native/core/client/history";
import { useT, useFormatters } from "@agent-native/core/client/i18n";
import { useShareQuery, type ShareButtonSharesResponse } from "@agent-native/core/client/sharing";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProjectDetail } from "@/features/projects/use-projects";

export function ProjectHistoryPanel({
  project,
  onRestored,
}: {
  project: ProjectDetail;
  onRestored: () => void;
}) {
  const t = useT();
  const { formatDate } = useFormatters();
  const resource = { resourceType: "project", resourceId: project.id };
  const versions = useResourceVersions({ ...resource, limit: 100 });
  const { query: access } = useShareQuery<ShareButtonSharesResponse>("project", project.id);
  const canEdit = ["owner", "admin", "editor"].includes(access.data?.role ?? "");
  const create = useCreateResourceVersion();
  const restore = useRestoreResourceVersion();
  const [title, setTitle] = useState("");
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const pending = create.isPending || restore.isPending;
  const onError = (error: Error) => toast.error(error.message);

  async function restoreSelected() {
    if (!restoreId) return;
    try {
      // Preserve current work before replacing it, using the same server-owned
      // snapshot action available to the agent. Never send the document body.
      await create.mutateAsync({ ...resource, title: t("projectHistory.beforeRestore") });
      await restore.mutateAsync({ id: restoreId });
      setRestoreId(null);
      await versions.refetch();
      onRestored();
      toast.success(t("projectHistory.restored"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("projectHistory.failed"));
    }
  }

  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("projectHistory.description")}</p>
      {canEdit && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate(
              { ...resource, title: title.trim() || undefined },
              {
                onSuccess: () => {
                  setTitle("");
                  void versions.refetch();
                  toast.success(t("projectHistory.saved"));
                },
                onError,
              },
            );
          }}
        >
          <Input
            className="max-w-sm"
            aria-label={t("projectHistory.name")}
            placeholder={t("projectHistory.name")}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Button type="submit" disabled={pending}>
            {t("projectHistory.save")}
          </Button>
        </form>
      )}
      {versions.isLoading ? (
        <p>{t("projectHistory.loading")}</p>
      ) : versions.isError ? (
        <div role="alert">
          <p>{t("projectHistory.failed")}</p>
          <Button variant="outline" onClick={() => void versions.refetch()}>
            {t("projectHistory.retry")}
          </Button>
        </div>
      ) : (
        <ul className="divide-y rounded-md border">
          {!versions.data?.versions.length && (
            <li className="p-4 text-sm text-muted-foreground">{t("projectHistory.empty")}</li>
          )}
          {versions.data?.versions.map((version) => (
            <li key={version.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium">{version.title || `#${version.versionNumber}`}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(version.createdAt)} · {version.actorKind}
                </p>
                {version.summary && <p className="text-sm">{version.summary}</p>}
              </div>
              {canEdit && (
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => setRestoreId(version.id)}
                >
                  {t("projectHistory.restore")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={!!restoreId}
        onOpenChange={(open) => {
          if (!open && !pending) setRestoreId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("projectHistory.restore")}</DialogTitle>
            <DialogDescription>{t("projectHistory.confirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setRestoreId(null)}>
              {t("projectHistory.cancel")}
            </Button>
            <Button disabled={pending} onClick={() => void restoreSelected()}>
              {t("projectHistory.restore")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
