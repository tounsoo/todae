import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CompositionEvent,
  type FocusEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type Ref,
} from 'react';
import { useFieldContext, type StepperEntry } from './Field.context.js';
import { FieldValueInput } from './Field.ValueInput.js';
import { valueBounds } from './Field.shared.js';
import { isImeKeyEvent } from './ime.js';
import { commitNumber, formatNumber, isPartialNumber, parseNumber, stepNumber } from './numberText.js';
import { composeHandlers, cx } from './props.js';
import styles from './Field.module.css';
import { useField } from '../hooks/useField.js';

export type FieldNumberInputProps = {
  /** The number, or null for none. Never NaN. */
  value: number | null;
  /** Fires on a person's commit, on blur, Enter, a step key or a step button, with a number within `min` and `max` and on `step`, or null for an empty text. Typing alone fires nothing. Without it the input is read-only. */
  onValueChange?: (value: number | null) => void;
  /** The lowest number. A commit below it becomes it, and a form with a lower value is invalid. */
  min?: number;
  /** The highest number. A commit above it becomes the highest number on the step that fits. */
  max?: number;
  /** The grid a commit snaps to, counted from `min` or from 0, and what the arrow keys and step buttons move by. Without it a commit keeps every digit and a key moves by 1. */
  step?: number;
  /** What Page Up and Page Down move by. Defaults to ten steps. */
  largeStep?: number;
  /** The locale for the number's text, such as "de". The browser's own when not set, so pass it when the input renders on a server. */
  locale?: string;
  /** How the number is written, as `Intl.NumberFormat` takes it: style, such as percent or currency, and fraction digits. Put a unit or a currency sign in a `Field.Affix` instead when you can. */
  formatOptions?: Intl.NumberFormatOptions;
  /** A form with no number is invalid. */
  required?: boolean;
  placeholder?: string;
  ref?: Ref<HTMLInputElement>;
} & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'defaultValue' | 'type' | 'onChange' | 'min' | 'max' | 'step' | 'disabled' | 'required' | 'role'
>;

// The text the person is typing, and the value it started from: a value the product sets since ends the draft.
type Draft = { text: string; base: number | null };

/**
 * A text input for a number, in the locale's own format, that the person types
 * into freely. It parses on blur, Enter and each step, rewrites the text and
 * calls `onValueChange`. The number goes in a native input the browser
 * validates, so `required`, `min` and `max` block a submit and Form.Root shows
 * them in the field's format. Arrow Up and Down step, Page Up and Page Down
 * step by `largeStep`, and Home and End go to `min` and `max` when set.
 * Field.Increment and Field.Decrement beside it are step buttons.
 */
export function NumberInput({
  value,
  onValueChange,
  min,
  max,
  step,
  largeStep,
  locale,
  formatOptions,
  required,
  readOnly,
  inputMode,
  name,
  className,
  onKeyDown: onKeyDownProp,
  onBlur: onBlurProp,
  onCompositionStart: onCompositionStartProp,
  onCompositionEnd: onCompositionEndProp,
  ...props
}: FieldNumberInputProps) {
  const field = useField();
  const ctx = useFieldContext();
  const text = { locale, formatOptions };
  const range = { min, max, step };
  const current = value !== null && Number.isFinite(value) ? value : null;
  const [draft, setDraft] = useState<Draft | null>(null);
  const composing = useRef<Draft | null | false>(false);
  // The draft is the person's until they commit, or the product sets another value.
  const typing = draft !== null && Object.is(draft.base, current);
  if (draft !== null && !typing) setDraft(null);
  const own = current === null ? '' : formatNumber(current, text);
  const shown = typing ? draft.text : own;
  const fixed = readOnly ?? !onValueChange;

  // What the text says: a number, null for an empty text, or undefined for text that means none.
  function typed(): number | null | undefined {
    if (!typing) return current;
    return draft.text.trim() === '' ? null : (parseNumber(draft.text, text) ?? undefined);
  }

  function commit(next: number | null) {
    const result = next === null ? null : commitNumber(next, range);
    setDraft(null);
    if (Object.is(result, current)) return;
    field.notifyValueChange();
    onValueChange?.(result);
  }

  // A text that means no number goes back to the value.
  function commitDraft() {
    if (!typing || fixed) return;
    const next = typed();
    commit(next === undefined ? current : next);
  }

  function stepBy(by: number) {
    if (fixed) return;
    const from = typed();
    commit(stepNumber(from === undefined ? current : from, by, range));
  }

  const stepRef = useRef(stepBy);
  stepRef.current = stepBy;
  const stepper = useMemo<StepperEntry>(
    () => ({
      step: (direction) => stepRef.current(direction * (step ?? 1)),
      inputId: ctx.inputId,
      disabled: field.disabled || fixed,
      atMin: current !== null && min !== undefined && current <= min,
      atMax: current !== null && max !== undefined && current >= max,
    }),
    [ctx.inputId, current, field.disabled, fixed, max, min, step],
  );
  const { store } = ctx;
  useLayoutEffect(() => {
    store.stepper = stepper;
    for (const listener of store.steppers) listener();
  }, [store, stepper]);
  useLayoutEffect(
    () => () => {
      store.stepper = null;
      for (const listener of store.steppers) listener();
    },
    [store],
  );

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (isImeKeyEvent(event) || fixed) return;
    const plain = !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowDown':
      case 'PageUp':
      case 'PageDown': {
        if (!plain) return;
        event.preventDefault();
        const size = event.key.startsWith('Page') ? (largeStep ?? (step ?? 1) * 10) : (step ?? 1);
        stepBy(event.key.endsWith('Up') ? size : -size);
        return;
      }
      case 'Home':
      case 'End': {
        const bound = event.key === 'Home' ? min : max;
        if (!plain || bound === undefined) return;
        event.preventDefault();
        commit(bound);
        return;
      }
      // The browser then submits the form, whose value input already holds the commit.
      case 'Enter':
        commitDraft();
    }
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    // A composition shows what the IME has so far; its end checks the whole text.
    if (composing.current !== false || isPartialNumber(next, text)) setDraft({ text: next, base: current });
  }

  const { name: _wired, ...wired } = field.getControlProps(props);
  // The text input sends nothing: the value input does, as the number the form reads.
  const control = { ...wired, 'data-todae-field-control': '' } as typeof wired;
  const whole = step !== undefined && Number.isInteger(step) && (min === undefined || Number.isInteger(min));
  return (
    <>
      <input
        {...control}
        type="text"
        role="spinbutton"
        inputMode={inputMode ?? (whole ? 'numeric' : 'decimal')}
        spellCheck={false}
        aria-required={required || undefined}
        aria-valuenow={current ?? undefined}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={current === null ? undefined : own}
        value={shown}
        readOnly={fixed}
        className={cx(styles.input, className)}
        onChange={onChange}
        onKeyDown={composeHandlers(onKeyDownProp, onKeyDown)}
        onCompositionStart={(event: CompositionEvent<HTMLInputElement>) => {
          composing.current = typing ? draft : null;
          onCompositionStartProp?.(event);
        }}
        onCompositionEnd={(event: CompositionEvent<HTMLInputElement>) => {
          const before = composing.current;
          composing.current = false;
          onCompositionEndProp?.(event);
          if (!isPartialNumber(event.currentTarget.value, text)) setDraft(before || null);
        }}
        onBlur={(event: FocusEvent<HTMLInputElement>) => {
          onBlurProp?.(event);
          commitDraft();
        }}
      />
      <FieldValueInput
        input={field.getValueInputProps(
          {
            type: 'number',
            name,
            value: current === null ? '' : String(current),
            required,
            // Without a step any number is valid, as a native `step="any"`: the default step of 1 would flag 0.5.
            step: step === undefined ? 'any' : String(step),
            ...valueBounds(min, max, String, (number) => formatNumber(number, text)),
          },
          control,
        )}
      />
    </>
  );
}
