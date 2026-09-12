import { TagInput } from "@/features/tags/TagInput";
import { useState } from "react";
import { useT } from "@agent-native/core/client/i18n";
import { useSession } from "@agent-native/core/client/hooks";
import { appPath } from "@agent-native/core/client/api-path";
import { Link } from "react-router";
import { IconWorldUpload, IconLink } from "@tabler/icons-react";
import { toast } from "sonner";
import type { ProjectDetail } from "@shared/project-contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { usePublicationStatus, usePublishProject, useUnpublishProject } from "./use-publications";

export function PublishDialog({ project }: { project: ProjectDetail }) {
  const t = useT();
  const { session } = useSession();
  const status = usePublicationStatus(project.id);
  const [open, setOpen] = useState(false);
  if (!session || !status.data?.canPublish) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        onClick={() => {
          void status.refetch();
          setOpen(true);
        }}
      >
        <IconWorldUpload className="me-1.5 size-4" />
        {t("publishing.publish")}
      </Button>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("publishing.publishTitle")}</DialogTitle>
          <DialogDescription>{t("publishing.publishHint")}</DialogDescription>
        </DialogHeader>
        {open && (
          <PublishForm
            key={status.data.publication?.updatedAt ?? "new"}
            project={project}
            author={session.name || ""}
            status={status.data}
            onSaved={() => status.refetch()}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
function PublishForm({
  project,
  author,
  status,
  onSaved,
}: {
  project: ProjectDetail;
  author: string;
  status: NonNullable<ReturnType<typeof usePublicationStatus>["data"]>;
  onSaved: () => unknown;
}) {
  const t = useT();
  const release = status.publication;
  const [title, setTitle] = useState(release?.title ?? project.title);
  const [description, setDescription] = useState(release?.description ?? project.description);
  const [byline, setByline] = useState(release?.author ?? author);
  const [tags, setTags] = useState<string[]>(release?.tags ?? []);
  const [contentRating, setContentRating] = useState<"sfw" | "nsfw">(
    release?.contentRating ?? "sfw",
  );
  const [coverImageId, setCoverImageId] = useState(release?.coverImageId ?? "");
  const [error, setError] = useState("");
  const publish = usePublishProject(),
    unpublish = useUnpublishProject();
  const busy = publish.isPending || unpublish.isPending;
  const live = release?.status === "published";
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await publish.mutateAsync({
        projectId: project.id,
        title,
        description,
        author: byline,
        tags,
        contentRating,
        coverImageId,
      });
      toast.success(t("publishing.published"));
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : t("publishing.saveFailed"));
    }
  }
  async function withdraw() {
    setError("");
    try {
      await unpublish.mutateAsync({ projectId: project.id });
      toast.success(t("publishing.withdrawn"));
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : t("publishing.saveFailed"));
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      {live && (
        <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
          <p>{t("publishing.liveVersion", { version: release.version })}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to={`/play/${project.id}`} target="_blank">
                {t("publishing.openRelease")}
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    new URL(appPath(`/play/${project.id}`), window.location.origin).href,
                  );
                  toast.success(t("publishing.copied"));
                } catch {
                  setError(t("publishing.copyFailed"));
                }
              }}
            >
              <IconLink className="me-1 size-4" />
              {t("publishing.copyLink")}
            </Button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="release-title">{t("publishing.title")}</Label>
        <Input
          id="release-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={160}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="release-author">{t("publishing.author")}</Label>
        <Input
          id="release-author"
          value={byline}
          onChange={(e) => setByline(e.target.value)}
          maxLength={100}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="release-description">{t("publishing.description")}</Label>
        <Textarea
          id="release-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
        />
      </div>
      <div className="space-y-2">
        <TagInput
          id="release-tags"
          label={t("publishing.tags")}
          value={tags}
          onChange={setTags}
          max={12}
        />
        <p id="release-tags-help" className="text-xs text-muted-foreground">
          {t("publishing.tagsHint")}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="release-content">{t("publishing.contentFilter")}</Label>
          <select
            id="release-content"
            className="w-full rounded-md border bg-background p-2"
            value={contentRating}
            onChange={(e) => setContentRating(e.target.value as "sfw" | "nsfw")}
          >
            <option value="sfw">{t("publishing.sfw")}</option>
            <option value="nsfw">{t("publishing.nsfw")}</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="release-cover">{t("publishing.cover")}</Label>
          <select
            id="release-cover"
            className="w-full rounded-md border bg-background p-2"
            value={coverImageId}
            onChange={(e) => setCoverImageId(e.target.value)}
          >
            <option value="">{t("publishing.noCover")}</option>
            {project.app.images.map((image) => (
              <option key={image.id} value={image.id}>
                {image.name || image.id}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t("publishing.publicNotice")}
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-between gap-2 border-t pt-4">
        {live ? (
          <Button type="button" variant="outline" onClick={withdraw} disabled={busy}>
            {t("publishing.withdraw")}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={busy}>
          {busy
            ? t("publishing.saving")
            : live
              ? t("publishing.updateRelease")
              : t("publishing.publishNow")}
        </Button>
      </div>
    </form>
  );
}
