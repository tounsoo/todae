import { useRef, type ChangeEvent, type ComponentPropsWithRef, type CSSProperties, type PointerEvent, type ReactElement } from 'react';
import { useControlledState } from '../hooks/useControlledState.js';
import { cx } from '../internal/cx.js';
import { composeHandlers } from '../internal/props.js';
import { focusWithoutScroll } from '../internal/revealRing.js';
import { warnOnce } from '../internal/warnOnce.js';
import { mergeDescribedBy } from './Field.context.js';
import { useFieldsetState } from './Fieldset.context.js';
import { useRevalidate } from './Form.context.js';
import { Slider as ServerSlider, type SliderRootProps } from './Slider.js';
import styles from './Slider.module.css';
import {
  moveThumb,
  nearestThumb,
  normalizeRange,
  rangePercents,
  readScale,
  valueFromPointer,
  type SliderRangeValue,
  type SliderThumb,
} from './sliderRange.js';

export type { SliderRangeValue, SliderRootProps };

/** One thumb. A missing `mode` means this too. */
export type SliderSingleProps = SliderRootProps & {
  /** One thumb. */
  mode?: 'single';
  /** A range reports through `onValueChange`. */
  onValueChange?: never;
  /** Names the start thumb of a range. */
  startLabel?: never;
  /** Names the end thumb of a range. */
  endLabel?: never;
};

/** Two thumbs on one track. Each thumb stops when it meets the other. */
export type SliderRangeProps = Omit<ComponentPropsWithRef<'div'>, 'defaultValue' | 'onChange' | 'children' | 'role'> & {
  /** Two thumbs. */
  mode: 'range';
  /** The lowest value. */
  min?: number | string;
  /** The highest value. */
  max?: number | string;
  /** How far one arrow key moves a thumb. */
  step?: number | string;
  /** Disables both thumbs. */
  disabled?: boolean;
  /** The two field names, start then end. Omit it and neither thumb submits. */
  name?: readonly [string, string];
  /** The start and end, with `onValueChange`. */
  value?: Readonly<SliderRangeValue>;
  /** The starting pair, when the slider keeps it. */
  defaultValue?: Readonly<SliderRangeValue>;
  /** Fires with the next pair after a gesture. A repaired range does not fire. */
  onValueChange?: (value: SliderRangeValue) => void;
  /** A range reports pairs through `onValueChange`. */
  onChange?: never;
  /** Names the start thumb. */
  startLabel: string;
  /** Names the end thumb. */
  endLabel: string;
};

/** `Slider.Root`: one thumb, or two when `mode` is `"range"`. */
export type SliderProps = SliderSingleProps | SliderRangeProps;

function ownInvalid(value: SliderRootProps['aria-invalid']): boolean | undefined {
  return value === undefined ? undefined : value !== false && value !== 'false';
}

function readInput(input: HTMLInputElement): number {
  return Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : Number(input.value);
}

function Single({
  mode: _mode,
  onValueChange: _onValueChange,
  startLabel: _startLabel,
  endLabel: _endLabel,
  disabled: disabledProp,
  'aria-invalid': ariaInvalid,
  'aria-describedby': describedBy,
  ...props
}: SliderSingleProps) {
  const { disabled, invalid, errorId } = useFieldsetState({ disabled: disabledProp, invalid: ownInvalid(ariaInvalid) });
  useRevalidate();
  return (
    <ServerSlider.Root
      {...props}
      disabled={disabled}
      aria-invalid={ariaInvalid ?? (invalid || undefined)}
      aria-describedby={mergeDescribedBy(describedBy, errorId)}
    />
  );
}

function Range({
  mode: _mode,
  min,
  max,
  step,
  name,
  value,
  defaultValue,
  onValueChange,
  onChange: _onChange,
  startLabel,
  endLabel,
  disabled: disabledProp,
  className,
  style,
  'aria-invalid': ariaInvalid,
  'aria-describedby': describedBy,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
  ...props
}: SliderRangeProps) {
  const scale = readScale({ min, max, step });
  const { disabled, invalid, errorId } = useFieldsetState({ disabled: disabledProp, invalid: ownInvalid(ariaInvalid) });
  useRevalidate();
  const [stored, setStored, latest] = useControlledState<SliderRangeValue>(
    value as SliderRangeValue | undefined,
    (defaultValue as SliderRangeValue | undefined) ?? [scale.min, scale.max],
    onValueChange,
  );
  const shown = normalizeRange(stored, scale);
  if (value != null && value[0] > value[1]) {
    warnOnce(
      'slider-range-crossed',
      'Slider.Root was given a range whose start is greater than its end. It is shown with the end moved to the start, and onValueChange waits for a gesture.',
    );
  }
  const described = mergeDescribedBy(describedBy, errorId);
  const invalidState = ariaInvalid ?? (invalid || undefined);
  const percents = rangePercents(shown, scale);
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ thumb: SliderThumb; pointerId: number } | null>(null);

  function commit(thumb: SliderThumb, raw: number) {
    const current = normalizeRange(latest(), scale);
    const next = moveThumb(current, thumb, raw, scale);
    if (next !== current) setStored(next);
  }

  function atPointer(event: PointerEvent<HTMLDivElement>): number {
    const rect = event.currentTarget.getBoundingClientRect();
    const direction = getComputedStyle(event.currentTarget).direction === 'rtl' ? 'rtl' : 'ltr';
    return valueFromPointer(event.clientX, rect, direction, scale);
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled || event.button !== 0) return;
    if (event.target instanceof HTMLInputElement) return;
    const raw = atPointer(event);
    const thumb = nearestThumb(normalizeRange(latest(), scale), raw);
    drag.current = { thumb, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
    const input = thumb === 'start' ? startRef.current : endRef.current;
    if (input) focusWithoutScroll(input);
    commit(thumb, raw);
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId || disabled) return;
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    commit(active.thumb, atPointer(event));
  }

  function pointerEnd(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const input = active.thumb === 'start' ? startRef.current : endRef.current;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (input) focusWithoutScroll(input);
  }

  function onThumb(thumb: SliderThumb) {
    return (event: ChangeEvent<HTMLInputElement>) => commit(thumb, readInput(event.currentTarget));
  }

  return (
    <div
      {...props}
      className={cx(styles.range, className)}
      role="group"
      style={{ ...style, '--_start': `${percents.start}%`, '--_end': `${percents.end}%` } as CSSProperties}
      onPointerDown={composeHandlers(onPointerDown, pointerDown)}
      onPointerMove={composeHandlers(onPointerMove, pointerMove)}
      onPointerUp={composeHandlers(onPointerUp, pointerEnd)}
      onPointerCancel={composeHandlers(onPointerCancel, pointerEnd)}
      onLostPointerCapture={composeHandlers(onLostPointerCapture, pointerEnd)}
    >
      <span className={styles.mask} aria-hidden="true" />
      <input
        ref={startRef}
        className={cx(styles.thumb, styles.start)}
        type="range"
        min={scale.min}
        max={shown[1]}
        step={scale.step}
        value={shown[0]}
        name={name?.[0]}
        disabled={disabled}
        aria-label={startLabel}
        aria-invalid={invalidState}
        aria-describedby={described}
        onChange={onThumb('start')}
      />
      <input
        ref={endRef}
        className={cx(styles.thumb, styles.end)}
        type="range"
        min={shown[0]}
        max={scale.max}
        step={scale.step}
        value={shown[1]}
        name={name?.[1]}
        disabled={disabled}
        aria-label={endLabel}
        aria-invalid={invalidState}
        aria-describedby={described}
        onChange={onThumb('end')}
      />
    </div>
  );
}

function Root(props: SliderSingleProps): ReactElement;
function Root(props: SliderRangeProps): ReactElement;
function Root(props: SliderProps): ReactElement {
  if (props.mode === 'range') return <Range {...props} />;
  return <Single {...props} />;
}

/**
 * A native range input, or with `mode="range"` two native range inputs whose thumbs share one track.
 * A thumb stops when it meets the other.
 */
export const Slider = { Root } as const;
