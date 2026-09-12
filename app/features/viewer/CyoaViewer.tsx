import { PublishedNavigator } from "./PublishedNavigator";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerStop,
  IconVolume,
  IconVolumeOff,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { useT } from "@agent-native/core/client/i18n";
import { Button } from "@/components/ui/button";
import { useCyoa } from "@/features/viewer/use-cyoa";
import { cn } from "@/lib/utils";
import { backgroundOverrides, isEnabled } from "@shared/cyoa-engine";
import type { Choice } from "@shared/types";
import { resolveImageRef } from "@shared/cyoa";
import { rowWidthClass } from "./cyoa-styles";
import { ImagePreviewProvider, useViewerBackground } from "./ViewerImage";
import { ViewerSettingsDialog } from "./ViewerSettingsDialog";
import { ViewerNavigator, type ViewerNavigatorHandle } from "./ViewerNavigator";
import { focusViewerTarget } from "./viewer-feedback";
import type { ViewerTarget } from "@shared/viewer-feedback";
import { ViewerUploadDialog } from "./ViewerUploadDialog";
import {
  applyViewerPreferences,
  parseViewerPreferences,
  viewerPreferencesKey,
  type ViewerPreferences,
} from "./viewer-preferences";
import type { CyoaViewerProps } from "./types";
import type { ViewerSearchBarHandle } from "./ViewerSearchBar";
import { ViewerSearchBar } from "./ViewerSearchBar";
import { PointBar } from "./PointBar";
import { RowView } from "./RowView";
import { BackpackDialog } from "./BackpackDialog";
import { BuildFormDialog } from "./BuildFormDialog";
import { SaveLoadDialog } from "./SaveLoadDialog";
import { useViewerAudio } from "./useViewerAudio";

/**
 * Full-featured CYOA player with parity with the original ICCPlus viewer:
 * point bar, requirement gating (all 9 types), addons, multi-choice counters,
 * row buttons, result/group rows, variables, words, filters/styling, backpack,
 * build form with save/load slots, and search.
 */
export function CyoaViewer(props: CyoaViewerProps) {
  const [preferences, setPreferences] = useState<ViewerPreferences>({});
  useEffect(() => {
    try {
      setPreferences(
        parseViewerPreferences(JSON.parse(localStorage.getItem(viewerPreferencesKey()) || "{}")),
      );
    } catch {
      /* Storage may be unavailable. */
    }
  }, []);
  const app = useMemo(
    () => (props.editing ? props.app : applyViewerPreferences(props.app, preferences)),
    [props.app, props.editing, preferences],
  );
  const updatePreferences = (patch: ViewerPreferences | null) => {
    setPreferences((prev) => {
      const next = patch === null ? {} : parseViewerPreferences({ ...prev, ...patch });
      try {
        localStorage.setItem(viewerPreferencesKey(), JSON.stringify(next));
      } catch {
        /* Session preferences still apply. */
      }
      return next;
    });
  };
  return (
    <ImagePreviewProvider images={app.images ?? []} preload={app.preloadImages}>
      <CyoaViewerContent {...props} app={app} onPreferences={updatePreferences} />
    </ImagePreviewProvider>
  );
}

function CyoaViewerContent({
  app,
  projectId,
  documentRevision,
  previewBuildCode,
  published = false,
  onExitFullscreen,
  className,
  editing = false,
  selection = null,
  onSelect,
  onAction,
  editTarget = null,
  onStartEdit,
  onCommitEdit,
  onContextMenu,
  onPreferences,
}: CyoaViewerProps & { onPreferences: (value: ViewerPreferences | null) => void }) {
  const t = useT();
  const cyoa = useCyoa({ app, initialBuildCode: previewBuildCode });
  useEffect(() => {
    if (cyoa.storageError) toast.error(t("viewer.storageFailed"));
  }, [cyoa.storageError, t]);
  const [dialog, setDialog] = useState<"backpack" | "build" | "save" | "settings" | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const offeredUploads = useRef(new Set<string>());
  useEffect(() => {
    if (editing) return;
    for (const id of offeredUploads.current)
      if (!cyoa.state.activated.has(id)) offeredUploads.current.delete(id);
    if (uploadId) {
      if (!cyoa.state.activated.has(uploadId)) setUploadId(null);
      return;
    }
    for (const id of cyoa.state.activated.keys()) {
      if (
        cyoa.idx.choiceMap.get(id)?.choice.isImageUpload &&
        !cyoa.state.uploadedImages.has(id) &&
        !offeredUploads.current.has(id)
      ) {
        offeredUploads.current.add(id);
        setUploadId(id);
        break;
      }
    }
  }, [cyoa.state.activated, cyoa.state.uploadedImages, cyoa.idx, editing, uploadId]);
  cyoa.requestImage = setUploadId;
  const [fade, setFade] = useState<{ color: string; time: number } | null>(null);
  const searchBarRef = useRef<ViewerSearchBarHandle>(null);
  const navigatorRef = useRef<ViewerNavigatorHandle>(null);
  const jumpToTarget = (target: ViewerTarget) => {
    if (navigatorRef.current) navigatorRef.current.jump(target);
    else if (viewerRef.current) focusViewerTarget(viewerRef.current, target);
  };

  // The original ICCPlus viewer is full-page, so its breakpoints key off the
  // window width. This viewer can be embedded in narrower containers, so we
  // track the *container* width instead — the columns must collapse to fit
  // the space the viewer actually has (4-col -> 3/2/1 as the box narrows).
  const viewerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<number>(() =>
    typeof window === "undefined" ? 1280 : window.innerWidth,
  );

  useEffect(() => {
    const el = viewerRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      // SSR or very old browser: fall back to window width.
      const onResize = () => setViewport(window.innerWidth);
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewport(Math.round(entry.contentRect.width));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Loading overlay: shown on mount (and whenever viewerConfig changes),
  // faded out after a short delay. Simple timeout is fine (parity with the
  // original viewer's fixed loading screen).
  const [loadingStage, setLoadingStage] = useState<"hidden" | "shown" | "fading">("hidden");
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Re-run (and re-show) whenever the author's loading config changes.
    const config = app.viewerConfig;
    void config;
    setLoadingStage("shown");
    const fadeTimer = window.setTimeout(() => setLoadingStage("fading"), 800);
    const doneTimer = window.setTimeout(() => setLoadingStage("hidden"), 1300);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [app.viewerConfig]);

  // Inject the author's custom CSS into document.head while mounted.
  useEffect(() => {
    if (typeof window === "undefined" || !app.customCSS) return;
    const styleEl = document.createElement("style");
    styleEl.id = "cyoa-viewer-custom-css";
    styleEl.textContent = app.customCSS;
    document.head.appendChild(styleEl);
    return () => {
      styleEl.remove();
    };
  }, [app.customCSS]);

  useEffect(() => {
    const urls = new Set([
      ...(app.googleFonts ?? []).map(
        (font) =>
          `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replace(/%20/g, "+")}&display=swap`,
      ),
      ...(app.customFonts ?? []),
    ]);
    const links = [...urls].map((url) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
      return link;
    });
    return () => links.forEach((link) => link.remove());
  }, [app.googleFonts, app.customFonts]);

  // Trigger effects only for changed selections, rather than replaying
  // earlier choices every time any unrelated card changes.
  const fadeSelections = useRef(new Map<string, number>());
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const before = fadeSelections.current;
    fadeSelections.current = new Map(
      [...cyoa.state.activated].map(([id, value]) => [id, value.multiple]),
    );
    for (const [id, value] of cyoa.state.activated) {
      if (before.get(id) === value.multiple) continue;
      const choice = cyoa.idx.choiceMap.get(id)?.choice;
      if (!choice?.isFadeTransition) continue;
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      const duration = Math.max(
        0,
        Number(choice.fadeInTransitionTime ?? 250) + Number(choice.fadeOutTransitionTime ?? 250),
      );
      setFade({ color: choice.fadeTransitionColor ?? "#000000", time: duration / 1000 });
      fadeTimer.current = setTimeout(() => setFade(null), duration);
    }
  }, [cyoa.state.activated, cyoa.idx]);
  useEffect(
    () => () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    },
    [],
  );

  const {
    audioRef,
    isPlaying,
    setIsPlaying,
    isMuted,
    volume,
    trackTitle,
    hasBgm,
    handlePlayPause,
    handleStop,
    handleMuteToggle,
    handleVolumeChange,
  } = useViewerAudio(cyoa);

  // The missing-requirement cascade (auto-deselect when requirements become
  // unmet) runs synchronously inside `useCyoa`'s select/deselect flows — a
  // faithful port of the original viewer's `deselectMissingReq` — so there is
  // no reactive effect here.

  // The bar docks whenever the document has point types, a backpack, or
  // imported choices open — the original viewer shows the bar when point types
  // EXIST (hidden points are simply not rendered inside it), not only when one
  // is currently enabled.
  const pointBarIsOn =
    (app.pointTypes?.length ?? 0) > 0 ||
    (app.backpack?.length ?? 0) > 0 ||
    app.importedChoicesIsOpen;

  const showBackpackBtn =
    (app.backpack?.length ?? 0) > 0 &&
    (app.hideBackpackBtn === 0 ||
      app.hideBackpackBtn ===
        app.btnBackpackIsOn +
          [...cyoa.state.activated.keys()].filter(
            (id) => cyoa.idx.choiceMap.get(id)?.choice.backpackBtnRequirement,
          ).length);

  // Background overrides from active `changeBackground` choices.
  const bgOverrides = backgroundOverrides(cyoa.idx, cyoa.state);
  const viewerBackgroundColor =
    bgOverrides.color ?? ((app.styling?.backgroundColor as string) || undefined);
  const viewerBackgroundImage = useViewerBackground(
    resolveImageRef(
      app,
      bgOverrides.image ?? ((app.styling?.backgroundImage as string) || undefined),
    ),
  );

  // Scroll to a row/choice when a `scrollToRow`/`scrollToObject` choice is
  // freshly selected (mirrors the original `selectScroll`).
  const scrollSelections = useRef(new Set<string>());
  useEffect(() => {
    const before = scrollSelections.current;
    scrollSelections.current = new Set(cyoa.state.activated.keys());
    for (const [id] of cyoa.state.activated) {
      if (before.has(id)) continue;
      const cMap = cyoa.idx.choiceMap.get(id);
      const choice = cMap?.choice as
        | (Choice & {
            scrollToRow?: boolean;
            scrollToObject?: boolean;
            scrollRowId?: string;
            scrollObjectId?: string;
          })
        | undefined;
      if (choice?.scrollToRow) {
        const targetId =
          choice.scrollToObject && choice.scrollObjectId
            ? choice.scrollObjectId
            : choice.scrollRowId;
        if (targetId) {
          window.setTimeout(() => {
            const el = viewerRef.current?.querySelector(
              `[data-cyoa-row="${CSS.escape(targetId)}"], [data-cyoa-choice="${CSS.escape(targetId)}"]`,
            );
            el?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 50);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cyoa.state.activated]);

  return (
    <div
      ref={viewerRef}
      className={cn("cyoa-viewer", className)}
      style={{
        ...(app.useVW ? { fontSize: "0.835vw" } : undefined),
        backgroundColor: viewerBackgroundColor,
        backgroundImage: viewerBackgroundImage ? `url(${viewerBackgroundImage})` : undefined,
        backgroundSize: app.styling.isBackgroundRepeat
          ? undefined
          : app.styling.isBackgroundFitIn
            ? "100% 100%"
            : "cover",
        backgroundRepeat: app.styling.isBackgroundRepeat ? "repeat" : "no-repeat",
        backgroundAttachment: "fixed",
        backgroundPosition: "center",
      }}
    >
      {/* Hidden anchor for the YouTube iframe BGM player. */}
      <div
        id="bgm-player"
        aria-hidden="true"
        style={{
          position: "fixed",
          width: 0,
          height: 0,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      />
      {/* Loading overlay (original ICCPlus loading screen) */}
      {loadingStage !== "hidden" ? (
        <div
          className="pointer-events-none fixed inset-0 z-100 flex items-center justify-center"
          style={{
            backgroundColor: app.viewerConfig?.loadingBgColor || "#ffffff",
            backgroundImage: app.viewerConfig?.loadingBgImage
              ? `url(${resolveImageRef(app, app.viewerConfig.loadingBgImage)})`
              : undefined,
            backgroundSize: "100% 100%",
            opacity: loadingStage === "fading" ? 0 : 1,
            transition: "opacity 0.5s ease-out",
          }}
        >
          <div
            className="relative flex h-37.5 w-37.5 flex-col items-center justify-center rounded-full text-center"
            style={{
              border: `3px solid ${app.viewerConfig?.loadingTrackColor || "#3c3c3c"}`,
              color: app.viewerConfig?.loadingTextColor || "#000000",
              fontFamily: app.viewerConfig?.loadingTextFont || undefined,
              textShadow: app.viewerConfig?.loadingTextShadow
                ? `0 0 10px ${app.viewerConfig.loadingTextShadow}`
                : undefined,
              boxShadow: "0 0 20px rgba(0,0,0,0.5)",
              letterSpacing: "3px",
              textTransform: "uppercase",
            }}
          >
            <span
              className="pointer-events-none absolute -left-0.75 -top-0.75 h-[104%] w-[104%] animate-spin rounded-full border-[3px] border-transparent"
              style={{
                borderTopColor:
                  app.viewerConfig?.loadingCircleColor ||
                  app.viewerConfig?.loadingTrackColor ||
                  "#d5c999",
                borderRightColor:
                  app.viewerConfig?.loadingCircleColor ||
                  app.viewerConfig?.loadingTrackColor ||
                  "#d5c999",
                animationDuration: "2s",
              }}
            />
            <div className="max-w-30 px-2 text-lg">
              {app.viewerConfig?.loadingText || "Loading"}
            </div>
          </div>
        </div>
      ) : null}

      {/* Fade transition overlay */}
      {fade ? (
        <div
          className="pointer-events-none fixed inset-0 z-50"
          style={{ backgroundColor: fade.color }}
        />
      ) : null}

      {published ? (
        <PublishedNavigator ref={navigatorRef} rootRef={viewerRef} />
      ) : projectId ? (
        <ViewerNavigator
          ref={navigatorRef}
          projectId={projectId}
          documentRevision={documentRevision}
          cyoa={cyoa}
          rootRef={viewerRef}
        />
      ) : null}
      {app.enableSearch ? (
        <ViewerSearchBar ref={searchBarRef} cyoa={cyoa} onJump={jumpToTarget} />
      ) : null}

      {app.rows?.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No rows yet — edit the CYOA to add content.
          </p>
        </div>
      ) : (
        <div
          className="flex min-w-0 flex-wrap gap-y-6"
          onContextMenu={
            editing && onContextMenu
              ? (event) => {
                  event.preventDefault();
                  onContextMenu(null, event);
                }
              : undefined
          }
        >
          {/* Rows whose requirements are unmet are hidden entirely (the
              original viewer uses `display:none`). Filter them out here so
              their wrappers don't create flex gaps between visible rows. */}
          {(cyoa.idx.rows ?? app.rows ?? [])
            .filter((row) => isEnabled(row.requireds, cyoa.idx, cyoa.state))
            .map((row) => (
              <div
                key={row.id}
                data-cyoa-row={row.id}
                className={cn(rowWidthClass(row, app, viewport), "min-w-0")}
              >
                <RowView
                  cyoa={cyoa}
                  row={row}
                  viewport={viewport}
                  editing={editing}
                  selection={selection}
                  onSelect={onSelect}
                  onAction={onAction}
                  editTarget={editTarget}
                  onStartEdit={onStartEdit}
                  onCommitEdit={onCommitEdit}
                  onContextMenu={onContextMenu}
                />
              </div>
            ))}
        </div>
      )}

      {/* Action/point bar docks to the bottom of the scrollport (original
          viewer's bottom bar). It is the LAST child so `sticky bottom-0`
          pins it to the bottom edge from the start of the scroll. */}
      {pointBarIsOn || onExitFullscreen || (projectId && !published) ? (
        <PointBar
          app={app}
          cyoa={cyoa}
          onReview={projectId && !published ? () => navigatorRef.current?.review?.() : undefined}
          showBackpackBtn={pointBarIsOn && showBackpackBtn}
          showPoints={pointBarIsOn}
          onExitFullscreen={onExitFullscreen}
          onOpenBackpack={() => setDialog("backpack")}
          onOpenSearch={() => searchBarRef.current?.focus()}
          onOpenBuild={() => setDialog("build")}
          onOpenSave={() => setDialog("save")}
          onOpenSettings={() => setDialog("settings")}
          onClean={cyoa.clean}
        />
      ) : null}

      <>
        {dialog === "settings" ? (
          <ViewerSettingsDialog
            app={app}
            onClose={() => setDialog(null)}
            onChange={onPreferences}
            onReset={() => onPreferences(null)}
          />
        ) : null}
        {uploadId ? (
          <ViewerUploadDialog
            key={uploadId}
            initialImage={
              cyoa.state.uploadedImages.get(uploadId) ||
              resolveImageRef(app, cyoa.idx.choiceMap.get(uploadId)?.choice.image) ||
              ""
            }
            position={app.cropperPosition ?? 4}
            onClose={() => setUploadId(null)}
            onSave={(image) => cyoa.setUploadedImage(uploadId, image)}
          />
        ) : null}
        <BackpackDialog
          open={dialog === "backpack"}
          onOpenChange={(open) => setDialog(open ? "backpack" : null)}
          cyoa={cyoa}
          viewport={viewport}
        />
        <BuildFormDialog
          open={dialog === "build"}
          onOpenChange={(open) => setDialog(open ? "build" : null)}
          cyoa={cyoa}
        />
        <SaveLoadDialog
          open={dialog === "save"}
          onOpenChange={(open) => setDialog(open ? "save" : null)}
          cyoa={cyoa}
        />
      </>

      {/* Music player bar (fixed bottom, above the point bar) */}
      {app.showMusicPlayer ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 px-3 py-1.5 backdrop-blur supports-backdrop-filter:bg-background/75">
          <div className="mx-auto flex max-w-4xl items-center gap-2">
            <audio
              ref={audioRef}
              preload="metadata"
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            >
              <track kind="captions" src="" />
            </audio>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={!hasBgm}
              onClick={handlePlayPause}
              title={isPlaying ? "Pause" : "Play"}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <IconPlayerPause className="size-4" />
              ) : (
                <IconPlayerPlay className="size-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={!hasBgm}
              onClick={handleStop}
              title="Stop"
              aria-label="Stop"
            >
              <IconPlayerStop className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={handleMuteToggle}
              title={isMuted ? "Unmute" : "Mute"}
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <IconVolumeOff className="size-4" /> : <IconVolume className="size-4" />}
            </Button>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={volume}
              disabled={isMuted}
              onChange={(event) => handleVolumeChange(Number(event.target.value))}
              className="w-24 cursor-pointer disabled:cursor-not-allowed"
              aria-label="Volume"
            />
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {trackTitle || (hasBgm ? "BGM" : "No track")}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Project-wide search bar                                            */
/* ------------------------------------------------------------------ */
