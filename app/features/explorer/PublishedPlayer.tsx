import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useT } from "@agent-native/core/client/i18n";
import { IconArrowsMaximize, IconArrowLeft } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { usePublication } from "./use-publications";
const CyoaViewer = lazy(() =>
  import("@/features/viewer/CyoaViewer").then((module) => ({ default: module.CyoaViewer })),
);
export default function PublishedPlayer() {
  const { id = "" } = useParams();
  const t = useT();
  const { data, error, isLoading, refetch } = usePublication(id, true);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    update();
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  async function toggleFullscreen() {
    try {
      setFullscreenError(false);
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setFullscreenError(true);
    }
  }
  return (
    <div className="flex h-dvh min-w-0 flex-col bg-background text-foreground">
      {!fullscreen && (
        <header className="flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/explorer/${id}`}>
              <IconArrowLeft className="me-1 size-4" />
              {t("publishing.details")}
            </Link>
          </Button>
          <span className="min-w-0 truncate text-sm font-medium">
            {data?.title ?? t("publishing.loading")}
          </span>
          <Button variant="outline" size="sm" onClick={toggleFullscreen}>
            <IconArrowsMaximize className="size-4" />
            <span className="ms-2 hidden sm:inline">{t("publishing.fullscreen")}</span>
            <span className="sr-only sm:hidden">{t("publishing.fullscreen")}</span>
          </Button>
        </header>
      )}
      {fullscreenError && (
        <p role="status" className="px-4 py-2 text-sm">
          {t("publishing.fullscreenUnavailable")}
        </p>
      )}
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-published-player>
        {isLoading && (
          <p className="p-8" role="status">
            {t("publishing.loading")}
          </p>
        )}
        {error && (
          <div className="space-y-4 p-8" role="alert">
            <p>{t("publishing.unavailable")}</p>
            <Button onClick={() => refetch()}>{t("publishing.retry")}</Button>
          </div>
        )}
        {data?.app && (
          <Suspense
            fallback={
              <p className="p-8" role="status">
                {t("publishing.loading")}
              </p>
            }
          >
            <CyoaViewer
              key={`${id}:${data.version}`}
              app={data.app}
              published
              className={fullscreen ? "flex min-h-full flex-col" : undefined}
              onExitFullscreen={fullscreen ? toggleFullscreen : undefined}
            />
          </Suspense>
        )}
      </main>
    </div>
  );
}
