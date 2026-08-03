import {
  Fragment,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Ref,
} from "react";
import {
  IconBackpack,
  IconDownload,
  IconMenu2,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerStop,
  IconSearch,
  IconUpload,
  IconVolume,
  IconVolumeOff,
} from "@tabler/icons-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BUILD_SLOT_NAMES, useCyoa, type UseCyoaResult } from "@/hooks/use-cyoa";
import { cn } from "@/lib/utils";
import {
  backgroundOverrides,
  checkActivated,
  checkPointEnable,
  checkReq,
  checkRequirements,
  computeScoreNet,
  effectiveWidth,
  encodeBuildCode,
  getProjectSearchEntries,
  groupRowChoices,
  hiddenContentsFor,
  isEnabled,
  isRowButtonDisabled,
  pointBarOverrides,
  replaceText,
  resultRowChoices,
  scoreDiscountDisplay,
  type CyoaIndex,
  type CyoaState,
  type ProjectSearchEntry,
  type ProjectSearchType,
} from "@shared/cyoa-engine";
import type {
  Addon,
  App,
  Choice,
  NonSelectableAddon,
  PointType,
  Requireds,
  Row,
  Score,
  SelectableAddon,
} from "@shared/types";
import { getStyling } from "@shared/cyoa-styling";
import { resolveImageRef } from "@shared/cyoa";

import {
  choiceMargin,
  choiceSurfaceStyle,
  choiceWidthClass,
  formatPointValue,
  imageStyle,
  isChoiceShown,
  numValue,
  renderHtml,
  resolveChoiceImage,
  rowButtonStyle,
  rowSurfaceStyle,
  rowWidthClass,
  sanitizeHtml,
  templateClasses,
  textStyle,
  viewerTemplate,
} from "./cyoa-styles";
import { sortedChoices } from "./project-utils";

/** Choice column width honoring runtime `changeWidth` overrides. */
function effectiveChoiceWidth(
  row: Row,
  choice: Choice,
  cyoa: UseCyoaResult,
  viewport: number,
): string {
  const rowW = effectiveWidth(row, true, cyoa.idx, cyoa.state);
  const choiceW = effectiveWidth(choice, false, cyoa.idx, cyoa.state);
  const effRow = rowW === row.objectWidth ? row : { ...row, objectWidth: rowW };
  const effChoice = choiceW === choice.objectWidth ? choice : { ...choice, objectWidth: choiceW };
  return choiceWidthClass(effRow, effChoice, cyoa.app, viewport);
}

interface CyoaViewerProps {
  app: App;
  className?: string;
}

/**
 * Full-featured CYOA player with parity with the original ICCPlus viewer:
 * point bar, requirement gating (all 9 types), addons, multi-choice counters,
 * row buttons, result/group rows, variables, words, filters/styling, backpack,
 * build form with save/load slots, and search.
 */
export function CyoaViewer({ app, className }: CyoaViewerProps) {
  const cyoa = useCyoa({ app });
  const [dialog, setDialog] = useState<"backpack" | "build" | "save" | null>(null);
  const [fade, setFade] = useState<{ color: string; time: number } | null>(null);
  const searchBarRef = useRef<ViewerSearchBarHandle>(null);

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
      document.getElementById("cyoa-viewer-custom-css")?.remove();
    };
  }, [app.customCSS]);

  // Fade transition overlay when a choice with isFadeTransition is selected.
  const lastSelection = useRef<Choice | null>(null);
  useEffect(() => {
    // Detect a fresh selection carrying a fade transition.
    for (const [id] of cyoa.state.activated) {
      if (lastSelection.current && lastSelection.current.id === id) continue;
      const cMap = cyoa.idx.choiceMap.get(id);
      const choice = cMap?.choice as
        | (Choice & {
            isFadeTransition?: boolean;
            fadeTransitionColor?: string;
            fadeTransitionTime?: number;
          })
        | undefined;
      if (choice?.isFadeTransition) {
        lastSelection.current = choice as Choice;
        setFade({
          color: choice.fadeTransitionColor ?? "#000000",
          time: choice.fadeTransitionTime ?? 1,
        });
        const timer = setTimeout(() => setFade(null), (choice.fadeTransitionTime ?? 1) * 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [cyoa.state.activated]);

  // ---------------------------------------------------------------------
  // BGM / music player
  // ---------------------------------------------------------------------
  // A fresh selection with `setBgmIsOn` + `bgmId` starts that track. Audio
  // URLs play through a single <audio> element; YouTube ids play through a
  // hidden YouTube IFrame player (parity with the original's `bgmPlayer`).
  // Volume ramps handle bgmFadeIn / bgmFadeOut.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<{ player: any; videoId: string } | null>(null);
  const fadeIntervalRef = useRef<number | null>(null);
  const mutedRef = useRef(app.isMute === true);
  const currentBgmRef = useRef<{
    id: string;
    noLoop: boolean;
    fadeIn: boolean;
    fadeInSec: number;
    fadeOut: boolean;
    fadeOutSec: number;
    mute: boolean;
    isYoutube: boolean;
  } | null>(null);
  const lastBgmSelection = useRef<Choice | SelectableAddon | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(() => app.isMute === true);
  const [volume, setVolume] = useState(() => {
    const v = Number(app.curVolume ?? 100);
    return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 100;
  });
  const [trackTitle, setTrackTitle] = useState("");
  const [hasBgm, setHasBgm] = useState(false);

  useEffect(() => {
    mutedRef.current = app.isMute === true;
  }, [app.isMute]);

  function clearFadeTimer() {
    if (fadeIntervalRef.current !== null) {
      window.clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
  }

  /** Load the YouTube IFrame API once (mirrors the original `loadYouTubeAPI`). */
  function loadYtApi(): Promise<any> {
    const w = window as unknown as {
      YT?: any;
      onYouTubeIframeAPIReady?: () => void;
    };
    if (w.YT?.Player) return Promise.resolve(w.YT);
    return new Promise((resolve, reject) => {
      const prev = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(w.YT);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = () => reject(new Error("YouTube API failed to load"));
      document.head.appendChild(script);
    });
  }

  function stopYtPlayer() {
    const yt = ytPlayerRef.current;
    if (yt?.player) {
      try {
        yt.player.stopVideo();
      } catch {
        // ignore
      }
    }
  }

  function stopBgmAudio() {
    clearFadeTimer();
    stopYtPlayer();
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
  }

  /** Stop with the current track's bgmFadeOut ramp (if configured). */
  function stopBgmWithFade() {
    const meta = currentBgmRef.current;
    const audio = audioRef.current;
    const yt = ytPlayerRef.current;
    if (!meta?.fadeOut || meta.fadeOutSec <= 0) {
      stopBgmAudio();
      return;
    }
    if (meta.isYoutube && yt?.player) {
      let from = 0;
      try {
        from = yt.player.getVolume() ?? 0;
      } catch {
        // ignore
      }
      const stepMs = 50;
      const steps = Math.max(1, Math.round((meta.fadeOutSec * 1000) / stepMs));
      const delta = from / steps;
      let step = 0;
      clearFadeTimer();
      fadeIntervalRef.current = window.setInterval(() => {
        step += 1;
        if (step >= steps) {
          try {
            yt.player.setVolume(0);
            yt.player.stopVideo();
          } catch {
            // ignore
          }
          setIsPlaying(false);
          clearFadeTimer();
        } else {
          try {
            yt.player.setVolume(Math.max(0, from - delta * step));
          } catch {
            // ignore
          }
        }
      }, stepMs);
      return;
    }
    if (audio && !audio.paused) {
      const from = audio.volume;
      const stepMs = 50;
      const steps = Math.max(1, Math.round((meta.fadeOutSec * 1000) / stepMs));
      const delta = from / steps;
      let step = 0;
      clearFadeTimer();
      fadeIntervalRef.current = window.setInterval(() => {
        step += 1;
        if (step >= steps) {
          audio.volume = 0;
          stopBgmAudio();
        } else {
          audio.volume = Math.max(0, from - delta * step);
        }
      }, stepMs);
      return;
    }
    stopBgmAudio();
  }

  function startYoutubeBgm(videoId: string, meta: typeof currentBgmRef.current & object) {
    void loadYtApi()
      .then((YT) => {
        const current = ytPlayerRef.current;
        if (current?.videoId === videoId && current.player) {
          try {
            current.player.playVideo();
            setIsPlaying(true);
            return;
          } catch {
            // fall through to recreate
          }
        }
        try {
          const player = new YT.Player("bgm-player", {
            videoId,
            width: 0,
            height: 0,
            playerVars: {
              autoplay: 1,
              controls: 0,
              disablekb: 1,
              ...(meta.noLoop ? {} : { loop: 1, playlist: videoId }),
            },
            events: {
              onReady: () => {
                ytPlayerRef.current = { player, videoId };
                try {
                  player.setVolume(meta.fadeIn ? 0 : volume);
                  if (mutedRef.current || meta.mute) player.mute();
                  player.playVideo();
                  setIsPlaying(true);
                } catch {
                  // ignore
                }
                if (meta.fadeIn) {
                  const target = volume;
                  const stepMs = 50;
                  const steps = Math.max(1, Math.round((meta.fadeInSec * 1000) / stepMs));
                  const delta = target / steps;
                  let step = 0;
                  clearFadeTimer();
                  fadeIntervalRef.current = window.setInterval(() => {
                    step += 1;
                    if (step >= steps) {
                      try {
                        player.setVolume(target);
                      } catch {
                        // ignore
                      }
                      clearFadeTimer();
                    } else {
                      try {
                        player.setVolume(delta * step);
                      } catch {
                        // ignore
                      }
                    }
                  }, stepMs);
                }
              },
              onStateChange: (event: { data: number }) => {
                if (event.data === 0 && !meta.noLoop) {
                  try {
                    player.playVideo();
                  } catch {
                    // ignore
                  }
                }
              },
            },
          });
        } catch {
          setIsPlaying(false);
        }
      })
      .catch(() => setIsPlaying(false));
  }

  function startBgm(choice: Choice | SelectableAddon) {
    const bgmId = choice.bgmId;
    if (!bgmId) return;
    const meta = {
      id: bgmId,
      noLoop: choice.bgmNoLoop === true,
      fadeIn: choice.bgmFadeIn === true,
      fadeInSec: Math.max(0.1, Number(choice.bgmFadeInSec ?? 1)),
      fadeOut: choice.bgmFadeOut === true,
      fadeOutSec: Math.max(0.1, Number(choice.bgmFadeOutSec ?? 1)),
      mute: choice.muteBgm === true,
      isYoutube: choice.useAudioURL !== true,
    };
    currentBgmRef.current = meta;
    setTrackTitle(choice.title || bgmId);
    setHasBgm(true);
    stopBgmAudio();

    if (meta.isYoutube) {
      startYoutubeBgm(bgmId, meta);
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = bgmId;
    audio.loop = !meta.noLoop;
    audio.muted = mutedRef.current || meta.mute;
    audio.volume = meta.fadeIn ? 0 : volume / 100;
    void audio
      .play()
      .then(() => {
        setIsPlaying(true);
        if (meta.fadeIn) {
          const target = volume / 100;
          const stepMs = 50;
          const steps = Math.max(1, Math.round((meta.fadeInSec * 1000) / stepMs));
          const delta = target / steps;
          let step = 0;
          clearFadeTimer();
          fadeIntervalRef.current = window.setInterval(() => {
            step += 1;
            if (step >= steps) {
              if (audio) audio.volume = target;
              clearFadeTimer();
            } else if (audio) {
              audio.volume = delta * step;
            }
          }, stepMs);
        }
      })
      .catch(() => setIsPlaying(false));
  }

  // Detect a fresh selection carrying a BGM choice (mirrors the fade effect).
  useEffect(() => {
    let picked: Choice | SelectableAddon | undefined;
    for (const [id] of cyoa.state.activated) {
      if (lastBgmSelection.current && lastBgmSelection.current.id === id) continue;
      const cMap = cyoa.idx.choiceMap.get(id);
      const choice = cMap?.choice;
      if (choice?.setBgmIsOn && choice.bgmId) picked = choice;
    }
    if (picked) {
      lastBgmSelection.current = picked;
      startBgm(picked);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cyoa.state.activated]);

  // Stop the music when the BGM choice is deselected or everything is cleaned.
  useEffect(() => {
    const bgm = lastBgmSelection.current;
    if (bgm && !cyoa.state.activated.has(bgm.id)) {
      lastBgmSelection.current = null;
      currentBgmRef.current = null;
      setHasBgm(false);
      setTrackTitle("");
      stopBgmWithFade();
    } else if (cyoa.state.activated.size === 0) {
      lastBgmSelection.current = null;
      currentBgmRef.current = null;
      setHasBgm(false);
      setTrackTitle("");
      stopBgmAudio();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cyoa.state.activated]);

  function handlePlayPause() {
    const yt = ytPlayerRef.current;
    if (yt?.player) {
      try {
        const state = yt.player.getPlayerState?.();
        if (state === 1 || state === 3) {
          yt.player.pauseVideo();
          setIsPlaying(false);
        } else {
          yt.player.playVideo();
          setIsPlaying(true);
        }
      } catch {
        // ignore
      }
      return;
    }
    const audio = audioRef.current;
    if (!audio?.src) return;
    if (audio.paused) {
      void audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }

  function handleStop() {
    const yt = ytPlayerRef.current;
    if (yt?.player) {
      try {
        yt.player.stopVideo();
      } catch {
        // ignore
      }
      setIsPlaying(false);
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
  }

  function handleMuteToggle() {
    setIsMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      const yt = ytPlayerRef.current;
      if (yt?.player) {
        try {
          if (next || (currentBgmRef.current?.mute ?? false)) yt.player.mute();
          else yt.player.unMute();
        } catch {
          // ignore
        }
      }
      const audio = audioRef.current;
      if (audio) audio.muted = next || (currentBgmRef.current?.mute ?? false);
      return next;
    });
  }

  function handleVolumeChange(value: number) {
    setVolume(value);
    const yt = ytPlayerRef.current;
    if (yt?.player) {
      try {
        yt.player.setVolume(value);
      } catch {
        // ignore
      }
    }
    const audio = audioRef.current;
    if (audio) audio.volume = value / 100;
  }

  // Auto-deselect choices whose requirements became unmet (missing-req cascade).
  useEffect(() => {
    let changed = false;
    const next = {
      ...cyoa.state,
      activated: new Map(cyoa.state.activated),
      currentChoices: new Map(cyoa.state.currentChoices),
    };
    for (const [id, entry] of cyoa.state.activated) {
      if (entry.isRowButton || entry.isVariable) continue;
      const cMap = cyoa.idx.choiceMap.get(id);
      if (!cMap) continue;
      const { choice, row } = cMap;
      if (!isEnabled(choice.requireds, cyoa.idx, next)) {
        next.activated.delete(id);
        next.currentChoices.set(row.id, Math.max(0, (next.currentChoices.get(row.id) ?? 0) - 1));
        changed = true;
      }
    }
    if (changed) {
      // Replace state via the hook's setter through a dedicated method.
      cyoa.importBuildCode(encodeForState(next, cyoa));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cyoa.state]);

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
    (app.hideBackpackBtn === 0 || app.hideBackpackBtn === app.btnBackpackIsOn);

  // Background overrides from active `changeBackground` choices.
  const bgOverrides = backgroundOverrides(cyoa.idx, cyoa.state);
  const viewerBackgroundColor =
    bgOverrides.color ?? ((app.styling?.backgroundColor as string) || undefined);
  const viewerBackgroundImage = resolveImageRef(
    app,
    bgOverrides.image ?? ((app.styling?.backgroundImage as string) || undefined),
  );

  // Scroll to a row/choice when a `scrollToRow`/`scrollToObject` choice is
  // freshly selected (mirrors the original `selectScroll`).
  const lastScrollChoice = useRef<string | null>(null);
  useEffect(() => {
    for (const [id] of cyoa.state.activated) {
      if (lastScrollChoice.current === id) continue;
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
        lastScrollChoice.current = id;
        const targetId =
          choice.scrollToObject && choice.scrollObjectId
            ? choice.scrollObjectId
            : choice.scrollRowId;
        if (targetId) {
          window.setTimeout(() => {
            const el = document.querySelector(
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
        backgroundSize: "cover",
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
              ? `url(${app.viewerConfig.loadingBgImage})`
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

      {app.enableSearch ? <ViewerSearchBar ref={searchBarRef} cyoa={cyoa} /> : null}

      {app.rows?.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No rows yet — edit the CYOA to add content.
          </p>
        </div>
      ) : (
        <div className="row-gap-6 -mx-4 flex flex-wrap gap-6 px-4 lg:-mx-6 lg:px-6">
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
                <RowView cyoa={cyoa} row={row} viewport={viewport} />
              </div>
            ))}
        </div>
      )}

      {/* Action/point bar docks to the bottom of the scrollport (original
          viewer's bottom bar). It is the LAST child so `sticky bottom-0`
          pins it to the bottom edge from the start of the scroll. */}
      {pointBarIsOn ? (
        <PointBar
          app={app}
          cyoa={cyoa}
          showBackpackBtn={showBackpackBtn}
          onOpenBackpack={() => setDialog("backpack")}
          onOpenSearch={() => searchBarRef.current?.focus()}
          onOpenBuild={() => setDialog("build")}
          onOpenSave={() => setDialog("save")}
          onClean={cyoa.clean}
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

/** Serialize a state back into a build code (for the missing-req cascade). */
function encodeForState(state: CyoaState, cyoa: UseCyoaResult): string {
  return encodeBuildCode(cyoa.app, cyoa.idx, state);
}

/* ------------------------------------------------------------------ */
/* Project-wide search bar                                            */
/* ------------------------------------------------------------------ */

export interface ViewerSearchBarHandle {
  focus: () => void;
}

const SEARCH_FILTERS: { value: ProjectSearchType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "choice", label: "Choices" },
  { value: "addon", label: "Addons" },
  { value: "row", label: "Rows" },
  { value: "point", label: "Points" },
  { value: "group", label: "Groups" },
  { value: "globalRequirement", label: "Reqs" },
  { value: "word", label: "Words" },
];

/**
 * Project-wide search bar: filters the whole document (choices, addons,
 * rows, point types, groups, global requirements, words) by kind and query,
 * then jumps to the match — selecting choices/addons and scrolling to the
 * first choice that references non-visual entities.
 */
function ViewerSearchBar({
  cyoa,
  ref,
}: {
  cyoa: UseCyoaResult;
  ref?: Ref<ViewerSearchBarHandle>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProjectSearchType | "all">("all");
  const [open, setOpen] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => inputRef.current?.focus(),
    }),
    [],
  );

  const entries = useMemo(() => getProjectSearchEntries(cyoa.app), [cyoa.app]);

  // First choice that references each point/group/global-requirement/word, so
  // those results can still "jump" somewhere useful in the rendered viewer.
  const referenceTargets = useMemo(() => {
    const map = new Map<string, { choice: Choice; row: Row }>();
    const setFirst = (id: string | undefined, target: { choice: Choice; row: Row }) => {
      if (!id || map.has(id)) return;
      map.set(id, target);
    };
    for (const row of cyoa.app.rows ?? []) {
      for (const choice of row.objects ?? []) {
        const target = { choice, row };
        const walk = (requireds: Requireds[] | undefined) => {
          for (const req of requireds ?? []) {
            if (req.type === "or") walk(req.orRequireds);
            else if (req.type === "points" || req.type === "gid" || req.type === "word") {
              setFirst(req.reqId, target);
            }
          }
        };
        walk(choice.requireds);
        for (const groupId of choice.groups ?? []) setFirst(groupId, target);
        for (const score of choice.scores ?? []) setFirst(score.id, target);
      }
    }
    return map;
  }, [cyoa.app]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return entries
      .filter((entry) => (filter === "all" ? true : entry.type === filter))
      .filter((entry) => {
        // Only list jumpable entities: choices/addons/rows live in rows that
        // are currently enabled — hidden rows aren't in the DOM, so "jump"
        // couldn't reach them. The list refreshes live as rows unlock.
        if (entry.type === "choice" || entry.type === "addon") {
          return entry.row ? isEnabled(entry.row.requireds, cyoa.idx, cyoa.state) : true;
        }
        if (entry.type === "row") {
          return entry.row ? isEnabled(entry.row.requireds, cyoa.idx, cyoa.state) : true;
        }
        return true;
      })
      .filter(
        (entry) =>
          entry.id.toLowerCase().includes(q) ||
          entry.label.toLowerCase().includes(q) ||
          entry.kindLabel.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [entries, query, filter, cyoa.idx, cyoa.state]);

  function jumpTo(entry: ProjectSearchEntry) {
    if (entry.type === "row") {
      document
        .querySelector(`[data-cyoa-row="${CSS.escape(entry.id)}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (entry.type === "choice" && entry.choice && entry.row) {
      document
        .querySelector(`[data-cyoa-choice="${CSS.escape(entry.id)}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      cyoa.toggleChoice(entry.choice, entry.row);
    } else if (entry.type === "addon" && entry.choice && entry.row && entry.parentId) {
      const parent = cyoa.idx.choiceMap.get(entry.parentId)?.choice;
      document
        .querySelector(`[data-cyoa-choice="${CSS.escape(entry.parentId)}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (parent) cyoa.toggleAddon(entry.choice as unknown as SelectableAddon, parent, entry.row);
    } else {
      // Non-visual entity (point/group/global requirement/word): jump to the
      // first choice that references it.
      const target = referenceTargets.get(entry.id);
      if (target) {
        document
          .querySelector(`[data-cyoa-choice="${CSS.escape(target.choice.id)}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  return (
    <div className="sticky top-0 z-30 border-b border-border/60 bg-background/90 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/75 lg:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                inputRef.current?.blur();
              } else if (event.key === "Enter" && results.length > 0) {
                jumpTo(results[0]);
              }
            }}
            placeholder="Search choices, rows, addons…"
            aria-label="Search project"
            className="pl-8"
          />
          {open && query.trim() ? (
            <div
              className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md"
              onMouseDown={(event) => event.preventDefault()}
            >
              {results.length === 0 ? (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">No matches.</p>
              ) : (
                results.map((entry) => (
                  <button
                    key={`${entry.type}:${entry.id}`}
                    type="button"
                    onClick={() => jumpTo(entry)}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <Badge variant="secondary" className="shrink-0 font-normal">
                      {entry.kindLabel}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate font-medium">{entry.label}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {entry.id}
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Search filters">
          {SEARCH_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setFilter(option.value)}
              className={cn(
                "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                filter === option.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent",
              )}
              aria-pressed={filter === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Point bar                                                          */
/* ------------------------------------------------------------------ */

interface PointBarProps {
  app: App;
  cyoa: UseCyoaResult;
  showBackpackBtn: boolean;
  onOpenBackpack: () => void;
  onOpenSearch: () => void;
  onOpenBuild: () => void;
  onOpenSave: () => void;
  onClean: () => void;
}

function PointBar({
  app,
  cyoa,
  showBackpackBtn,
  onOpenBackpack,
  onOpenSearch,
  onOpenBuild,
  onOpenSave,
  onClean,
}: PointBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const styling = (cyoa.idx.app.styling ?? {}) as Record<string, unknown>;
  // Action/point bar always docks to the bottom of the viewport (the original
  // ICCPlus viewer's bottom bar).
  const barOverrides = pointBarOverrides(cyoa.idx, cyoa.state);
  const str = (key: string): string =>
    typeof styling[key] === "string" ? (styling[key] as string) : "";
  const num = (key: string, fallback = 0): number => numValue(styling[key], fallback);

  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 -mx-4 px-4 py-2.5 lg:-mx-6 lg:px-6",
      )}
      style={{
        backgroundColor:
          barOverrides.bgColor ?? (str("barBackgroundColor") || undefined),
        color: barOverrides.textColor ?? (str("barTextColor") || undefined),
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          {(app.pointTypes ?? [])
            .filter((pt) => checkPointEnable(pt, cyoa.idx, cyoa.state))
            .map((pointType) => {
              const total =
                cyoa.totals.get(pointType.id)?.total ?? Number(pointType.startingSum ?? 0);
              const isNegative = total < 0;
              // The original colors the sum by the SIGN of the current total
              // (barPointPos for >= 0, barPointNeg otherwise), not by a
              // comparison to the starting value.
              const valueColor =
                (isNegative ? str("barPointNeg") : str("barPointPos")) || undefined;
              const privateColor =
                pointType.pointPrivateColorIsOn &&
                (isNegative ? pointType.privateNegativeColor : pointType.privateColor)
                  ? (isNegative ? pointType.privateNegativeColor : pointType.privateColor)
                  : undefined;
              const icon = pointType.iconIsOn
                ? isNegative && pointType.negativeIconIsOn
                  ? {
                      src: resolveImageRef(app, pointType.negativeImage),
                      w: numValue(pointType.negativeIconWidth, 0),
                      h: numValue(pointType.negativeIconHeight, 0),
                      onSide: pointType.negativeImageOnSide === true,
                      sidePlacement: pointType.negativeImageSidePlacement === true,
                    }
                  : {
                      src: resolveImageRef(app, pointType.image),
                      w: numValue(pointType.iconWidth, 0),
                      h: numValue(pointType.iconHeight, 0),
                      onSide: pointType.imageOnSide === true,
                      sidePlacement: pointType.imageSidePlacement === true,
                    }
                : null;
              return (
                <div
                  key={pointType.id}
                  className="flex items-baseline gap-1.5 text-sm"
                  style={{
                    margin: num("barTextMargin", 0),
                    padding: num("barTextPadding", 0),
                    fontFamily: str("barTextFont") || undefined,
                    fontSize: num("barTextSize", 0) || undefined,
                    color: privateColor || undefined,
                  }}
                >
                  {icon && !icon.onSide && !icon.sidePlacement && icon.src ? (
                    <img
                      src={icon.src}
                      alt=""
                      className="self-center"
                      style={{ width: icon.w, height: icon.h }}
                    />
                  ) : null}
                  {pointType.beforeText ? (
                    <span className="font-medium text-foreground">{pointType.beforeText}</span>
                  ) : null}
                  {icon && icon.onSide && !icon.sidePlacement && icon.src ? (
                    <img
                      src={icon.src}
                      alt=""
                      className="self-center"
                      style={{ width: icon.w, height: icon.h }}
                    />
                  ) : null}
                  <span
                    className="font-semibold tabular-nums"
                    style={{ color: barOverrides.iconColor ?? valueColor }}
                  >
                    {formatPointValue(pointType, total)}
                  </span>
                  {icon && !icon.onSide && icon.sidePlacement && icon.src ? (
                    <img
                      src={icon.src}
                      alt=""
                      className="self-center"
                      style={{ width: icon.w, height: icon.h }}
                    />
                  ) : null}
                  {pointType.afterText ? (
                    <span className="text-muted-foreground">{pointType.afterText}</span>
                  ) : null}
                  {icon && icon.onSide && icon.sidePlacement && icon.src ? (
                    <img
                      src={icon.src}
                      alt=""
                      className="self-center"
                      style={{ width: icon.w, height: icon.h }}
                    />
                  ) : null}
                </div>
              );
            })}
        </div>

        <div className="relative flex shrink-0 items-center gap-1.5">
          {showBackpackBtn ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={onOpenBackpack}
              title="Backpack"
              aria-label="Backpack"
            >
              <IconBackpack className="size-4" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setMenuOpen((v) => !v)}
            title="Menu"
            aria-label="Menu"
          >
            <IconMenu2 className="size-4" />
          </Button>
          {menuOpen ? (
            <div className="absolute bottom-full right-0 z-30 mb-1 w-48 rounded-md border border-border bg-popover p-1 shadow-md">
              <MenuButton
                label="Clear selected choices"
                onClick={() => {
                  onClean();
                  setMenuOpen(false);
                }}
              />
              {app.enableSearch ? (
                <MenuButton
                  label="Search choice"
                  onClick={() => {
                    onOpenSearch();
                    setMenuOpen(false);
                  }}
                />
              ) : null}
              <MenuButton
                label="Build form"
                onClick={() => {
                  onOpenBuild();
                  setMenuOpen(false);
                }}
              />
              <MenuButton
                label="Save / load build"
                onClick={() => {
                  onOpenSave();
                  setMenuOpen(false);
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MenuButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Row                                                                */
/* ------------------------------------------------------------------ */

function RowView({ cyoa, row, viewport }: { cyoa: UseCyoaResult; row: Row; viewport: number }) {
  const enabled = isEnabled(row.requireds, cyoa.idx, cyoa.state);

  // Hidden entirely when requirements are unmet (original behavior).
  if (!enabled) {
    // `deselectChoices` auto-deselects the row's choices when unmet.
    return null;
  }

  const titleStyle = textStyle("rowTitle", cyoa.idx, cyoa.state, row);
  const textStyleObj = textStyle("rowText", cyoa.idx, cyoa.state, row);
  const hidden = hiddenContentsFor(row, cyoa.idx, cyoa.state);
  const rowTextRemoved = hidden.size > 0;
  const tpl = viewerTemplate(row, true, cyoa.app, viewport, cyoa.idx, cyoa.state);
  const rowImageStyle = imageStyle("rowImage", cyoa.idx, cyoa.state, row);
  const rowSurface = rowSurfaceStyle(row, cyoa.idx, cyoa.state);
  // The row body (section) carries the row-body margins plus the private /
  // design-group body background (original `AppRow.rowBody`); the header box
  // below holds the header background/border/shadow (`rowBackground`).
  const sectionStyle: React.CSSProperties = {
    margin: rowSurface.margin,
    ...(rowSurface.bodyBackgroundImage
      ? {
          backgroundImage: `url(${rowSurface.bodyBackgroundImage})`,
          backgroundRepeat: rowSurface.bodyBackgroundRepeat || undefined,
          backgroundSize: rowSurface.bodyBackgroundSize || undefined,
        }
      : {}),
    ...(rowSurface.bodyBackgroundColor
      ? { backgroundColor: rowSurface.bodyBackgroundColor }
      : {}),
  };

  // Row card surface (original `AppRow.rowBackground`): the header box that
  // wraps the image/button, title and text carries the row's background,
  // border, radius, shadow and `rowMargin` side insets; the outer section
  // holds only the `rowBody` margins (top / sides% / bottom).
  const headerStyle = {
    backgroundColor: rowSurface.backgroundColor || undefined,
    backgroundImage: rowSurface.gradient
      ? rowSurface.gradient
      : rowSurface.backgroundImage
        ? `url(${rowSurface.backgroundImage})`
        : undefined,
    backgroundRepeat: rowSurface.backgroundRepeat || undefined,
    backgroundSize: rowSurface.backgroundSize || undefined,
    border: rowSurface.borderColor
      ? `${rowSurface.borderWidth} ${rowSurface.borderStyle} ${rowSurface.borderColor}`
      : undefined,
    borderRadius: rowSurface.borderRadius || undefined,
    overflow: rowSurface.overflow || undefined,
    boxShadow: rowSurface.boxShadow || undefined,
    filter: rowSurface.filter || undefined,
    marginBottom: rowSurface.marginBottom || undefined,
    marginLeft: rowSurface.marginLeft || undefined,
    marginRight: rowSurface.marginRight || undefined,
    ...(rowSurface.borderImage ? { borderImage: rowSurface.borderImage } : {}),
  } as React.CSSProperties;

  const titleEl = row.title ? (
    <h2
      className="font-semibold"
      style={titleStyle}
      dangerouslySetInnerHTML={renderHtml(row.title, cyoa.idx, cyoa.state)}
    />
  ) : null;
  const textEl =
    row.titleText && !rowTextRemoved ? (
      <p
        className="leading-6"
        style={textStyleObj}
        dangerouslySetInnerHTML={renderHtml(row.titleText, cyoa.idx, cyoa.state)}
      />
    ) : null;
  // Row buttons render in the image slot (original `isButtonRow` replaces the
  // row image); otherwise the row image spans the full width at its natural
  // height, only constrained when the document opts into a fixed object-fit.
  const imageEl = row.isButtonRow ? (
    <RowButton cyoa={cyoa} row={row} />
  ) : row.image ? (
    <img
      src={resolveImageRef(cyoa.app, row.image)}
      alt=""
      className="w-full"
      style={rowImageStyle}
    />
  ) : null;

  if (imageEl || titleEl || textEl) {
    if (tpl === 2 || tpl === 3) {
      // Side-by-side row templates: 2 = image right, 3 = image left.
      const styling = getStyling("privateRowImageIsOn", cyoa.idx, cyoa.state, row) as Record<
        string,
        unknown
      >;
      const imageBox = numValue(styling.rowImageBoxWidth, 50);
      const textBox = 100 - imageBox;
      const imageCol = (
        <div className="min-w-0" style={{ width: `${imageBox}%` }}>
          {imageEl}
        </div>
      );
      const textCol = (
        <div className="min-w-0" style={{ width: `${textBox}%` }}>
          {titleEl}
          {textEl}
        </div>
      );
      return (
        <section style={sectionStyle}>
          <header className="flex items-start" style={headerStyle}>
            {tpl === 2 ? (
              <>
                {textCol}
                {imageCol}
              </>
            ) : (
              <>
                {imageCol}
                {textCol}
              </>
            )}
          </header>
          {rowContent(cyoa, row, viewport)}
        </section>
      );
    }
    // Stacked templates: 1 = image top, 4 = image bottom, 5 = image below title.
    const ordered =
      tpl === 4
        ? [titleEl, textEl, imageEl]
        : tpl === 5
          ? [titleEl, imageEl, textEl]
          : [imageEl, titleEl, textEl];
    const orderedWithKeys = ordered
      .filter((el) => el !== null)
      .map((el, i) => <Fragment key={i}>{el}</Fragment>);
    return (
      <section style={sectionStyle}>
        <header style={headerStyle}>{orderedWithKeys}</header>
        {rowContent(cyoa, row, viewport)}
      </section>
    );
  }

  return <section style={sectionStyle}>{rowContent(cyoa, row, viewport)}</section>;
}

/** Row body: button row, result/group rows, or the choice grid. */
function rowContent(cyoa: UseCyoaResult, row: Row, viewport: number) {
  if (row.isResultRow) {
    return <ResultRowContent cyoa={cyoa} row={row} viewport={viewport} />;
  }
  if (row.isGroupRow) {
    return <GroupRowContent cyoa={cyoa} row={row} viewport={viewport} />;
  }
  return (
    <div className={cn("flex flex-wrap", rowJustifyClass(row))}>
      {sortedChoices(row).map((choice) => (
        <div
          key={choice.id}
          className={cn("min-w-0", effectiveChoiceWidth(row, choice, cyoa, viewport))}
          style={{ padding: choiceMargin(choice, row, cyoa.idx, cyoa.state) }}
        >
          <ChoiceView cyoa={cyoa} choice={choice} row={row} viewport={viewport} />
        </div>
      ))}
    </div>
  );
}

/** Row content justification (original `rowJustify` -> `justify-*` class). */
function rowJustifyClass(row: Row): string {
  switch (row.rowJustify) {
    case "center":
      return "justify-center";
    case "end":
      return "justify-end";
    case "space-around":
      return "justify-around";
    case "space-between":
      return "justify-between";
    default:
      return "justify-start";
  }
}

function RowButton({ cyoa, row }: { cyoa: UseCyoaResult; row: Row }) {
  const disabled = isRowButtonDisabled(row, cyoa.state);
  // The row button carries only the row's button padding (original
  // `AppRow.rowButton`); the row header it sits in provides the background,
  // border and shadow via `rowSurfaceStyle`.
  const buttonStyle = rowButtonStyle(row, cyoa.idx, cyoa.state);
  const label =
    row.buttonText ||
    (row.btnPointAddon
      ? "Roll"
      : row.buttonId
        ? (cyoa.idx.variableMap.get(row.buttonId)?.id ?? "Button")
        : "Button");
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => cyoa.rowButton(row)}
      className={cn(
        "rounded-md px-4 py-1.5 text-sm font-medium transition-colors hover:bg-accent",
        disabled && "cursor-not-allowed opacity-50",
      )}
      style={buttonStyle}
      dangerouslySetInnerHTML={renderHtml(label, cyoa.idx, cyoa.state)}
    />
  );
}

function ResultRowContent({
  cyoa,
  row,
  viewport,
}: {
  cyoa: UseCyoaResult;
  row: Row;
  viewport: number;
}) {
  const entries = resultRowChoices(row, cyoa.idx, cyoa.state);
  const allowDeselect = cyoa.app.viewerSettings?.allowDeselect === true;
  if (entries.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap", rowJustifyClass(row))}>
      {entries.map(({ choice, row: origin }) => (
        <div
          key={choice.id}
          className={cn("min-w-0", effectiveChoiceWidth(origin, choice, cyoa, viewport))}
          style={{ padding: choiceMargin(choice, origin, cyoa.idx, cyoa.state) }}
        >
          <ChoiceView
            cyoa={cyoa}
            choice={choice}
            row={origin}
            viewport={viewport}
            info={!allowDeselect}
          />
        </div>
      ))}
    </div>
  );
}

function GroupRowContent({
  cyoa,
  row,
  viewport,
}: {
  cyoa: UseCyoaResult;
  row: Row;
  viewport: number;
}) {
  const entries = groupRowChoices(row, cyoa.idx);
  if (entries.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap", rowJustifyClass(row))}>
      {entries.map(({ choice, row: origin }) => (
        <div
          key={choice.id}
          className={cn("min-w-0", effectiveChoiceWidth(origin, choice, cyoa, viewport))}
          style={{ padding: choiceMargin(choice, origin, cyoa.idx, cyoa.state) }}
        >
          <ChoiceView cyoa={cyoa} choice={choice} row={origin} viewport={viewport} info />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Choice                                                             */
/* ------------------------------------------------------------------ */

interface ChoiceViewProps {
  cyoa: UseCyoaResult;
  choice: Choice;
  row: Row;
  /** Info rows ignore clicks (result/group/backpack rows). */
  info?: boolean;
  viewport?: number;
}

function ChoiceView({ cyoa, choice, row, info = false, viewport = 0 }: ChoiceViewProps) {
  const enabled = isEnabled(choice.requireds, cyoa.idx, cyoa.state);
  // A single-select choice is stored as `{ multiple: 0 }` — presence in the
  // activated map (not the count) means it is selected (matches the original
  // viewer's `isActive` flag semantics).
  const isSelected = cyoa.state.activated.has(choice.id);
  const isMulti = choice.isSelectableMultiple === true;
  const surface = choiceSurfaceStyle(choice, row, cyoa.idx, cyoa.state);
  const shown = isChoiceShown(choice, row, cyoa.idx, cyoa.state);
  const text = choice as Choice & { title?: string; text?: string };
  const titleStyle = textStyle("objectTitle", cyoa.idx, cyoa.state, row, choice);
  const textStyleObj = textStyle("objectText", cyoa.idx, cyoa.state, row, choice);
  const objectImageStyle = imageStyle("objectImage", cyoa.idx, cyoa.state, row, choice);
  const isCounterOnlyMulti = isMulti && !choice.allowSelectByClick;
  const isClickable = !info && !isCounterOnlyMulti && !choice.isNotSelectable;

  const hidden = hiddenContentsFor(row, cyoa.idx, cyoa.state);
  const nAddons = (choice.addons ?? []).filter((a): a is NonSelectableAddon => !a.isSelectable);
  const sAddons = (choice.addons ?? []).filter(
    (a): a is SelectableAddon => a.isSelectable === true,
  );
  // Content-hiding choices toggle the row's removal flags; the row JSON may
  // also set them directly (original `objectTitleRemoved` etc.).
  const titleRemoved = hidden.has("1") || row.objectTitleRemoved === true;
  const imageRemoved = hidden.has("2") || row.objectImageRemoved === true;
  const textRemoved = hidden.has("3") || row.objectTextRemoved === true;
  const scoreRemoved = hidden.has("4") || row.objectScoreRemoved === true;
  const reqRemoved = hidden.has("5") || row.objectRequirementRemoved === true;

  if (!shown) return null;

  const counter = isMulti ? <MultiChoice cyoa={cyoa} choice={choice} row={row} /> : null;

  // Scores/requirements move into the first addon when the choice opts into
  // `showScoreInAddon` / `showReqInAddon` (original viewer behavior).
  const showScores = !scoreRemoved && !choice.showScoreInAddon;
  const showReqs = !reqRemoved && !choice.showReqInAddon;

  const effTpl = viewerTemplate(choice, false, cyoa.app, viewport, cyoa.idx, cyoa.state);
  const tpl = templateClasses(effTpl);
  // Stacked templates (1/4/5) size the image from the styling cascade; the
  // side templates let their flex box handle sizing. The image always fills
  // the card width (the doc's objectImageWidth is ignored for the stacked
  // layouts so images align edge-to-edge with the card).
  const imgStyle =
    effTpl === 1 || effTpl === 4 || effTpl === 5
      ? { ...objectImageStyle, width: "100%", borderColor: surface.imageBorderColor || undefined }
      : { borderColor: surface.imageBorderColor || undefined };

  // Template 5 flows the image inline (after requirements, before the text);
  // all other templates render it as the first/last flex child of the card.
  const choiceImage = resolveChoiceImage(choice, cyoa.idx, cyoa.state);
  const tplImageEl =
    choiceImage && !imageRemoved ? (
      <div className={tpl.image}>
        <img
          src={choiceImage}
          alt=""
          className={cn(
            "rounded-md border border-border",
            effTpl === 2 || effTpl === 3 ? "h-full w-full object-contain" : "w-full",
          )}
          style={imgStyle}
        />
      </div>
    ) : null;

  const addonsEl = (
    <>
      {nAddons.length > 0 ? (
        <div className={cn("flex flex-wrap gap-2", choice.addonJustify ? "justify-center" : "")}>
          {nAddons.map((addon, i) => (
            <AddonView
              key={addon.id}
              cyoa={cyoa}
              addon={addon}
              choice={choice}
              row={row}
              hidden={hidden}
              isFirst={
                !addon.skipIndex &&
                sAddons.length === 0 &&
                i === nAddons.findIndex((a) => !a.skipIndex)
              }
            />
          ))}
        </div>
      ) : null}
      {sAddons.length > 0 ? (
        <div className={cn("mt-1 flex flex-wrap gap-2 border-t border-border pt-2")}>
          {sAddons.map((addon, i) => (
            <AddonView
              key={addon.id}
              cyoa={cyoa}
              addon={addon}
              choice={choice}
              row={row}
              hidden={hidden}
              isFirst={
                !addon.skipIndex &&
                (nAddons.length === 0 || nAddons.every((a) => a.skipIndex)) &&
                i === sAddons.findIndex((a) => !a.skipIndex)
              }
            />
          ))}
        </div>
      ) : null}
    </>
  );

  const body = (
    <>
      {text.title && !titleRemoved ? (
        <>
          <h3
            className="font-semibold"
            style={titleStyle}
            dangerouslySetInnerHTML={renderHtml(text.title, cyoa.idx, cyoa.state)}
          />
        </>
      ) : null}
      {counter}
      {/* Original viewer order: title, scores, requirements, then text. */}
      {showScores ? <Scores cyoa={cyoa} choice={choice} row={row} /> : null}
      {showReqs ? (
        <Requirements cyoa={cyoa} choice={choice} row={row} textColor={surface.scoreColor} />
      ) : null}
      {effTpl === 5 ? tplImageEl : null}
      {text.text && !textRemoved ? (
        <p
          className="leading-5"
          style={{
            ...textStyleObj,
            // Gap after the scores/requirements badges (the global
            // `.cyoa-viewer p` margin rule beats a margin utility class,
            // so set it inline).
            ...((showScores || showReqs) && { marginTop: 8 }),
          }}
          dangerouslySetInnerHTML={renderHtml(text.text, cyoa.idx, cyoa.state)}
        />
      ) : null}
      {!choice.useSeperateAddon ? addonsEl : null}
    </>
  );

  // The document's `objectBgColor` (or the state filter color) wins here.
  // We intentionally do NOT use the `bg-card` utility: the agent-native shell
  // forces `.bg-card` to the theme card surface with `!important` in dark
  // mode, which would silently override the CYOA's background color. The theme
  // card surface is still applied inline as the fallback when the document
  // doesn't specify a background.
  const docBackground = surface.backgroundColor || "var(--agent-native-card-surface)";

  return (
    <div
      data-cyoa-choice={choice.id}
      className={cn(
        "relative flex h-full flex-col rounded-lg border p-4 text-start transition-colors",
        isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border",
        !enabled && "cursor-not-allowed",
        cyoa.app.isPointerCursor && isClickable && "cursor-pointer",
      )}
      style={{
        filter: surface.filter || undefined,
        backgroundColor: docBackground,
        backgroundImage: surface.gradient
          ? surface.gradient
          : surface.backgroundImage
            ? `url(${surface.backgroundImage})`
            : undefined,
        backgroundRepeat: surface.backgroundRepeat || undefined,
        backgroundSize: surface.backgroundSize || undefined,
        borderColor: surface.borderColor || undefined,
        borderStyle: surface.borderStyle || undefined,
        borderWidth: surface.borderWidth || undefined,
        borderRadius: surface.borderRadius || undefined,
        boxShadow: surface.boxShadow || undefined,
        overflow: surface.overflow || undefined,
        ...(surface.borderImage ? { borderImage: surface.borderImage } : {}),
      }}
      onClick={() => {
        if (info || isCounterOnlyMulti) return;
        cyoa.toggleChoice(choice, row);
      }}
    >
      {effTpl !== 5 ? tplImageEl : null}
      <div className={tpl.body}>{body}</div>
      {choice.useSeperateAddon ? <div className="mt-2 w-full">{addonsEl}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Multi-choice counter                                               */
/* ------------------------------------------------------------------ */

function MultiChoice({ cyoa, choice, row }: { cyoa: UseCyoaResult; choice: Choice; row: Row }) {
  const entry = cyoa.state.activated.get(choice.id);
  const count = entry?.multiple ?? 0;
  const min = Number(choice.numMultipleTimesMinus ?? 0);
  const max = Number(choice.numMultipleTimesPluss ?? 0);
  const linkedPoint = choice.multipleScoreId
    ? cyoa.idx.pointTypeMap.get(choice.multipleScoreId)
    : undefined;
  const display =
    linkedPoint && choice.isMultipleUseVariable === false
      ? formatPointValue(linkedPoint, cyoa.totals.get(linkedPoint.id)?.total ?? 0)
      : String(count);
  const hideCounterUntilSelect = choice.hideCounterUntilSelect && count === 0;

  if (choice.isNotSelectable || hideCounterUntilSelect) return null;

  if (choice.useSlider) {
    const sliderMin = Math.min(min, count);
    return (
      <div className="flex w-full items-center gap-2">
        <input
          type="range"
          min={sliderMin}
          max={Math.max(max, count, 1)}
          step={1}
          value={Math.min(Math.max(count, sliderMin), Math.max(max, count, 1))}
          onChange={(event) => {
            const target = parseInt(event.target.value, 10);
            const delta = target - count;
            for (let i = 0; i < Math.abs(delta); i++) {
              if (delta > 0) cyoa.more(choice, row);
              else cyoa.less(choice, row);
            }
          }}
          className="flex-1 accent-primary"
          aria-label="Set count"
        />
        <span className="min-w-8 text-center text-sm tabular-nums">{display}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-9 rounded-full text-xl"
        disabled={count <= min || choice.selectOnce}
        onClick={(event) => {
          event.stopPropagation();
          cyoa.less(choice, row);
        }}
        aria-label="Decrease"
      >
        −
      </Button>
      <button
        type="button"
        className="min-w-8 rounded-md border border-border px-1 py-0.5 text-center text-sm tabular-nums"
        onClick={(event) => {
          event.stopPropagation();
          const raw = window.prompt("Set count", String(count));
          if (raw === null) return;
          const num = parseInt(raw, 10);
          if (Number.isNaN(num)) return;
          const clamped = Math.max(min, max > 0 ? Math.min(num, max) : num);
          const delta = clamped - count;
          for (let i = 0; i < Math.abs(delta); i++) {
            if (delta > 0) cyoa.more(choice, row);
            else cyoa.less(choice, row);
          }
        }}
        title="Click to set count"
      >
        {display}
      </button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-9 rounded-full text-xl"
        disabled={max > 0 && count >= max}
        onClick={(event) => {
          event.stopPropagation();
          cyoa.more(choice, row);
        }}
        aria-label="Increase"
      >
        +
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scores & requirements (inline)                                     */
/* ------------------------------------------------------------------ */

/**
 * Score badge value, mirroring the original ObjectScore `scoreValueText`:
 * absolute value (floored when the point type disallows floats) with a +/-
 * prefix when the point type has `plussOrMinusAdded` (sign inverted when
 * `plussOrMinusInverted`). The JSON value is the negated change (positive =
 * cost, negative = gain), so e.g. a stored -5 renders as "+5".
 */
function formatScoreValue(point: PointType | undefined, value: number): string {
  const abs = Math.abs(value);
  const display = point?.allowFloat ? abs : Math.floor(abs);
  if (point?.plussOrMinusAdded) {
    const negative = value < 0;
    const prefix = point.plussOrMinusInverted ? (negative ? "-" : "+") : (negative ? "+" : "-");
    return `${prefix}${formatPointValue(point, display)}`;
  }
  return formatPointValue(point ?? ({} as PointType), display);
}

/**
 * Badge display value (original ObjectScore `scoreValueText`): the base net
 * with discounts, scaled by the count ONLY when `multiplyByTimes` +
 * `displayMulScore` — a plain multi-select badge shows the per-copy value,
 * not the cumulative total.
 */
function scoreDisplayValue(
  choice: Choice | SelectableAddon,
  scoreIndex: number,
  score: Score,
  idx: CyoaIndex,
  state: CyoaState,
  multiple: number,
): number {
  const base = computeScoreNet(choice, scoreIndex, score, idx, state, 0);
  const count = Math.abs(multiple);
  if (score.multiplyByTimes && score.displayMulScore && count > 0) {
    return base * (count + 1);
  }
  return base;
}

/**
 * Score visibility gate (original ObjectScore `isPointtypeActivated`): the
 * score renders only when `showScore` is on AND the point type is not hidden
 * from objects — or, when hidden, only while its `activatedId` target is met
 * (a global requirement, a true variable, or an activated choice).
 */
function isScoreShown(
  score: Score,
  choice: Choice | SelectableAddon,
  idx: CyoaIndex,
  state: CyoaState,
): boolean {
  if (!score.showScore) return false;
  const point = idx.pointTypeMap.get(score.id ?? score.type);
  if (!point) return true;
  if (!point.isNotShownObjects) return true;
  if (point.activatedId !== undefined && point.activatedId !== "") {
    const globalReq = idx.globalReqMap.get(point.activatedId);
    const variable = idx.variableMap.get(point.activatedId);
    if (globalReq) return checkRequirements(globalReq, idx, state);
    if (variable) return state.variables.get(variable.id) === true;
    return checkActivated(point.activatedId, state);
  }
  return false;
}

/**
 * Point-type icon renderer (original ObjectScore): the icon image with the
 * point type's width/height, placed around the text per `imageOnSide` /
 * `imageSidePlacement` (and the negative variant when the score is a gain and
 * `negativeIconIsOn`).
 */
function ScoreIcon({
  app,
  point,
  isNegative,
}: {
  app: App;
  point: PointType;
  isNegative: boolean;
}) {
  const useNeg = point.negativeIconIsOn === true && isNegative;
  const image = resolveImageRef(app, useNeg ? point.negativeImage : point.image);
  if (!image) return null;
  const width = numValue(useNeg ? point.negativeIconWidth : point.iconWidth, 0);
  const height = numValue(useNeg ? point.negativeIconHeight : point.iconHeight, 0);
  const inChoice = point.useSeperatePosition === true;
  const onSide = useNeg
    ? inChoice
      ? point.negativeImageOnSideInChoice === true
      : point.negativeImageOnSide === true
    : inChoice
      ? point.imageOnSideInChoice === true
      : point.imageOnSide === true;
  const sidePlacement = useNeg
    ? inChoice
      ? point.negativeImageSidePlacementInChoice === true
      : point.negativeImageSidePlacement === true
    : inChoice
      ? point.imageSidePlacementInChoice === true
      : point.imageSidePlacement === true;
  const afterText = sidePlacement && !onSide;
  const afterBeforeText = !sidePlacement && onSide;
  const beforeText = !sidePlacement && !onSide;
  const afterAfterText = sidePlacement && onSide;
  return { image, width, height, beforeText, afterBeforeText, afterText, afterAfterText };
}

function Scores({
  cyoa,
  choice,
  row,
}: {
  cyoa: UseCyoaResult;
  choice: Choice;
  row: Row;
}) {
  const scores = choice.scores ?? [];
  const activeScores = scores.filter((score) => {
    if (!isScoreShown(score, choice, cyoa.idx, cyoa.state)) return false;
    return isEnabled(score.requireds, cyoa.idx, cyoa.state);
  });
  if (activeScores.length === 0) return null;
  const scoreStyle = textStyle("scoreText", cyoa.idx, cyoa.state, row, choice);
  const filterStyling = getStyling("privateFilterIsOn", cyoa.idx, cyoa.state, row, choice) as Record<
    string,
    unknown
  >;
  const fStr = (key: string): string =>
    typeof filterStyling[key] === "string" ? (filterStyling[key] as string) : "";
  const fOn = (key: string): boolean => filterStyling[key] === true;
  const enabled = isEnabled(choice.requireds, cyoa.idx, cyoa.state);
  const isActive = cyoa.state.activated.has(choice.id);
  return (
    <div className="flex flex-wrap justify-center gap-1.5 pt-1">
      {activeScores.map((score, scoreIndex) => {
        const entry = cyoa.state.activated.get(choice.id);
        const multiple = entry?.multiple ?? 0;
        const point = cyoa.idx.pointTypeMap.get(score.id ?? score.type);
        const value = scoreDisplayValue(choice, scoreIndex, score, cyoa.idx, cyoa.state, multiple);
        const display = scoreDiscountDisplay(choice, score, cyoa.idx, cyoa.state);
        // Discount display mirrors the original ObjectScore: when a discount
        // is active with `discountShow`, its custom text replaces the normal
        // before/after labels (unless `replaceScoreText` is off).
        const before = display.show
          ? [display.replace ? "" : (score.beforeText ?? point?.beforeText ?? ""), display.before]
              .filter(Boolean)
              .join(" ")
          : (score.beforeText ?? point?.beforeText ?? "");
        const after = display.show
          ? [display.replace ? "" : (score.afterText ?? point?.afterText ?? ""), display.after]
              .filter(Boolean)
              .join(" ")
          : (score.afterText ?? point?.afterText ?? "");
        const hideValue = score.hideValue || display.hideValue;
        // Color cascade (original ObjectScore `scoreText`): the scoreText
        // color, overridden by the point type's positive/negative colors when
        // `pointColorsIsOn` (note the original's inverted mapping: a negative
        // change uses `positiveColor`), then by the req/sel state filter
        // colors when those are enabled.
        const checkNegative = value < 0;
        let color = scoreStyle.color;
        if (point?.pointColorsIsOn) {
          color = checkNegative ? point.positiveColor : point.negativeColor;
        }
        if (!enabled && fOn("reqScoreTextColorIsOn") && fStr("reqFilterSTextColor")) {
          color = fStr("reqFilterSTextColor");
        } else if (isActive && fOn("selScoreTextColorIsOn") && fStr("selFilterSTextColor")) {
          color = fStr("selFilterSTextColor");
        }
        const icon = point?.iconIsOn
          ? ScoreIcon({ app: cyoa.idx.app, point, isNegative: !checkNegative })
          : null;
        return (
          <Badge key={`${score.id ?? score.type}-${scoreIndex}`} variant="secondary" style={{ ...scoreStyle, color }}>
            {icon && icon.beforeText ? (
              <img
                src={icon.image}
                alt=""
                className="mx-0.5 self-center"
                style={{ width: icon.width, height: icon.height }}
              />
            ) : null}
            {before ? <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(before) }} /> : null}
            {icon && icon.afterBeforeText ? (
              <img
                src={icon.image}
                alt=""
                className="mx-0.5 self-center"
                style={{ width: icon.width, height: icon.height }}
              />
            ) : null}
            {hideValue ? null : (
              <span
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(formatScoreValue(point, value)),
                }}
              />
            )}
            {icon && icon.afterText ? (
              <img
                src={icon.image}
                alt=""
                className="mx-0.5 self-center"
                style={{ width: icon.width, height: icon.height }}
              />
            ) : null}
            {after ? <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(after) }} /> : null}
            {icon && icon.afterAfterText ? (
              <img
                src={icon.image}
                alt=""
                className="mx-0.5 self-center"
                style={{ width: icon.width, height: icon.height }}
              />
            ) : null}
          </Badge>
        );
      })}
    </div>
  );
}

/**
 * Requirement visibility gate (original ObjectRequired `isShowReq`):
 * `showRequired` must be on; `hideRequired2` hides while the requirement's
 * own sub-requireds are unmet; `hideRequired` shows only while the
 * requirement itself is NOT yet met (a hint that it is missing).
 */
function isReqShown(req: Requireds, idx: CyoaIndex, state: CyoaState): boolean {
  if (!req.showRequired) return false;
  let result = true;
  if (req.hideRequired2) {
    result = checkRequirements(req.requireds, idx, state);
  }
  if (req.hideRequired) {
    if ((req.requireds ?? []).length > 0) {
      result = checkRequirements(req.requireds, idx, state) && !checkReq(req, idx, state);
    } else {
      result = !checkReq(req, idx, state);
    }
  }
  return result;
}

function Requirements({
  cyoa,
  choice,
  row,
  textColor,
}: {
  cyoa: UseCyoaResult;
  choice: Choice;
  row: Row;
  textColor?: string;
}) {
  const reqs = choice.requireds ?? [];
  if (reqs.length === 0) return null;
  // `gid` requirements expand into their global requirement's entries, each
  // gated by its own `showRequired` (the original renders them separately).
  const expanded: Requireds[] = [];
  for (const r of reqs) {
    if (r.type === "gid") {
      const subs = cyoa.idx.globalReqMap.get(r.reqId);
      if (subs && subs.length > 0) {
        for (const sub of subs) {
          if (sub.showRequired !== false) expanded.push(sub);
        }
        continue;
      }
    }
    expanded.push(r);
  }
  const items = expanded
    .filter((r) => isReqShown(r, cyoa.idx, cyoa.state))
    .map((r) => ({
      req: r,
      text: requirementLabel(r, cyoa),
      // Exclusive requirements (`required: false`) gate on the target being
      // NOT active — give them a distinct look so they aren't mistaken for
      // normal requirements.
      negated: r.required === false,
    }))
    .filter((item) => item.text);
  // Requirements chained with a leading "and " beforeText belong to the
  // previous badge (e.g. "Requires: X" + "and Y" condenses to ONE bubble
  // "Requires: X and Y").
  const merged: { text: string; negated: boolean }[] = [];
  for (const item of items) {
    const joinsPrevious = /^\s*and\b/i.test(item.req.beforeText ?? "");
    if (joinsPrevious && merged.length > 0) {
      const prev = merged[merged.length - 1];
      prev.text = `${prev.text} ${item.text}`;
    } else {
      merged.push({ text: item.text, negated: item.negated });
    }
  }
  const labels = merged
    .map((label) => ({ text: sanitizeHtml(label.text), negated: label.negated }))
    .filter((label) => label.text);
  if (labels.length === 0) return null;
  const style = textStyle("scoreText", cyoa.idx, cyoa.state, row, choice);
  return (
    <div className="flex flex-wrap justify-center gap-1.5 pt-1 text-xs text-muted-foreground">
      {labels.map((label, i) => (
        <Badge
          key={i}
          variant="outline"
          className={
            label.negated ? "border-destructive/40 text-destructive" : undefined
          }
          style={{ ...style, color: textColor || undefined }}
        >
          <span dangerouslySetInnerHTML={{ __html: label.text }} />
        </Badge>
      ))}
    </div>
  );
}

/**
 * Core requirement text (before/after/custom excluded): the target choice,
 * the point comparison, or — for `or`/`selFrom*` — the listed targets, so a
 * requirement reads "1 of A, B, C" instead of the count-only "1 of 7".
 */
function requirementCoreText(req: import("@shared/types").Requireds, cyoa: UseCyoaResult): string {
  const { idx } = cyoa;
  switch (req.type) {
    case "id": {
      // Old docs may encode an activation target as `choiceId/ON#suffix`.
      const [targetId, suffix] = req.reqId.split("/ON#");
      const cMap = idx.choiceMap.get(targetId);
      return cMap
        ? `${suffix ? `${suffix} ` : ""}${cMap.choice.title}`
        : `${stripEntityPrefix(targetId)}${suffix ? ` ${suffix}` : ""}`;
    }
    case "points": {
      // The original `getReqText` renders the points value first with the
      // point name ("5 Dream") — no operator is shown.
      const point = idx.pointTypeMap.get(req.reqId);
      return `${req.reqPoints} ${point?.name || stripEntityPrefix(req.reqId)}`;
    }
    case "gid": {
      const reqs = idx.globalReqMap.get(req.reqId);
      return reqs ? requirementCoreText(reqs[0], cyoa) : stripEntityPrefix(req.reqId);
    }
    case "or": {
      const subs = (req.orRequireds ?? [])
        .map((sub) => requirementCoreText(sub, cyoa))
        .filter(Boolean);
      const orNum = req.orNum ?? 1;
      const word = cyoa.app.defaultOrReq ?? "of";
      if ((cyoa.app.orderOrReqText ?? "0") === "1") {
        return `${subs.join(", ")} ${word} ${orNum}`;
      }
      return `${orNum} ${word} ${subs.join(", ")}`;
    }
    case "selFromGroups": {
      const names = (req.selGroups ?? []).map(
        (gid) => idx.groupMap.get(gid)?.name || stripEntityPrefix(gid),
      );
      const num = req.selNum ?? 1;
      const word = cyoa.app.defaultOrReq ?? "of";
      if ((cyoa.app.orderSelReqText ?? "0") === "1") {
        return `${names.join(", ")} ${word} ${num}`;
      }
      return `${num} ${word} ${names.join(", ")}`;
    }
    case "selFromRows": {
      const names = (req.selRows ?? []).map(
        (rid) => idx.rowById.get(rid)?.title || stripEntityPrefix(rid),
      );
      const num = req.selNum ?? 1;
      const word = cyoa.app.defaultOrReq ?? "of";
      if ((cyoa.app.orderSelReqText ?? "0") === "1") {
        return `${names.join(", ")} ${word} ${num}`;
      }
      return `${num} ${word} ${names.join(", ")}`;
    }
    case "selFromWhole": {
      const num = req.selNum ?? 1;
      const word = cyoa.app.defaultOrReq ?? "of";
      return (cyoa.app.orderSelReqText ?? "0") === "1" ? `${word} ${num}` : `${num} ${word}`;
    }
    default:
      return stripEntityPrefix(req.reqId || req.type);
  }
}

/** Human-readable label for a requirement entry (getReqText equivalent). */
function requirementLabel(req: import("@shared/types").Requireds, cyoa: UseCyoaResult): string {
  const { idx } = cyoa;
  const before = req.beforeText ?? "";
  // The legacy editor's default after-requirement text is the placeholder
  // "choice" (e.g. "Required: Some Choice choice") — drop it from display.
  const after = (req.afterText ?? "") === "choice" ? "" : (req.afterText ?? "");
  const text = requirementCoreText(req, cyoa);
  const custom = req.customTextIsOn ? req.customText : "";
  if (custom !== undefined && custom !== "") {
    return replaceText(custom, idx, cyoa.state);
  }
  // Exclusive requirements (`required: false`) gate on the target being NOT
  // active — read as "Not: X" instead of the author's positive before/after
  // text (e.g. "Required:") so they aren't mistaken for normal requirements.
  if (req.required === false) {
    return replaceText(`Not: ${text}`.trim(), idx, cyoa.state);
  }
  return replaceText(
    `${before} ${text} ${after}`.trim(),
    idx,
    cyoa.state,
  );
}

/** Strip known entity-type prefixes (choice-/row-/addon-/point-…) from ids. */
function stripEntityPrefix(id: string): string {
  return id.replace(/^(choice|row|addon|point|group|variable|word|image|sfx)-/, "");
}

/* ------------------------------------------------------------------ */
/* Addons                                                             */
/* ------------------------------------------------------------------ */

function AddonView({
  cyoa,
  addon,
  choice,
  row,
  hidden,
  isFirst = false,
}: {
  cyoa: UseCyoaResult;
  addon: Addon;
  choice: Choice;
  row: Row;
  hidden?: Set<string>;
  isFirst?: boolean;
}) {
  const enabled = isEnabled(addon.requireds, cyoa.idx, cyoa.state);
  const isSelectable = addon.isSelectable === true;
  const selected = isSelectable && cyoa.state.activated.has(addon.id);
  const choiceActive = cyoa.state.activated.has(choice.id);
  // Choice-level `showAllAddons` force-shows every addon of that choice
  // (mirrors the original bumping the global `app.showAllAddons` counter).
  const parentForceShows = choice.showAllAddons === true && choiceActive;
  const forceShow = cyoa.app.showAllAddons > 0 || parentForceShows;
  // Content-hiding choices can toggle the row's `unselAddonRemoved` (9) and
  // `unmetAddonRemoved` (10) flags; the row JSON may also set them directly.
  const unselAddonRemoved = row.unselAddonRemoved === true || hidden?.has("9");
  const unmetAddonRemoved = row.unmetAddonRemoved === true || hidden?.has("10");
  // Visibility mirrors the original AppObject nAddons/sAddons filters:
  // non-selectable addons hide when unmet if `unmetAddonRemoved`; selectable
  // addons hide when unselected if `unselAddonRemoved`, and only selected
  // addons appear in result rows.
  const visible = isSelectable
    ? (!unselAddonRemoved || selected) &&
      (!row.isResultRow || selected) &&
      (forceShow || (!addon.hideAddon || choiceActive) && (addon.showAddon || enabled))
    : (!unmetAddonRemoved || enabled) &&
      (forceShow || (!addon.hideAddon || choiceActive) && (addon.showAddon || enabled));

  if (!visible) return null;
  const titleStyle = textStyle("addonTitle", cyoa.idx, cyoa.state, row, choice);
  const textStyleObj = textStyle("addonText", cyoa.idx, cyoa.state, row, choice);

  // `showScoreInAddon`/`showReqInAddon` render the parent's scores and
  // requirements inside the first addon instead of the choice body.
  const showParentScores = isFirst && choice.showScoreInAddon === true;
  const showParentReqs = isFirst && choice.showReqInAddon === true;
  const addonScores = (addon as SelectableAddon).scores ?? [];
  const addonReqs = addon.requireds ?? [];

  const inner = (
    <>
      {addon.image && !hidden?.has("7") && row.addonImageRemoved !== true ? (
        <img
          src={resolveImageRef(cyoa.app, addon.image)}
          alt=""
          className="w-full"
          style={imageStyle("addonImage", cyoa.idx, cyoa.state, row, choice)}
        />
      ) : null}
      {addon.title && !hidden?.has("6") && row.addonTitleRemoved !== true ? (
        <p
          className="text-sm font-medium"
          style={titleStyle}
          dangerouslySetInnerHTML={renderHtml(addon.title, cyoa.idx, cyoa.state)}
        />
      ) : null}
      {addon.text && !hidden?.has("8") && row.addonTextRemoved !== true ? (
        <p
          className="text-xs leading-4 text-muted-foreground"
          style={textStyleObj}
          dangerouslySetInnerHTML={renderHtml(addon.text, cyoa.idx, cyoa.state)}
        />
      ) : null}
      {!hidden?.has("4") && (showParentScores || addonScores.length > 0) ? (
        <Scores
          cyoa={cyoa}
          choice={(showParentScores ? choice : addon) as Choice}
          row={row}
        />
      ) : null}
      {!hidden?.has("5") && (showParentReqs || addonReqs.length > 0) ? (
        <Requirements
          cyoa={cyoa}
          choice={(showParentReqs ? choice : addon) as Choice}
          row={row}
          textColor={undefined}
        />
      ) : null}
      {isSelectable ? (
        <SelectableAddonControls
          cyoa={cyoa}
          addon={addon}
          choice={choice}
          row={row}
          enabled={enabled}
        />
      ) : null}
    </>
  );

  if (!isSelectable) {
    return (
      <div className="min-w-32 flex-1 basis-40 rounded-md border border-border bg-muted/30 p-2">
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={!enabled && !selected}
      onClick={() => cyoa.toggleAddon(addon, choice, row)}
      aria-pressed={selected}
      className={cn(
        "min-w-32 flex-1 basis-40 rounded-md border p-2 text-start",
        selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-muted/30",
        !enabled && "cursor-not-allowed opacity-50",
        cyoa.app.isPointerCursor && (enabled || selected) && "cursor-pointer",
      )}
    >
      {inner}
    </button>
  );
}

function SelectableAddonControls({
  cyoa,
  addon,
  choice,
  row,
  enabled,
}: {
  cyoa: UseCyoaResult;
  addon: SelectableAddon;
  choice: Choice;
  row: Row;
  enabled: boolean;
}) {
  const entry = cyoa.state.activated.get(addon.id);
  const count = entry?.multiple ?? 0;
  const isMulti = addon.isSelectableMultiple === true;
  if (isMulti) {
    return (
      <span className="mt-1 flex items-center gap-1">
        <button
          type="button"
          className="size-5 rounded-full border border-border text-xs"
          onClick={(event) => {
            event.stopPropagation();
            cyoa.less(addon, row);
          }}
        >
          −
        </button>
        <span className="text-xs tabular-nums">{count}</span>
        <button
          type="button"
          className="size-5 rounded-full border border-border text-xs"
          onClick={(event) => {
            event.stopPropagation();
            cyoa.more(addon, row);
          }}
        >
          +
        </button>
      </span>
    );
  }
  if (!enabled && !entry) return null;
  return (
    <span className="mt-1 block text-xs text-muted-foreground">
      {entry ? "Selected" : "Click to select"}
      <span className="hidden">{choice.id}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Backpack dialog                                                    */
/* ------------------------------------------------------------------ */

function BackpackDialog({
  open,
  onOpenChange,
  cyoa,
  viewport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cyoa: UseCyoaResult;
  viewport: number;
}) {
  const app = cyoa.app;
  const styling = (app.styling ?? {}) as Record<string, unknown>;
  const useBackpackDesign = styling.useBackpackDesign === true;
  const bgColor = (useBackpackDesign ? styling.backpackBgColor : styling.backgroundColor) as
    | string
    | undefined;
  const rawBgImage = (useBackpackDesign ? styling.backpackBgImage : styling.backgroundImage) as
    | string
    | undefined;
  const bgImage = resolveImageRef(app, rawBgImage);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="cyoa-viewer max-h-[90vh] overflow-y-auto"
        style={{
          width: (styling.backPackWidth as number) || undefined,
          backgroundColor: bgColor || undefined,
          backgroundImage: bgImage ? `url(${bgImage})` : undefined,
          backgroundSize: "cover",
        }}
      >
        <DialogHeader>
          <DialogTitle>{app.backpack?.[0]?.title || "Backpack"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-3">
          {(app.backpack ?? [])
            .filter((row) => isEnabled(row.requireds, cyoa.idx, cyoa.state))
            .map((row) => (
              <div key={row.id} className={cn(rowWidthClass(row, app, viewport), "min-w-0")}>
                <RowView cyoa={cyoa} row={row} viewport={viewport} />
              </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Build form                                                         */
/* ------------------------------------------------------------------ */

function BuildFormDialog({
  open,
  onOpenChange,
  cyoa,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cyoa: UseCyoaResult;
}) {
  const [importText, setImportText] = useState("");
  const titles = useMemo(() => {
    const out: string[] = [];
    for (const [id, entry] of cyoa.state.activated) {
      if (entry.isRowButton || entry.isVariable) continue;
      const cMap = cyoa.idx.choiceMap.get(id);
      if (!cMap) continue;
      const label = cMap.choice.title || id;
      out.push(entry.multiple > 0 ? `${label} (x${entry.multiple})` : label);
    }
    return out;
  }, [cyoa.state]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setImportText("");
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Build form</DialogTitle>
          <DialogDescription>
            Selected choices and their build code. Import a code to restore a build.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Selected choices</Label>
            <div className="max-h-40 overflow-y-auto rounded-md border border-border p-2 text-sm">
              {titles.length === 0 ? (
                <p className="text-muted-foreground">Nothing selected.</p>
              ) : (
                <ul className="list-disc space-y-0.5 pl-5">
                  {titles.map((title, i) => (
                    <li key={i}>{title}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="build-code">Build code</Label>
            <Textarea
              id="build-code"
              readOnly
              value={cyoa.buildCode}
              rows={3}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="build-import">Import (paste a build code)</Label>
            <Textarea
              id="build-import"
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              placeholder="choice_id,other_id/ON#2,…"
              rows={3}
              className="font-mono text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            onClick={() => {
              cyoa.importBuildCode(importText);
              toast.success("Build imported");
            }}
          >
            Import build
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Save / load slots                                                  */
/* ------------------------------------------------------------------ */

function SaveLoadDialog({
  open,
  onOpenChange,
  cyoa,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cyoa: UseCyoaResult;
}) {
  const [page, setPage] = useState(0);
  const [name, setName] = useState("");
  const [slots, setSlots] = useState<
    Array<{ slot: string } & import("@/hooks/use-cyoa").BuildSlot>
  >([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) setSlots(cyoa.listSlots());
  }, [open, cyoa]);

  function downloadBuild() {
    const blob = new Blob([cyoa.buildCode], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "build.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      if (!text.trim()) {
        toast.error("The file is empty");
        return;
      }
      cyoa.importBuildCode(text);
      toast.success("Build loaded");
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  const pageSlots = BUILD_SLOT_NAMES.slice(page * 9, page * 9 + 9);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setName("");
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Save / load build</DialogTitle>
          <DialogDescription>
            99 named slots per page. Slots persist in this browser.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={downloadBuild}>
              <IconDownload className="mr-1.5 size-4" />
              Download build (.txt)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <IconUpload className="mr-1.5 size-4" />
              Upload build
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.json,text/plain"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="slot-name">Slot name</Label>
              <Input
                id="slot-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="My build"
              />
            </div>
            <p className="text-xs text-muted-foreground">Name applies to the next Save.</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {pageSlots.map((slot, index) => {
              const data = slots.find((s) => s.slot === slot);
              return (
                <div key={slot} className="flex flex-col gap-1 rounded-md border border-border p-2">
                  <span className="truncate text-xs font-medium">
                    {data?.name || `Slot ${page * 9 + index + 1}`}
                  </span>
                  <span className="truncate text-[10px] text-muted-foreground">
                    {data ? new Date(data.updatedAt).toLocaleString() : "Empty"}
                  </span>
                  <div className="mt-1 flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 flex-1 px-1 text-[10px]"
                      onClick={() => {
                        cyoa.saveSlot(
                          slot,
                          name.trim() || data?.name || `Slot ${page * 9 + index + 1}`,
                        );
                        setSlots(cyoa.listSlots());
                        setName("");
                      }}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 flex-1 px-1 text-[10px]"
                      disabled={!data}
                      onClick={() => {
                        const code = cyoa.loadSlot(slot);
                        if (code != null) {
                          cyoa.importBuildCode(code);
                          toast.success("Build loaded");
                        }
                      }}
                    >
                      Load
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1 text-[10px] text-muted-foreground hover:text-destructive"
                      disabled={!data}
                      onClick={() => {
                        cyoa.deleteSlot(slot);
                        setSlots(cyoa.listSlots());
                      }}
                    >
                      Del
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Prev
            </Button>
            <span className="text-xs text-muted-foreground">Page {page + 1} of 11</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page === 10}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
