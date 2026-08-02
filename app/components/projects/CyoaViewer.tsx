import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  IconBackpack,
  IconCircleCheck,
  IconDownload,
  IconLock,
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
import {
  BUILD_SLOT_NAMES,
  useCyoa,
  type UseCyoaResult,
} from "@/hooks/use-cyoa";
import { cn } from "@/lib/utils";
import {
  backgroundOverrides,
  checkActivated,
  checkPointEnable,
  computeScoreNet,
  effectiveTemplate,
  effectiveWidth,
  encodeBuildCode,
  getSearchables,
  groupRowChoices,
  hiddenContentsFor,
  isEnabled,
  isRowButtonDisabled,
  pointBarOverrides,
  replaceText,
  resultRowChoices,
  scoreDiscountDisplay,
  type CyoaState,
} from "@shared/cyoa-engine";
import type {
  Addon,
  App,
  Choice,
  NonSelectableAddon,
  PointType,
  Row,
  SelectableAddon,
} from "@shared/types";

import {
  choiceSurfaceStyle,
  choiceWidthClass,
  formatPointValue,
  isChoiceShown,
  rowWidthClass,
  templateClasses,
  textStyle,
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
  const [dialog, setDialog] = useState<"backpack" | "build" | "save" | "search" | null>(null);
  const [fade, setFade] = useState<{ color: string; time: number } | null>(null);
  const [viewport, setViewport] = useState<number>(() =>
    typeof window === "undefined" ? 1280 : window.innerWidth,
  );

  useEffect(() => {
    const onResize = () => setViewport(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Loading overlay: shown on mount (and whenever viewerConfig changes),
  // faded out after a short delay. Simple timeout is fine (parity with the
  // original viewer's fixed loading screen).
  const [loadingStage, setLoadingStage] = useState<"hidden" | "shown" | "fading">(
    "hidden",
  );
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
      const choice = cMap?.choice as (Choice & { isFadeTransition?: boolean; fadeTransitionColor?: string; fadeTransitionTime?: number }) | undefined;
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

  function startYoutubeBgm(videoId: string, meta: (typeof currentBgmRef.current) & object) {
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

  const visiblePoints = (app.pointTypes ?? []).filter((pt) =>
    checkPointEnable(pt, cyoa.idx, cyoa.state),
  );
  const pointBarIsOn =
    visiblePoints.length > 0 ||
    (app.backpack?.length ?? 0) > 0 ||
    app.importedChoicesIsOpen;

  const showBackpackBtn =
    (app.backpack?.length ?? 0) > 0 &&
    (app.hideBackpackBtn === 0 || app.hideBackpackBtn === app.btnBackpackIsOn);

  // Background overrides from active `changeBackground` choices.
  const bgOverrides = backgroundOverrides(cyoa.idx, cyoa.state);
  const viewerBackgroundColor =
    bgOverrides.color ?? ((app.styling?.backgroundColor as string) || undefined);
  const viewerBackgroundImage =
    bgOverrides.image ?? ((app.styling?.backgroundImage as string) || undefined);

  // Scroll to a row/choice when a `scrollToRow`/`scrollToObject` choice is
  // freshly selected (mirrors the original `selectScroll`).
  const lastScrollChoice = useRef<string | null>(null);
  useEffect(() => {
    for (const [id] of cyoa.state.activated) {
      if (lastScrollChoice.current === id) continue;
      const cMap = cyoa.idx.choiceMap.get(id);
      const choice = cMap?.choice as
        | (Choice & { scrollToRow?: boolean; scrollToObject?: boolean; scrollRowId?: string; scrollObjectId?: string })
        | undefined;
      if (choice?.scrollToRow) {
        lastScrollChoice.current = id;
        const targetId = choice.scrollToObject && choice.scrollObjectId ? choice.scrollObjectId : choice.scrollRowId;
        if (targetId) {
          window.setTimeout(() => {
            const el = document.querySelector(`[data-cyoa-row="${CSS.escape(targetId)}"], [data-cyoa-choice="${CSS.escape(targetId)}"]`);
            el?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 50);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cyoa.state.activated]);

  return (
    <div
      className={cn("space-y-8", className)}
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
        style={{ position: "fixed", width: 0, height: 0, overflow: "hidden", pointerEvents: "none" }}
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

      {pointBarIsOn ? (
        <PointBar
          app={app}
          cyoa={cyoa}
          showBackpackBtn={showBackpackBtn}
          onOpenBackpack={() => setDialog("backpack")}
          onOpenSearch={() => setDialog("search")}
          onOpenBuild={() => setDialog("build")}
          onOpenSave={() => setDialog("save")}
          onClean={cyoa.clean}
        />
      ) : null}

      {app.rows?.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No rows yet — edit the CYOA to add content.
          </p>
        </div>
      ) : (
        <div className="row-gap-6 -mx-4 flex flex-wrap gap-6 px-4 lg:-mx-6 lg:px-6">
          {(cyoa.idx.rows ?? app.rows ?? []).map((row) => (
            <div
              key={row.id}
              data-cyoa-row={row.id}
              className={cn(
                rowWidthClass(row, app, viewport),
                "min-w-0",
              )}
            >
              <RowView cyoa={cyoa} row={row} viewport={viewport} />
            </div>
          ))}
        </div>
      )}

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
      <SearchDialog
        open={dialog === "search"}
        onOpenChange={(open) => setDialog(open ? "search" : null)}
        cyoa={cyoa}
        viewport={viewport}
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
              {isMuted ? (
                <IconVolumeOff className="size-4" />
              ) : (
                <IconVolume className="size-4" />
              )}
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
  // Point bar at the bottom of the viewport when topPointBar is false
  // (parity with the original viewer's bottom bar).
  const pointBarAtBottom = app.topPointBar === false;
  const barOverrides = pointBarOverrides(cyoa.idx, cyoa.state);

  return (
    <div
      className={cn(
        "z-20 -mx-4 border-border px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/75 lg:-mx-6 lg:px-6",
        pointBarAtBottom
          ? "sticky bottom-0 border-t"
          : "sticky top-0 border-b",
      )}
      style={{
        backgroundColor: barOverrides.bgColor ?? ((styling.barBackgroundColor as string) || undefined),
        color: barOverrides.textColor ?? ((styling.barTextColor as string) || undefined),
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          {(app.pointTypes ?? [])
            .filter((pt) => checkPointEnable(pt, cyoa.idx, cyoa.state))
            .map((pointType) => {
              const total = cyoa.totals.get(pointType.id)?.total ?? Number(pointType.startingSum ?? 0);
              const starting = Number(pointType.startingSum ?? 0);
              const isLow = total < starting;
              const isHigh = total > starting;
              const color = isLow
                ? (barOverrides.iconColor ?? (styling.barPointNeg as string))
                : isHigh
                  ? (barOverrides.iconColor ?? (styling.barPointPos as string))
                  : undefined;
              return (
                <div
                  key={pointType.id}
                  className="flex items-baseline gap-1.5 text-sm"
                >
                  {pointType.iconIsOn && pointType.image ? (
                    <img
                      src={pointType.image}
                      alt=""
                      className="h-4 w-4 object-contain"
                    />
                  ) : null}
                  <span className="font-medium text-foreground">
                    {pointType.name}
                  </span>
                  {pointType.beforeText ? (
                    <span className="text-muted-foreground">{pointType.beforeText}</span>
                  ) : null}
                  <span
                    className="font-semibold tabular-nums"
                    style={{ color: color ?? undefined }}
                  >
                    {formatPointValue(pointType, total)}
                  </span>
                  {pointType.afterText ? (
                    <span className="text-muted-foreground">{pointType.afterText}</span>
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
            <div className="absolute right-0 top-9 z-30 w-48 rounded-md border border-border bg-popover p-1 shadow-md">
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

function MenuButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
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

function RowView({
  cyoa,
  row,
  viewport,
}: {
  cyoa: UseCyoaResult;
  row: Row;
  viewport: number;
}) {
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

  return (
    <section className="space-y-3">
        {(row.title || (row.titleText && !rowTextRemoved) || row.image) ? (
          <header className="space-y-1">
          {row.title ? (
            <h2
              className="text-lg font-semibold tracking-tight"
              style={titleStyle}
            >
              {replaceText(row.title, cyoa.idx, cyoa.state)}
            </h2>
          ) : null}
          {row.titleText && !rowTextRemoved ? (
            <p
              className="text-sm leading-6 text-muted-foreground"
              style={textStyleObj}
            >
              {replaceText(row.titleText, cyoa.idx, cyoa.state)}
            </p>
          ) : null}
          {row.image ? (
            <img
              src={row.image}
              alt=""
              className="mt-1 max-h-44 w-full rounded-lg border border-border object-cover"
            />
          ) : null}
        </header>
      ) : null}

      {row.isButtonRow ? (
        <RowButton cyoa={cyoa} row={row} />
      ) : null}

      {row.isResultRow ? (
        <ResultRowContent cyoa={cyoa} row={row} />
      ) : row.isGroupRow ? (
        <GroupRowContent cyoa={cyoa} row={row} />
      ) : (
        <div className="flex flex-wrap gap-3">
          {sortedChoices(row).map((choice) => (
            <div
              key={choice.id}
              className={cn("min-w-0", effectiveChoiceWidth(row, choice, cyoa, viewport))}
            >
              <ChoiceView cyoa={cyoa} choice={choice} row={row} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RowButton({ cyoa, row }: { cyoa: UseCyoaResult; row: Row }) {
  const disabled = isRowButtonDisabled(row, cyoa.state);
  const buttonStyle = cyoa.idx.app.styling as Record<string, unknown>;
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
        "rounded-md border border-border bg-card px-4 py-1.5 text-sm font-medium transition-colors hover:bg-accent",
        disabled && "cursor-not-allowed opacity-50",
      )}
      style={{
        padding: buttonStyle.rowButtonXPadding
          ? `${buttonStyle.rowButtonYPadding ?? 0}px ${buttonStyle.rowButtonXPadding}px`
          : undefined,
      }}
    >
      {replaceText(label, cyoa.idx, cyoa.state)}
    </button>
  );
}

function ResultRowContent({
  cyoa,
  row,
}: {
  cyoa: UseCyoaResult;
  row: Row;
}) {
  const entries = resultRowChoices(row, cyoa.idx, cyoa.state);
  const allowDeselect = cyoa.app.viewerSettings?.allowDeselect === true;
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {entries.map(({ choice, row: origin }) => (
        <div key={choice.id} className="min-w-0 flex-1 basis-64">
          <ChoiceView
            cyoa={cyoa}
            choice={choice}
            row={origin}
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
}: {
  cyoa: UseCyoaResult;
  row: Row;
}) {
  const entries = groupRowChoices(row, cyoa.idx);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {entries.map(({ choice, row: origin }) => (
        <div key={choice.id} className="min-w-0 flex-1 basis-64">
          <ChoiceView cyoa={cyoa} choice={choice} row={origin} info />
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
}

function ChoiceView({ cyoa, choice, row, info = false }: ChoiceViewProps) {
  const enabled = isEnabled(choice.requireds, cyoa.idx, cyoa.state);
  const entry = cyoa.state.activated.get(choice.id);
  const isSelected = entry !== undefined && entry.multiple !== 0;
  const isMulti = choice.isSelectableMultiple === true;
  const surface = choiceSurfaceStyle(choice, row, cyoa.idx, cyoa.state);
  const shown = isChoiceShown(choice, row, cyoa.idx, cyoa.state);
  const text = (choice as Choice & { title?: string; text?: string });
  const titleStyle = textStyle("objectTitle", cyoa.idx, cyoa.state, row, choice);
  const textStyleObj = textStyle("objectText", cyoa.idx, cyoa.state, row, choice);
  const isCounterOnlyMulti = isMulti && !choice.allowSelectByClick;
  const isClickable = !info && !isCounterOnlyMulti && !choice.isNotSelectable;

  const hidden = hiddenContentsFor(row, cyoa.idx, cyoa.state);
  const nAddons = (choice.addons ?? []).filter(
    (a): a is NonSelectableAddon => !a.isSelectable,
  );
  const sAddons = (choice.addons ?? []).filter(
    (a): a is SelectableAddon => a.isSelectable === true,
  );

  if (!shown) return null;

  const counter = isMulti ? (
    <MultiChoice cyoa={cyoa} choice={choice} row={row} />
  ) : null;

  // Scores/requirements move into the first addon when the choice opts into
  // `showScoreInAddon` / `showReqInAddon` (original viewer behavior).
  const showScores = !hidden.has("4") && !choice.showScoreInAddon;
  const showReqs = !hidden.has("5") && !choice.showReqInAddon;

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
              isFirst={!addon.skipIndex && sAddons.length === 0 && i === nAddons.findIndex((a) => !a.skipIndex)}
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
      {text.title && !hidden.has("1") ? (
        <h3 className="font-medium" style={titleStyle}>
          {replaceText(text.title, cyoa.idx, cyoa.state)}
          {isMulti && entry ? <span className="ml-1 text-xs">(x{entry.multiple})</span> : null}
        </h3>
      ) : null}
      {counter}
      {text.text && !hidden.has("3") ? (
        <p className="text-sm leading-5 text-muted-foreground" style={textStyleObj}>
          {replaceText(text.text, cyoa.idx, cyoa.state)}
        </p>
      ) : null}
      {showScores ? (
        <Scores
          cyoa={cyoa}
          choice={choice}
          row={row}
          scoreColor={surface.scoreColor}
        />
      ) : null}
      {showReqs ? (
        <Requirements
          cyoa={cyoa}
          choice={choice}
          row={row}
          textColor={surface.scoreColor}
        />
      ) : null}
      {!choice.useSeperateAddon ? addonsEl : null}
    </>
  );

  const tpl = templateClasses(effectiveTemplate(choice, false, cyoa.idx, cyoa.state));

  return (
    <div
      data-cyoa-choice={choice.id}
      className={cn(
        "relative flex h-full flex-col gap-2 rounded-lg border p-4 text-start transition-colors",
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border bg-card",
        !enabled && "cursor-not-allowed",
        cyoa.app.isPointerCursor && isClickable && "cursor-pointer",
      )}
      style={{
        filter: surface.filter || undefined,
        background: surface.gradient || surface.backgroundColor || undefined,
        borderColor: surface.borderColor || undefined,
      }}
      onClick={() => {
        if (info || isCounterOnlyMulti) return;
        cyoa.toggleChoice(choice, row);
      }}
    >
      {choice.image && !hidden.has("2") ? (
        <div className={tpl.image}>
          <img
            src={choice.image}
            alt=""
            className={cn(
              "rounded-md border border-border object-cover",
              tpl.image ? "h-full w-full" : "h-24 w-full",
            )}
            style={{ borderColor: surface.imageBorderColor || undefined }}
          />
        </div>
      ) : null}
      <div className={tpl.body}>{body}</div>
      {choice.useSeperateAddon ? <div className="mt-2 w-full">{addonsEl}</div> : null}
      {!enabled && !isSelected ? (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <IconLock className="size-3" />
          Locked by requirements
        </span>
      ) : null}
      {isSelected ? (
        <IconCircleCheck className="absolute right-2 top-2 size-5 text-primary" />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Multi-choice counter                                               */
/* ------------------------------------------------------------------ */

function MultiChoice({
  cyoa,
  choice,
  row,
}: {
  cyoa: UseCyoaResult;
  choice: Choice;
  row: Row;
}) {
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
  const hideCounterUntilSelect =
    choice.hideCounterUntilSelect && count === 0;

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
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-6 rounded-full"
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
        className="size-6 rounded-full"
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

function Scores({
  cyoa,
  choice,
  row,
  scoreColor,
}: {
  cyoa: UseCyoaResult;
  choice: Choice;
  row: Row;
  scoreColor?: string;
}) {
  const scores = choice.scores ?? [];
  const activeScores = scores.filter((score) => {
    if (score.showScore === false) return false;
    const point = cyoa.idx.pointTypeMap.get(score.id ?? score.type);
    if (point?.isNotShownObjects) return false;
    if (point?.activatedId && !checkActivated(point.activatedId, cyoa.state)) return false;
    return isEnabled(score.requireds, cyoa.idx, cyoa.state);
  });
  if (activeScores.length === 0) return null;
  const scoreStyle = textStyle("scoreText", cyoa.idx, cyoa.state, row, choice);
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {activeScores.map((score, scoreIndex) => {
        const entry = cyoa.state.activated.get(choice.id);
        const multiple = entry?.multiple ?? 0;
        const point = cyoa.idx.pointTypeMap.get(score.id ?? score.type);
        const value = computeScoreNet(choice, scoreIndex, score, cyoa.idx, cyoa.state, multiple);
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
        const color =
          value < 0
            ? (cyoa.idx.app.styling?.objectGradientOnReq as string) || undefined
            : undefined;
        void row;
        return (
          <Badge
            key={`${score.id ?? score.type}-${scoreIndex}`}
            variant="secondary"
            style={{ ...scoreStyle, color: scoreColor || color }}
          >
            {before ? `${before} ` : ""}
            {hideValue ? "" : `${value > 0 ? "+" : ""}${formatPointValue(point ?? ({} as PointType), value)}`}
            {after ? ` ${after}` : ""}
          </Badge>
        );
      })}
    </div>
  );
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
  const labels = reqs
    .filter((r) => isEnabled([r], cyoa.idx, cyoa.state) || !r.hideRequired)
    .map((r) => requirementLabel(r, cyoa))
    .filter(Boolean);
  if (labels.length === 0) return null;
  const style = textStyle("scoreText", cyoa.idx, cyoa.state, row, choice);
  return (
    <div className="flex flex-wrap gap-1.5 pt-1 text-xs text-muted-foreground">
      {labels.map((label, i) => (
        <Badge key={i} variant="outline" style={{ ...style, color: textColor || undefined }}>
          {label}
        </Badge>
      ))}
    </div>
  );
}

/** Human-readable label for a requirement entry (getReqText equivalent). */
function requirementLabel(req: import("@shared/types").Requireds, cyoa: UseCyoaResult): string {
  const { idx } = cyoa;
  const before = req.beforeText ?? "";
  const after = req.afterText ?? "";
  let text = "";
  switch (req.type) {
    case "id": {
      const cMap = idx.choiceMap.get(req.reqId);
      text = cMap?.choice.title || req.reqId;
      break;
    }
    case "points": {
      const point = idx.pointTypeMap.get(req.reqId);
      const op = { "1": ">", "2": "≥", "3": "=", "4": "≤", "5": "<", "6": "≠" }[
        req.operator ?? "1"
      ];
      text = `${point?.name || req.reqId} ${op ?? ">"} ${req.reqPoints}`;
      break;
    }
    case "gid": {
      const reqs = idx.globalReqMap.get(req.reqId);
      text = reqs ? requirementLabel(reqs[0], cyoa) : req.reqId;
      break;
    }
    case "or": {
      text = `${req.orNum ?? 1} of ${req.orRequireds?.length ?? 0}`;
      break;
    }
    default:
      text = req.reqId || req.type;
  }
  const custom = req.customTextIsOn ? req.customText : "";
  return replaceText(
    (custom !== undefined && custom !== "" ? custom : `${before} ${text} ${after}`.trim()),
    idx,
    cyoa.state,
  );
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
  // Choice-level `showAllAddons` force-shows every addon of that choice
  // (mirrors the original bumping the global `app.showAllAddons` counter).
  const parentForceShows =
    choice.showAllAddons === true && cyoa.state.activated.has(choice.id);
  const visible =
    (addon.showAddon || enabled || cyoa.app.showAllAddons > 0 || parentForceShows) &&
    (!addon.hideAddon || choice.isActive || selected) &&
    !(hidden?.has("9") && isSelectable && !selected) &&
    !(hidden?.has("9") && !isSelectable) &&
    !(hidden?.has("10") && !enabled && !selected);

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
      {addon.image && !hidden?.has("7") ? (
        <img
          src={addon.image}
          alt=""
          className="h-16 w-full rounded-md border border-border object-cover"
        />
      ) : null}
      {addon.title && !hidden?.has("6") ? (
        <p className="text-sm font-medium" style={titleStyle}>
          {replaceText(addon.title, cyoa.idx, cyoa.state)}
        </p>
      ) : null}
      {addon.text && !hidden?.has("8") ? (
        <p className="text-xs leading-4 text-muted-foreground" style={textStyleObj}>
          {replaceText(addon.text, cyoa.idx, cyoa.state)}
        </p>
      ) : null}
      {!hidden?.has("4") && (showParentScores || addonScores.length > 0) ? (
        <Scores
          cyoa={cyoa}
          choice={(showParentScores ? choice : addon) as Choice}
          row={row}
          scoreColor={undefined}
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
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border bg-muted/30",
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
  const bgColor = (useBackpackDesign ? styling.backpackBgColor : styling.backgroundColor) as string | undefined;
  const bgImage = (useBackpackDesign ? styling.backpackBgImage : styling.backgroundImage) as string | undefined;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto"
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
          {(app.backpack ?? []).map((row) => (
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
            Selected choices and their build code. Import a code to restore a
            build.
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
  const [slots, setSlots] = useState<Array<{ slot: string } & import("@/hooks/use-cyoa").BuildSlot>>([]);
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadBuild}
            >
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
            <p className="text-xs text-muted-foreground">
              Name applies to the next Save.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {pageSlots.map((slot, index) => {
              const data = slots.find((s) => s.slot === slot);
              return (
                <div
                  key={slot}
                  className="flex flex-col gap-1 rounded-md border border-border p-2"
                >
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
            <span className="text-xs text-muted-foreground">
              Page {page + 1} of 11
            </span>
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

/* ------------------------------------------------------------------ */
/* Search                                                             */
/* ------------------------------------------------------------------ */

function SearchDialog({
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
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return getSearchables(cyoa.app)
      .filter(
        (entry) =>
          entry.id.toLowerCase().includes(q) ||
          entry.label.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [query, cyoa.app]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setQuery("");
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Search choice</DialogTitle>
          <DialogDescription>
            Find a choice by id or title and select it directly.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <IconSearch className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type an id or title…"
              className="pl-8"
            />
          </div>
          {query && matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matches.</p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            {matches.map((entry) => (
              <div
                key={entry.id}
                className="min-w-0 flex-1 basis-64"
                onClick={() => cyoa.toggleChoice(entry.choice, entry.row)}
              >
                <ChoiceView cyoa={cyoa} choice={entry.choice} row={entry.row} />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
