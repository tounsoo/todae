import { useContext, useLayoutEffect, useRef, useState, type ChangeEvent, type ComponentPropsWithRef, type CSSProperties, type PointerEvent, type ReactElement } from 'react';
import { useControlledState } from '../hooks/useControlledState.js';
import { cx } from '../internal/cx.js';
import { useFormReset } from '../internal/formReset.js';
import { composeHandlers, useComposedRefs } from '../internal/props.js';
import { focusWithoutScroll } from '../internal/revealRing.js';
import { warnOnce } from '../internal/warnOnce.js';
import { mergeDescribedBy } from './Field.context.js';
import { useFieldsetState } from './Fieldset.context.js';
import { FormContext, useRevalidate, ValidationScopeContext } from './Form.context.js';
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
export type SliderRangeProps = Omit<
  ComponentPropsWithRef<'div'>,
  'defaultValue' | 'onChange' | 'children' | 'role' | 'aria-valuetext'
> & {
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
  /** What a screen reader says for the start thumb instead of the number. */
  startValueText?: string;
  /** What a screen reader says for the end thumb instead of the number. */
  endValueText?: string;
  /** A range uses `startValueText` and `endValueText`. */
  'aria-valuetext'?: never;
  /** The id of the form these thumbs submit with, when the range sits outside that form. */
  form?: string;
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

function readThumbSize(input: HTMLInputElement): string | null {
  for (const pseudo of ['::-webkit-slider-thumb', '::-moz-range-thumb']) {
    let measured: CSSStyleDeclaration;
    try {
      measured = getComputedStyle(input, pseudo);
    } catch {
      return null;
    }
    const height = Number.parseFloat(measured.height);
    const width = Number.parseFloat(measured.width);
    const box = input.clientWidth;
    if (width > 0 && width < box - 0.5) return `${width}px`;
    if (height > 0) return `${height}px`;
  }
  return null;
}

function Range({
  ref,
  mode: _mode,
  min,
  max,
  step,
  name,
  form: formId,
  value,
  defaultValue,
  onValueChange,
  onChange: _onChange,
  startLabel,
  endLabel,
  startValueText,
  endValueText,
  disabled: disabledProp,
  className,
  style,
  'aria-invalid': ariaInvalid,
  'aria-describedby': describedBy,
  'aria-valuetext': _valueText,
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
  const supplied = value ?? defaultValue;
  if (supplied != null && supplied[0] > supplied[1]) {
    warnOnce(
      'slider-range-crossed',
      'Slider.Root was given a range whose start is greater than its end. It is shown with the end moved to the start, and onValueChange waits for a gesture.',
    );
  }
  const groupRef = useRef<HTMLDivElement>(null);
  const refs = useComposedRefs(groupRef, ref);
  const initial = useRef<SliderRangeValue | null>(null);
  if (initial.current == null) {
    initial.current = normalizeRange(
      (value as SliderRangeValue | undefined) ?? (defaultValue as SliderRangeValue | undefined) ?? [scale.min, scale.max],
      scale,
    );
  }
  const origin = initial.current;
  useFormReset(
    groupRef,
    (atReset) => {
      if (!Object.is(latest(), atReset)) return;
      setStored(origin);
    },
    () => latest(),
  );
  const form = useContext(FormContext);
  const scope = useContext(ValidationScopeContext);
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ thumb: SliderThumb; pointerId: number } | null>(null);
  const [thumb, setThumb] = useState('1rem');
  useLayoutEffect(() => {
    const input = startRef.current;
    if (!input) return;
    const next = readThumbSize(input);
    if (next) setThumb((current) => (current === next ? current : next));
  }, []);
  const described = mergeDescribedBy(describedBy, errorId);
  const invalidState = ariaInvalid ?? (invalid || undefined);
  const percents = rangePercents(shown, scale);

  function commit(thumb: SliderThumb, raw: number, fromPointer = false) {
    const current = normalizeRange(latest(), scale);
    const next = moveThumb(current, thumb, raw, scale);
    if (next === current) return;
    setStored(next);
    if (!fromPointer) return;
    form?.edited(name ? [name[0], name[1]] : []);
    scope?.touch();
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
    if (typeof event.currentTarget.setPointerCapture === 'function') event.currentTarget.setPointerCapture(event.pointerId);
    const input = thumb === 'start' ? startRef.current : endRef.current;
    if (input) focusWithoutScroll(input);
    commit(thumb, raw, true);
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId || disabled) return;
    if (typeof event.currentTarget.hasPointerCapture !== 'function' || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    commit(active.thumb, atPointer(event), true);
  }

  function pointerEnd(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const input = active.thumb === 'start' ? startRef.current : endRef.current;
    drag.current = null;
    if (typeof event.currentTarget.releasePointerCapture === 'function' && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (input) focusWithoutScroll(input);
  }

  function onThumb(thumb: SliderThumb) {
    return (event: ChangeEvent<HTMLInputElement>) => commit(thumb, readInput(event.currentTarget));
  }

  return (
    <div
      {...props}
      ref={refs}
      className={cx(styles.range, className)}
      role="group"
      style={{ ...style, '--_start': percents.start, '--_end': percents.end, '--_thumb': thumb } as CSSProperties}
      onPointerDown={composeHandlers(onPointerDown, pointerDown)}
      onPointerMove={composeHandlers(onPointerMove, pointerMove)}
      onPointerUp={composeHandlers(onPointerUp, pointerEnd)}
      onPointerCancel={composeHandlers(onPointerCancel, pointerEnd)}
      onLostPointerCapture={composeHandlers(onLostPointerCapture, pointerEnd)}
    >
      <input
        ref={startRef}
        className={cx(styles.thumb, styles.start)}
        type="range"
        min={scale.min}
        max={shown[1]}
        step={scale.step}
        value={shown[0]}
        name={name?.[0]}
        form={formId}
        disabled={disabled}
        aria-label={startLabel}
        aria-valuetext={startValueText}
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
        form={formId}
        disabled={disabled}
        aria-label={endLabel}
        aria-valuetext={endValueText}
        aria-invalid={invalidState}
        aria-describedby={described}
        onChange={onThumb('end')}
      />
    </div>
  );
}

function Root(props: SliderProps): ReactElement {
  if (props.mode === 'range') return <Range {...props} />;
  return <Single {...props} />;
}

/**
 * A native range input, or with `mode="range"` two native range inputs whose thumbs share one track.
 * A thumb stops when it meets the other.
 */
export const Slider = { Root } as const;
