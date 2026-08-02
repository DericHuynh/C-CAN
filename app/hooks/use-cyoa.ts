import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  activateRowButton,
  applyActivateOther,
  applyDeactivateOther,
  applyDeselectActivateOther,
  applyDuplicateRow,
  buildCyoaIndex,
  computePointTotals,
  createCyoaState,
  deselectChoice,
  encodeBuildCode,
  isEnabled,
  loadBuildCode,
  rollScoreValue,
  selectChoice,
  selectOneLess,
  selectOneMore,
  toggleSelectableAddon,
  type CyoaIndex,
  type CyoaState,
} from "@shared/cyoa-engine";
import type { App, Choice, Row, SelectableAddon } from "@shared/types";

/** Key under which build slots are persisted (path-scoped like the original). */
function storageKey(slot: string): string {
  const path = typeof window !== "undefined" ? window.location.pathname : "cyoa";
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
  saveSlot: (slot: string, name: string) => void;
  loadSlot: (slot: string) => string | null;
  deleteSlot: (slot: string) => void;
  listSlots: () => Array<{ slot: string } & BuildSlot>;
  /** Play the choice's select/deselect sound effect (data-URL audio). */
  playSfx: (choice: Choice | SelectableAddon, isSelect: boolean) => void;
}

interface UseCyoaOptions {
  app: App;
}

/** Named slots shown in the save/load dialog. */
export const BUILD_SLOT_NAMES = Array.from(
  { length: 99 },
  (_, i) => `slot-${i + 1}`,
);

export function useCyoa({ app }: UseCyoaOptions): UseCyoaResult {
  const [state, setState] = useState<CyoaState>(() => {
    const initial = createCyoaState(app);
    // Auto-active choices: seed the session with their selection.
    const initialIdx = buildCyoaIndex(app);
    for (const row of app.rows ?? []) {
      for (const choice of row.objects ?? []) {
        if (choice.isAutoActive && !choice.isNotSelectable) {
          initial.activated.set(choice.id, { multiple: 0 });
          initial.currentChoices.set(
            row.id,
            (initial.currentChoices.get(row.id) ?? 0) + 1,
          );
          if (choice.isChangeVariables) {
            for (const variableId of choice.changedVariables ?? []) {
              if (initialIdx.variableMap.has(variableId)) {
                initial.variables.set(variableId, true);
                initial.activated.set(variableId, { multiple: 0, isVariable: true });
              }
            }
          }
        }
      }
    }
    return initial;
  });
  // Rebuild the lookup index whenever runtime duplicate rows change.
  const idx = useMemo(() => buildCyoaIndex(app, state.dupRows), [app, state.dupRows]);

  const totals = useMemo(
    () => computePointTotals(app, idx, state),
    [app, idx, state],
  );
  const buildCode = useMemo(
    () => encodeBuildCode(app, idx, state),
    [app, idx, state],
  );

  // Audio buffer cache for SFX (data URLs only).
  const audioCache = useRef(new Map<string, AudioBuffer>());
  const audioCtx = useRef<AudioContext | null>(null);

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
        const base64 = audio.split(",")[1];
        if (!base64) return;
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        void ctx.decodeAudioData(bytes.buffer).then((buffer) => {
          audioCache.current.set(audio, buffer);
          playBuffer(buffer);
        });
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
  ): CyoaState {
    const scores = choice.scores ?? [];
    let rolled = next;
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

  function applyChoiceVariables(
    next: CyoaState,
    choice: Choice | SelectableAddon,
    isSelect: boolean,
  ): CyoaState {
    if (!choice.isChangeVariables) return next;
    const changeType = choice.changeType ?? "1";
    for (const variableId of choice.changedVariables ?? []) {
      if (!idx.variableMap.has(variableId)) continue;
      let value: boolean | undefined;
      if (changeType === "3") {
        value = !(next.variables.get(variableId) === true);
      } else if (isSelect) {
        value = changeType === "2" ? false : true;
      } else {
        value = changeType === "2" ? true : false;
      }
      const copy = { ...next, variables: new Map(next.variables), activated: new Map(next.activated) };
      copy.variables.set(variableId, value);
      if (value) {
        copy.activated.set(variableId, { multiple: 0, isVariable: true });
      } else {
        copy.activated.delete(variableId);
      }
      next = copy;
    }
    return next;
  }

  function selectProcess(
    prev: CyoaState,
    choice: Choice | SelectableAddon,
    row: Row,
    kind: "single" | "more",
  ): CyoaState {
    if (choice.isNotSelectable) return prev;
    if (kind === "single" && !isEnabled(choice.requireds, idx, prev)) return prev;
    if (choice.confirmIsOn) {
      const ok = window.confirm(choice.wordPromptText || "Confirm selection?");
      if (!ok) return prev;
    }
    let wordValue: string | undefined;
    if (choice.textfieldIsOn && choice.customTextfieldIsOn) {
      const value = window.prompt(
        choice.wordPromptText || `Enter text for "${choice.title}":`,
        choice.wordChangeDeselect ?? "",
      );
      if (value === null) return prev;
      wordValue = value;
    }

    let next: CyoaState;
    if (kind === "more") {
      next = selectOneMore(choice, row, prev, idx);
    } else {
      next = selectChoice(choice, row, idx, prev);
    }
    if (next === prev) return prev;

    const count = kind === "more" ? (next.activated.get(choice.id)?.multiple ?? 0) : 1;
    next = rollScores(next, choice, count);

    if (choice.isImageUpload && !next.uploadedImages.has(choice.id)) {
      const url = window.prompt("Image URL", choice.image || "");
      if (url) {
        next = { ...next, uploadedImages: new Map(next.uploadedImages) };
        next.uploadedImages.set(choice.id, url);
      }
    }
    if (wordValue !== undefined && choice.idOfTheTextfieldWord) {
      next = { ...next, wordValues: new Map(next.wordValues) };
      next.wordValues.set(choice.idOfTheTextfieldWord, wordValue);
    }
    next = applyChoiceVariables(next, choice, true);
    // Runtime choice effects, in the original's order: duplicate row, then the
    // linked activation chain (activateOtherChoice / deactivateOtherChoice).
    next = applyDuplicateRow(next, choice, idx);
    next = applyActivateOther(next, choice, idx);
    next = applyDeactivateOther(next, choice, idx);
    return next;
  }

  function deselectProcess(
    prev: CyoaState,
    choice: Choice | SelectableAddon,
    row: Row,
    kind: "single" | "less",
  ): CyoaState {
    const beforeCount =
      kind === "less" ? (prev.activated.get(choice.id)?.multiple ?? 1) : 1;
    let next: CyoaState;
    if (kind === "less") {
      next = selectOneLess(choice, row, prev);
    } else {
      next = deselectChoice(choice, row, prev);
    }
    if (next === prev) return prev;
    if (choice.textfieldIsOn && choice.idOfTheTextfieldWord) {
      next = { ...next, wordValues: new Map(next.wordValues) };
      next.wordValues.set(choice.idOfTheTextfieldWord, choice.wordChangeDeselect ?? "");
    }
    // Release linked activations started by this choice (per-count picks for
    // random activators).
    next = applyDeselectActivateOther(next, choice, idx, beforeCount);
    // Remove rolled scores for this choice.
    next = {
      ...next,
      rolledScores: new Map(
        [...next.rolledScores].filter(([key]) => !key.startsWith(`${choice.id}:`)),
      ),
    };
    return applyChoiceVariables(next, choice, false);
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
    const ms = Number(isSelect ? choice.selectDelayTime : choice.deselectDelayTime ?? 0);
    if (!flag || !Number.isFinite(ms) || ms <= 0) {
      apply();
      return false;
    }
    const previous = document.body.style.cursor;
    document.body.style.cursor = "none";
    window.setTimeout(() => {
      document.body.style.cursor = previous;
      apply();
    }, ms);
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
      setState((prev) => {
        const willSelect = !prev.activated.has(addon.id);
        let next = prev;
        if (willSelect) {
          next = selectProcess(prev, addon, row, "single");
        } else {
          next = deselectProcess(prev, addon, row, "single");
        }
        // Parent auto-selection handled inside the engine's toggle; re-apply
        // parent requirements before selecting the addon.
        if (next !== prev) playSfx(addon, willSelect);
        return next;
      });
    },
    [idx, playSfx],
  );

  const rowButton = useCallback(
    (row: Row) => {
      setState((prev) => activateRowButton(row, idx, prev));
    },
    [idx],
  );

  const clean = useCallback(() => {
    setState((prev) => {
      const next = createCyoaState(app);
      const reActivate: Array<{ choice: Choice | SelectableAddon; picks?: string[] }> = [];
      for (const [id, entry] of prev.activated) {
        if (entry.isRowButton || entry.isVariable) continue;
        const cMap = idx.choiceMap.get(id);
        if (cMap?.choice.notDeselectedByClean) {
          next.activated.set(id, entry);
          const rowId = cMap.row.id;
          next.currentChoices.set(rowId, (next.currentChoices.get(rowId) ?? 0) + 1);
        }
        const choice = cMap?.choice as
          | (Choice & { activateOtherChoice?: boolean; activateThisChoice?: string; isAllowDeselect?: boolean; activateAfterReset?: boolean; isActivateRandom?: boolean })
          | undefined;
        if (!choice?.activateOtherChoice || typeof choice.activateThisChoice === "undefined") continue;
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
      return result;
    });
  }, [app, idx]);

  const importBuildCode = useCallback(
    (code: string) => {
      setState(loadBuildCode(code, app, idx));
    },
    [app, idx],
  );

  const saveSlot = useCallback(
    (slot: string, name: string) => {
      const entry: BuildSlot = { name, code: buildCode, updatedAt: Date.now() };
      try {
        localStorage.setItem(storageKey(slot), JSON.stringify(entry));
      } catch {
        // Storage may be unavailable (private mode) — non-fatal.
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

  // Autosave to the buildAutoSave slot when enabled.
  useEffect(() => {
    if (!app.buildAutoSaveIsOn) return;
    const interval = Math.max(1, Number(app.buildAutoSaveInterval ?? 60)) * 1000;
    const timer = setInterval(() => {
      const entry: BuildSlot = { name: "Auto save", code: buildCode, updatedAt: Date.now() };
      try {
        localStorage.setItem(storageKey("buildAutoSave"), JSON.stringify(entry));
      } catch {
        // ignore
      }
    }, interval);
    return () => clearInterval(timer);
  }, [app.buildAutoSaveIsOn, app.buildAutoSaveInterval, buildCode]);

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
    loadSlot,
    deleteSlot,
    listSlots,
    playSfx,
  };
}
