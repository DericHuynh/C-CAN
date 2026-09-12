import { useEffect, useRef, useState } from "react";
import { type UseCyoaResult } from "@/features/viewer/use-cyoa";
import type { Choice, SelectableAddon } from "@shared/types";

export function useViewerAudio(cyoa: UseCyoaResult) {
  const app = cyoa.app;
  const mounted = useRef(true);
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
  const bgmSelections = useRef(new Set<string>());
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
        if (!mounted.current || currentBgmRef.current !== meta) return;
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
                if (!mounted.current || currentBgmRef.current !== meta) {
                  player.destroy();
                  return;
                }
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
                if (!mounted.current || currentBgmRef.current !== meta) return;
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
        if (!mounted.current || currentBgmRef.current !== meta) return;
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
    const before = bgmSelections.current;
    bgmSelections.current = new Set(cyoa.state.activated.keys());
    for (const [id] of cyoa.state.activated) {
      if (before.has(id)) continue;
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

  useEffect(() => {
    mounted.current = true;
    const audio = audioRef.current;
    return () => {
      mounted.current = false;
      clearFadeTimer();
      audio?.pause();
      try {
        ytPlayerRef.current?.player.destroy();
      } catch {
        /* Already detached. */
      }
      ytPlayerRef.current = null;
    };
  }, []);

  return {
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
  };
}
