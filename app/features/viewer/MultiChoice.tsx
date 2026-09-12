import { Button } from "@/components/ui/button";
import { type UseCyoaResult } from "@/features/viewer/use-cyoa";

import { isEnabled } from "@shared/cyoa-engine";
import type { Choice, Row, SelectableAddon } from "@shared/types";

export function MultiChoice({
  cyoa,
  choice,
  row,
  editing = false,
}: {
  cyoa: UseCyoaResult;
  choice: Choice | SelectableAddon;
  row: Row;
  editing?: boolean;
}) {
  const entry = cyoa.state.activated.get(choice.id);
  const count = entry?.multiple ?? 0;
  const min = Number(choice.numMultipleTimesMinus ?? 0);
  const max = Number(choice.numMultipleTimesPluss ?? 0);
  // Show the same selection count used by the buttons, slider and saved build.
  // Imported linked point totals can be independent of this choice's count.
  const display = String(count);
  const hideCounterUntilSelect = choice.hideCounterUntilSelect && count === 0;

  const enabled = isEnabled(choice.requireds, cyoa.idx, cyoa.state);
  const disabled = editing || row.isInfoRow || !enabled;
  const origin = cyoa.idx.choiceMap.get(choice.id)?.row ?? row;
  if (hideCounterUntilSelect || (choice.hideMultipleCounter && !enabled)) return null;

  if (choice.useSlider) {
    const sliderMin = Math.min(min, count);
    return (
      <div
        className="multi-counter flex w-full items-center gap-2"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          type="range"
          min={sliderMin}
          max={Math.max(max, count, 1)}
          step={1}
          value={Math.min(Math.max(count, sliderMin), Math.max(max, count, 1))}
          disabled={disabled}
          onChange={(event) => {
            const target = parseInt(event.target.value, 10);
            const delta = target - count;
            for (let i = 0; i < Math.abs(delta); i++) {
              if (delta > 0) cyoa.more(choice, origin);
              else cyoa.less(choice, origin);
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
    <div
      className="multi-counter flex items-center justify-center gap-1.5"
      onClick={(event) => event.stopPropagation()}
    >
      {!choice.hideCounter ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9 rounded-full text-xl"
          disabled={disabled || count <= min || choice.selectOnce || choice.forcedActivated}
          onClick={(event) => {
            event.stopPropagation();
            cyoa.less(choice, origin);
          }}
          aria-label="Decrease"
        >
          −
        </Button>
      ) : null}
      <button
        type="button"
        className="min-w-8 rounded-md border border-border px-1 py-0.5 text-center text-sm tabular-nums"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          const raw = window.prompt("Set count", String(count));
          if (raw === null) return;
          const num = parseInt(raw, 10);
          if (Number.isNaN(num)) return;
          const clamped = Math.max(min, max > 0 ? Math.min(num, max) : num);
          const delta = clamped - count;
          for (let i = 0; i < Math.abs(delta); i++) {
            if (delta > 0) cyoa.more(choice, origin);
            else cyoa.less(choice, origin);
          }
        }}
        title="Click to set count"
      >
        {display}
      </button>
      {!choice.hideCounter ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9 rounded-full text-xl"
          disabled={disabled || choice.isNotSelectable || (max > 0 && count >= max)}
          onClick={(event) => {
            event.stopPropagation();
            cyoa.more(choice, origin);
          }}
          aria-label="Increase"
        >
          +
        </Button>
      ) : null}
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
