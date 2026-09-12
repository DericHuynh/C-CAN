import { Link, useParams } from "react-router";
import { useT } from "@agent-native/core/client/i18n";
import { IconArrowLeft, IconPlayerPlay, IconStar } from "@tabler/icons-react";
import { NotificationsBell } from "@agent-native/core/client/notifications";
import { Button } from "@/components/ui/button";
import { usePublication } from "./use-publications";
import { RatingPanel } from "./RatingPanel";
export default function PublicationPage() {
  const { id = "" } = useParams();
  const t = useT();
  const { data, error, isLoading, refetch } = usePublication(id);
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 pb-20 md:p-8">
      <div className="flex justify-between">
        <Button variant="ghost" asChild>
          <Link to="/explorer">
            <IconArrowLeft className="me-2 size-4" />
            {t("publishing.explorer")}
          </Link>
        </Button>
        <NotificationsBell />
      </div>
      {isLoading && <p role="status">{t("publishing.loading")}</p>}
      {error && (
        <div role="alert" className="space-y-3 rounded-xl border p-8">
          <p>{t("publishing.unavailable")}</p>
          <Button onClick={() => refetch()}>{t("publishing.retry")}</Button>
        </div>
      )}
      {data && (
        <>
          <section className="overflow-hidden rounded-xl border bg-card">
            {data.coverUrl && (
              <img className="max-h-80 w-full object-cover" src={data.coverUrl} alt="" />
            )}
            <div className="space-y-5 p-6 md:p-8">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded border px-2 py-1">
                  {t(`publishing.${data.contentRating}`)}
                </span>
                <span className="rounded border px-2 py-1">
                  {t("publishing.liveVersion", { version: data.version })}
                </span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">{data.title}</h1>
              <p className="text-sm text-muted-foreground">
                {t("publishing.by", { author: data.author })}
              </p>
              <p className="max-w-3xl whitespace-pre-wrap leading-relaxed text-muted-foreground">
                {data.description}
              </p>
              <div className="flex flex-wrap gap-2">
                {data.tags.map((tag) => (
                  <Link
                    to={`/explorer?content=${data.contentRating}&tag=${encodeURIComponent(tag)}`}
                    key={tag}
                    className="rounded-full bg-muted px-3 py-1 text-xs hover:text-sky-400"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-5">
                <Button size="lg" asChild>
                  <Link to={`/play/${data.id}`}>
                    <IconPlayerPlay className="me-2 size-4" />
                    {t("publishing.play")}
                  </Link>
                </Button>
                <span className="flex items-center gap-2">
                  <IconStar className="text-amber-400" />
                  {data.overall === null
                    ? t("publishing.unrated")
                    : `${data.overall.toFixed(1)} / 5`}{" "}
                  <span className="text-sm text-muted-foreground">{t("publishing.overall")}</span>
                </span>
              </div>
            </div>
          </section>
          <RatingPanel publication={data} onSaved={() => refetch()} />
        </>
      )}
    </div>
  );
}
