import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { projectStoragePath } from "@shared/project-routes";

import {
  activateRowButton,
  activateAutomaticChoices,
  applyActivateOther,
  applyChoiceVariables,
  applyDeactivateOther,
  applyDeselectActivateOther,
  applyDuplicateRow,
  applyMissingReqCascade,
  buildCyoaIndex,
  computePointTotals,
  countsTowardLimit,
  createCyoaState,
  deselectChoice,
  encodeBuildCode,
  isEnabled,
  loadBuildCode,
  rollScoreValue,
  recordScoreActivations,
  selectChoice,
  selectOneLess,
  selectOneMore,
  type CyoaIndex,
  type CyoaState,
} from "@shared/cyoa-engine";
import type { App, Choice, Row, SelectableAddon } from "@shared/types";

/** Key under which build slots are persisted (path-scoped like the original). */
function storageKey(slot: string): string {
  const path =
    typeof window !== "undefined" ? projectStoragePath(window.location.pathname) : "cyoa";
  return `iccplus-build:${path}:${slot}`;
}

export interface BuildSlot {
  name: string;
  code: string;
  updatedAt: number;
}

export interface UseCyoaResult {
  app: App;
  idx: CyoaIndex;
  state: CyoaState;
  totals: ReturnType<typeof computePointTotals>;
  /** Build code of the current session (updates as selections change). */
  buildCode: string;
  /** Clear all selections (cleanActivated). */
  clean: () => void;
  /** Toggle a choice (single-select or counter-click semantics). */
  toggleChoice: (choice: Choice, row: Row) => void;
  /** Increment a multi-select choice. */
  more: (choice: Choice | SelectableAddon, row: Row) => void;
  /** Decrement a multi-select choice. */
  less: (choice: Choice | SelectableAddon, row: Row) => void;
  /** Toggle a selectable addon. */
  toggleAddon: (addon: SelectableAddon, choice: Choice, row: Row) => void;
  /** Activate a row button (sum addon / random / variable). */
  rowButton: (row: Row) => void;
  /** Import a build code (replaces the session). */
  importBuildCode: (code: string) => void;
  /** Persist the current build code to a slot. */
  saveSlot: (slot: string, name: string) => boolean;
  storageError: boolean;
  loadSlot: (slot: string) => string | null;
  deleteSlot: (slot: string) => void;
  listSlots: () => Array<{ slot: string } & BuildSlot>;
  /** Play the choice's select/deselect sound effect (data-URL audio). */
  playSfx: (choice: Choice | SelectableAddon, isSelect: boolean) => void;
  setUploadedImage: (id: string, image: string) => void;
  requestImage?: (id: string) => void;
}

interface UseCyoaOptions {
  app: App;
}

/** Named slots shown in the save/load dialog. */
export const BUILD_SLOT_NAMES = Array.from({ length: 99 }, (_, i) => `slot-${i + 1}`);

export function useCyoa({ app }: UseCyoaOptions): UseCyoaResult {
  const [storageError, setStorageError] = useState(false);
  const [state, setState] = useState<CyoaState>(() =>
    activateAutomaticChoices(createCyoaState(app), buildCyoaIndex(app), true),
  );
  // Rebuild the lookup index whenever runtime duplicate rows change.
  const idx = useMemo(() => buildCyoaIndex(app, state.dupRows), [app, state.dupRows]);

  const totals = useMemo(() => computePointTotals(app, idx, state), [app, idx, state]);
  const buildCode = useMemo(() => encodeBuildCode(app, idx, state), [app, idx, state]);

  // Audio buffer cache for SFX (data URLs only).
  const audioCache = useRef(new Map<string, AudioBuffer>());
  const audioCtx = useRef<AudioContext | null>(null);
  const pendingSelections = useRef(new Set<number>());
  const cursorBeforeDelay = useRef<string | null>(null);

  const cancelPendingSelections = useCallback(() => {
    for (const timer of pendingSelections.current) window.clearTimeout(timer);
    pendingSelections.current.clear();
    if (cursorBeforeDelay.current !== null) {
      document.body.style.cursor = cursorBeforeDelay.current;
      cursorBeforeDelay.current = null;
    }
  }, []);

  useEffect(() => cancelPendingSelections, [cancelPendingSelections]);

  const playSfx = useCallback(
    (choice: Choice | SelectableAddon, isSelect: boolean) => {
      const appSfx = idx.app.soundEffects ?? [];
      if (appSfx.length === 0) return;
      let sfxId: string | undefined;
      if (choice.useSfx) {
        const enabled = isSelect ? choice.sfxOnSelect : choice.sfxOnDeselect;
        if (!enabled) return;
        sfxId = isSelect ? choice.sfxIdOnSelect : choice.sfxIdOnDeselect;
      } else {
        const defaultSfx = appSfx.find(
          (sfx) =>
            sfx.isDefault &&
            (isSelect ? sfx.onSelected : sfx.onDeselected) &&
            (sfx.groups?.length === 0 ||
              (choice.groups ?? []).some((g) => (sfx.groups ?? []).includes(g))) &&
            isEnabled(sfx.requireds, idx, state),
        );
        sfxId = defaultSfx?.id;
      }
      if (!sfxId) return;
      const sfx = appSfx.find((s) => s.id === sfxId);
      if (!sfx?.audio) return;
      const audio = sfx.audio;
      try {
        const ctx = (audioCtx.current ??= new AudioContext());
        const playBuffer = (buffer: AudioBuffer) => {
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          const gain = ctx.createGain();
          // Volume is stored as a 0–1 gain (editor slider); clamp defensively
          // so legacy values (e.g. the old 100 default) can't clip.
          gain.gain.value = Math.min(1, Math.max(0, sfx.volume ?? 1));
          source.connect(gain).connect(ctx.destination);
          // Pitch is detune in cents (matches the original store's playSfx).
          source.detune.value = sfx.pitch ?? 0;
          source.start();
        };
        const cached = audioCache.current.get(audio);
        if (cached) {
          playBuffer(cached);
          return;
        }
        // Imported sound effects are blob URLs; fetch supports both those
        // and legacy data URLs. Resume browsers' suspended audio contexts.
        void ctx.resume().catch(() => {});
        void fetch(audio)
          .then((response) => {
            if (!response.ok) throw new Error("Sound effect could not be loaded");
            return response.arrayBuffer();
          })
          .then((bytes) => ctx.decodeAudioData(bytes))
          .then((buffer) => {
            audioCache.current.set(audio, buffer);
            playBuffer(buffer);
          })
          .catch(() => {});
      } catch {
        // Audio is a nicety — never break the play experience over it.
      }
    },
    [idx, state],
  );

  // -------------------------------------------------------------------------
  // Selection pipeline with side effects (words, variables, rolls, prompts)
  // -------------------------------------------------------------------------

  /** Roll random/expression scores for a just-selected choice into state. */
  function rollScores(
    next: CyoaState,
    choice: Choice | SelectableAddon,
    count: number,
    before = next,
  ): CyoaState {
    const scores = choice.scores ?? [];
    let rolled = recordScoreActivations(next, choice, idx, count, before);
    for (let i = 0; i < scores.length; i++) {
      const score = scores[i];
      if (!score.isRandom && !score.useExpression) continue;
      // Roll a value per multiple count (each count gets its own roll).
      for (let c = 1; c <= Math.max(1, Math.abs(count)); c++) {
        const key = `${choice.id}:${i}:${c}`;
        if (!rolled.rolledScores.has(key)) {
          rolled = { ...rolled, rolledScores: new Map(rolled.rolledScores) };
          rolled.rolledScores.set(key, rollScoreValue(choice.id, i, score, idx, rolled));
        }
      }
    }
    return rolled;
  }

  function selectProcess(
    prev: CyoaState,
    choice: Choice | SelectableAddon,
    row: Row,
    kind: "single" | "more",
  ): CyoaState {
    if (choice.isNotSelectable || row.isInfoRow || !isEnabled(row.requireds, idx, prev))
      return prev;
    const original = prev;
    const parent = idx.addonParentMap.get(choice.id);
    if (parent && !prev.activated.has(parent.id)) {
      // Use the full pipeline so the parent's requirements, prompts, scores,
      // and effects behave exactly as if the player selected it directly.
      prev = selectProcess(prev, parent, row, parent.isSelectableMultiple ? "more" : "single");
      if (!prev.activated.has(parent.id)) return original;
    }
    // Both single and multi selection are gated on requirements at select time
    // (the original `checkSelectable`): multi-select counters must not start a
    // choice whose requirements are unmet.
    if (!isEnabled(choice.requireds, idx, prev)) return original;
    if (choice.confirmIsOn) {
      const ok = window.confirm(choice.wordPromptText || "Confirm selection?");
      if (!ok) return original;
    }
    let wordValue: string | undefined = choice.textfieldIsOn
      ? (choice.wordChangeSelect ?? "")
      : undefined;
    if (choice.textfieldIsOn && choice.customTextfieldIsOn) {
      const value = window.prompt(
        choice.wordPromptText || `Enter text for "${choice.title}":`,
        choice.wordChangeDeselect ?? "",
      );
      if (value === null) return original;
      wordValue = value;
    }

    let next: CyoaState;
    if (kind === "more") {
      next = selectOneMore(choice, row, prev, idx);
    } else {
      next = selectChoice(choice, row, idx, prev);
    }
    if (next === prev) return original;

    const count = kind === "more" ? (next.activated.get(choice.id)?.multiple ?? 0) : 1;
    next = rollScores(next, choice, count, prev);

    if (wordValue !== undefined && choice.idOfTheTextfieldWord) {
      next = { ...next, wordValues: new Map(next.wordValues) };
      next.wordValues.set(choice.idOfTheTextfieldWord, wordValue);
    }
    // selectChoice already applies single-selection variable effects.
    if (kind === "more") next = applyChoiceVariables(next, choice, idx, true);
    // Runtime choice effects, in the original's order: duplicate row, then the
    // linked activation chain (activateOtherChoice / deactivateOtherChoice),
    // then the missing-requirement cascade.
    next = applyDuplicateRow(next, choice, idx);
    next = applyActivateOther(next, choice, idx);
    next = applyDeactivateOther(next, choice, idx);
    // `deselectMissingReq` skips the local choice during the pass, but the
    // original re-checks it at the end of `selectObject`/`selectedOneMore` and
    // removes it when the selection itself un-met its requirements (e.g.
    // `cleanACtivatedOnSelect` or `deactivateOtherChoice` dropped a
    // prerequisite). Run the cascade once with the local skipped, then once
    // more without the skip to mirror that self-check.
    next = applyMissingReqCascade(next, idx, choice.id);
    next = applyMissingReqCascade(next, idx);
    if (parent && (!next.activated.has(parent.id) || !next.activated.has(choice.id)))
      return original;
    if (!canAffordChange(original, next)) return original;
    return activateAutomaticChoices(next, idx);
  }

  function canAffordChange(before: CyoaState, after: CyoaState): boolean {
    const previous = computePointTotals(app, idx, before);
    return [...computePointTotals(app, idx, after).values()].every(
      ({ pointType, total }) =>
        !pointType.belowZeroNotAllowed ||
        total >= 0 ||
        total >= (previous.get(pointType.id)?.total ?? 0),
    );
  }

  function deselectProcess(
    prev: CyoaState,
    choice: Choice | SelectableAddon,
    row: Row,
    kind: "single" | "less",
  ): CyoaState {
    if (
      row.isInfoRow ||
      choice.selectOnce ||
      choice.forcedActivated ||
      prev.activated.get(choice.id)?.forcedFrom
    )
      return prev;
    const beforeCount = kind === "less" ? (prev.activated.get(choice.id)?.multiple ?? 0) : 1;
    let next: CyoaState;
    if (kind === "less") {
      next = selectOneLess(choice, row, prev, idx);
    } else {
      next = deselectChoice(choice, row, prev);
    }
    if (next === prev) return prev;
    if (kind === "less" && beforeCount <= 0) {
      next = rollScores(next, choice, next.activated.get(choice.id)?.multiple ?? 0, prev);
    }
    if (choice.textfieldIsOn && choice.idOfTheTextfieldWord) {
      next = { ...next, wordValues: new Map(next.wordValues) };
      next.wordValues.set(choice.idOfTheTextfieldWord, choice.wordChangeDeselect ?? "");
    }
    // Release linked activations started by this choice (per-count picks for
    // random activators), then the missing-requirement cascade (the original
    // runs `deselectMissingReq` right after removing the local choice).
    next = applyDeselectActivateOther(next, choice, idx, beforeCount);
    next = applyChoiceVariables(next, choice, idx, false);
    // Remove only the rolls belonging to copies that were deselected. The
    // remaining copies must retain the values they originally rolled.
    const remaining = next.activated.get(choice.id)?.multiple ?? 0;
    const prefix = `${choice.id}:`;
    next = {
      ...next,
      scoreActivations: new Map(
        [...(next.scoreActivations ?? [])].filter(
          ([key]) =>
            !key.startsWith(prefix) ||
            (remaining !== 0 &&
              Number(key.slice(prefix.length).split(":")[1]) <= Math.abs(remaining)),
        ),
      ),
      rolledScores: new Map(
        [...next.rolledScores].filter(([key]) => {
          if (!key.startsWith(prefix)) return true;
          if (remaining === 0) return false;
          const [, count] = key.slice(prefix.length).split(":");
          return count === undefined || Number(count) <= Math.abs(remaining);
        }),
      ),
    };
    // Variable-dependent choices must see the updated variable values.
    next = applyMissingReqCascade(next, idx);
    const parent = idx.addonParentMap.get(choice.id);
    if (
      parent &&
      !next.activated.has(choice.id) &&
      next.activated.has(parent.id) &&
      (choice.deselectParent || choice.deselectWhenNoAddon || parent.deselectWhenNoAddon) &&
      !(parent.addons ?? []).some((addon) => addon.isSelectable && next.activated.has(addon.id))
    ) {
      next = deselectProcess(next, parent, row, "single");
    }
    if (!canAffordChange(prev, next)) return prev;
    return activateAutomaticChoices(next, idx);
  }

  /**
   * Selection delay (`isSelectDelayed`/`isDeselectDelayed`): delay the actual
   * state change and hide the cursor until it completes (matches the original
   * fade-in delay behavior). Returns true when the action was deferred.
   */
  function withSelectionDelay(
    choice: Choice | SelectableAddon,
    isSelect: boolean,
    apply: () => void,
  ): boolean {
    const flag = isSelect ? choice.isSelectDelayed : choice.isDeselectDelayed;
    const ms = Number(isSelect ? choice.selectDelayTime : (choice.deselectDelayTime ?? 0));
    if (!flag || !Number.isFinite(ms) || ms <= 0) {
      apply();
      return false;
    }
    if (pendingSelections.current.size === 0) {
      cursorBeforeDelay.current = document.body.style.cursor;
    }
    document.body.style.cursor = "none";
    const timer = window.setTimeout(() => {
      pendingSelections.current.delete(timer);
      if (pendingSelections.current.size === 0) {
        document.body.style.cursor = cursorBeforeDelay.current ?? "";
        cursorBeforeDelay.current = null;
      }
      apply();
    }, ms);
    pendingSelections.current.add(timer);
    return true;
  }

  const toggleChoice = useCallback(
    (choice: Choice, row: Row) => {
      if (choice.isSelectableMultiple) {
        if (!choice.allowSelectByClick) {
          // Counter-only choices ignore plain card clicks.
          return;
        }
        // Card click increments the counter once (the original viewer's
        // `activateObject` always runs `selectedOneMore` for multi-select
        // choices; use the − control to deselect).
        withSelectionDelay(choice, true, () => {
          playSfx(choice, true);
          setState((prev) => selectProcess(prev, choice, row, "more"));
        });
        return;
      }
      // Single-select choices are stored as `{ multiple: 0 }`, so presence in
      // the activated map (not the count) is what makes them active.
      const isActive = state.activated.has(choice.id);
      if (isActive) {
        withSelectionDelay(choice, false, () => {
          playSfx(choice, false);
          setState((prev) => deselectProcess(prev, choice, row, "single"));
        });
        return;
      }
      withSelectionDelay(choice, true, () => {
        playSfx(choice, true);
        setState((prev) => selectProcess(prev, choice, row, "single"));
      });
    },
    [idx, playSfx, state.activated],
  );

  const more = useCallback(
    (choice: Choice | SelectableAddon, row: Row) => {
      const wasZero = (state.activated.get(choice.id)?.multiple ?? 0) === 0;
      const apply = () => {
        setState((prev) => {
          const prevZero = (prev.activated.get(choice.id)?.multiple ?? 0) === 0;
          const next = selectProcess(prev, choice, row, "more");
          if (next !== prev && prevZero) playSfx(choice, true);
          return next;
        });
      };
      withSelectionDelay(choice, true, apply);
      void wasZero;
    },
    [idx, playSfx, state.activated],
  );

  const less = useCallback(
    (choice: Choice | SelectableAddon, row: Row) => {
      const apply = () => {
        setState((prev) => {
          const prevOne = (prev.activated.get(choice.id)?.multiple ?? 0) === 1;
          const next = deselectProcess(prev, choice, row, "less");
          if (next !== prev && prevOne) playSfx(choice, false);
          return next;
        });
      };
      withSelectionDelay(choice, false, apply);
    },
    [idx, playSfx, state.activated],
  );

  const toggleAddon = useCallback(
    (addon: SelectableAddon, choice: Choice, row: Row) => {
      if (addon.isSelectableMultiple) {
        if (addon.allowSelectByClick) more(addon, row);
        return;
      }
      setState((prev) => {
        const willSelect = !prev.activated.has(addon.id);
        let next = prev;
        if (willSelect) {
          next = selectProcess(prev, addon, row, "single");
        } else {
          next = deselectProcess(prev, addon, row, "single");
        }
        if (next !== prev) playSfx(addon, willSelect);
        return next;
      });
    },
    [idx, playSfx, more],
  );

  const rowButton = useCallback(
    (row: Row) => {
      setState((prev) => {
        const next = activateRowButton(row, idx, prev, (choice, current) => {
          const selected = selectProcess(
            current,
            choice,
            row,
            choice.isSelectableMultiple ? "more" : "single",
          );
          if (selected !== current) playSfx(choice, true);
          return selected;
        });
        return next === prev ? prev : applyMissingReqCascade(next, idx);
      });
    },
    [idx, playSfx],
  );

  const clean = useCallback(() => {
    cancelPendingSelections();
    setState((prev) => {
      const next = createCyoaState(app);
      const reActivate: Array<{ choice: Choice | SelectableAddon; picks?: string[] }> = [];
      for (const [id, entry] of prev.activated) {
        if (entry.isRowButton || entry.isVariable) continue;
        const cMap = idx.choiceMap.get(id);
        if (cMap?.choice.notDeselectedByClean) {
          if (!next.activated.has(id) && countsTowardLimit(cMap.choice)) {
            const rowId = cMap.row.id;
            next.currentChoices.set(rowId, (next.currentChoices.get(rowId) ?? 0) + 1);
          }
          next.activated.set(id, entry);
          // Retaining the selection also retains the values the player chose
          // or rolled for it. Otherwise reset silently changes its score/build.
          for (const [key, value] of prev.rolledScores) {
            if (key.startsWith(`${id}:`)) next.rolledScores.set(key, value);
          }
          for (const [key, value] of prev.scoreActivations ?? []) {
            if (key.startsWith(`${id}:`)) next.scoreActivations!.set(key, value);
          }
          const wordId = cMap.choice.idOfTheTextfieldWord;
          if (wordId && prev.wordValues.has(wordId)) {
            next.wordValues.set(wordId, prev.wordValues.get(wordId)!);
          }
          if (prev.uploadedImages.has(id)) {
            next.uploadedImages.set(id, prev.uploadedImages.get(id)!);
          }
        }
        const choice = cMap?.choice as
          | (Choice & {
              activateOtherChoice?: boolean;
              activateThisChoice?: string;
              isAllowDeselect?: boolean;
              activateAfterReset?: boolean;
              isActivateRandom?: boolean;
            })
          | undefined;
        if (!choice?.activateOtherChoice || typeof choice.activateThisChoice === "undefined")
          continue;
        if (choice.isAllowDeselect && !choice.activateAfterReset) continue;
        // Re-activate linked targets after reset (original `cleanActivated`),
        // replaying the recorded random picks when available.
        const perCount = prev.activatedRandom.get(id);
        const picks = perCount ? perCount.flat() : undefined;
        reActivate.push({ choice, picks });
      }
      let result = next;
      for (const { choice, picks } of reActivate) {
        result = applyActivateOther(result, choice, idx, picks);
      }
      // Reset re-activates linked targets, then sanitizes requirements exactly
      // like the original `cleanActivated` -> `activateProc` chain.
      return activateAutomaticChoices(applyMissingReqCascade(result, idx), idx);
    });
  }, [app, idx, cancelPendingSelections]);

  const importBuildCode = useCallback(
    (code: string) => {
      cancelPendingSelections();
      // Loaded builds are sanitized by the missing-requirement cascade, like
      // the original `loadActivated` -> `activateProc` -> `deselectMissingReq`.
      setState(applyMissingReqCascade(loadBuildCode(code, app, idx), idx));
    },
    [app, idx, cancelPendingSelections],
  );

  const saveSlot = useCallback(
    (slot: string, name: string) => {
      const entry: BuildSlot = { name, code: buildCode, updatedAt: Date.now() };
      try {
        localStorage.setItem(storageKey(slot), JSON.stringify(entry));
        setStorageError(false);
        return true;
      } catch {
        setStorageError(true);
        return false;
      }
    },
    [buildCode],
  );

  const loadSlot = useCallback((slot: string): string | null => {
    try {
      const raw = localStorage.getItem(storageKey(slot));
      if (!raw) return null;
      const entry = JSON.parse(raw) as BuildSlot;
      return entry.code ?? null;
    } catch {
      return null;
    }
  }, []);

  const deleteSlot = useCallback((slot: string) => {
    try {
      localStorage.removeItem(storageKey(slot));
    } catch {
      // ignore
    }
  }, []);

  const listSlots = useCallback((): Array<{ slot: string } & BuildSlot> => {
    const out: Array<{ slot: string } & BuildSlot> = [];
    for (const slot of BUILD_SLOT_NAMES) {
      try {
        const raw = localStorage.getItem(storageKey(slot));
        if (!raw) continue;
        const entry = JSON.parse(raw) as BuildSlot;
        out.push({ slot, ...entry });
      } catch {
        // skip corrupt entries
      }
    }
    return out;
  }, []);

  // Keep the latest committed build without restarting the autosave clock on
  // every selection (continuous play must not postpone saving indefinitely).
  const latestBuildCode = useRef(buildCode);
  useEffect(() => {
    latestBuildCode.current = buildCode;
  }, [buildCode]);

  // Autosave to the buildAutoSave slot when enabled.
  useEffect(() => {
    if (!app.buildAutoSaveIsOn) return;
    const minutes = Number(app.buildAutoSaveInterval ?? 10);
    const interval = Math.max(1, Number.isFinite(minutes) ? minutes : 10) * 60_000;
    const timer = setInterval(() => {
      const entry: BuildSlot = {
        name: "Auto save",
        code: latestBuildCode.current,
        updatedAt: Date.now(),
      };
      try {
        localStorage.setItem(storageKey("buildAutoSave"), JSON.stringify(entry));
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
    }, interval);
    return () => clearInterval(timer);
  }, [app.buildAutoSaveIsOn, app.buildAutoSaveInterval]);

  return {
    app,
    idx,
    state,
    totals,
    buildCode,
    clean,
    toggleChoice,
    more,
    less,
    toggleAddon,
    rowButton,
    importBuildCode,
    saveSlot,
    storageError,
    loadSlot,
    deleteSlot,
    listSlots,
    playSfx,
    setUploadedImage: (id, image) => {
      setState((prev) => {
        if (!prev.activated.has(id) || !idx.choiceMap.get(id)?.choice.isImageUpload) return prev;
        const uploadedImages = new Map(prev.uploadedImages);
        uploadedImages.set(id, image);
        return { ...prev, uploadedImages };
      });
    },
  };
}
