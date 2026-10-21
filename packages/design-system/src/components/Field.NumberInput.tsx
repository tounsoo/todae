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
import { useFieldContext, usePublishStepper, type StepperEntry } from './Field.context.js';
import { useCustomValidity } from './customValidity.js';
import { FieldValueInput } from './Field.ValueInput.js';
import { valueBounds } from './Field.shared.js';
import { isImeKeyEvent } from './ime.js';
import {
  commitNumber,
  formatNumber,
  isPartialNumber,
  parseNumber,
  stepNumber,
  type NumberFormatOptions,
} from './numberText.js';
import { composeHandlers, cx, useComposedRefs } from './props.js';
import styles from './Field.module.css';
import { warnOnce } from './warnOnce.js';
import { useField } from '../hooks/useField.js';
import { useStrings } from '../providers/StringsProvider.js';

export type FieldNumberInputProps = {
  /** The number, or null for none. Never NaN. */
  value: number | null;
  /** Fires on a person's commit, on blur, Enter, a step key or a step button, with a number within `min` and `max`, on `step` and rounded to the digits the text shows, or null for an empty text. Typing alone fires nothing. Without it the input is read-only. */
  onValueChange?: (value: number | null) => void;
  /** The lowest number. A commit below it becomes it, and a form with a lower value is invalid. */
  min?: number;
  /** The highest number. A commit above it becomes the highest number on the step that fits. */
  max?: number;
  /** The grid a commit snaps to, counted from `min` or from 0, and what the arrow keys and step buttons move by. Without it a commit keeps every digit the text shows, and a key moves by 1, or by 0.01 for a percent. */
  step?: number;
  /** What Page Up and Page Down move by. Defaults to ten steps. */
  largeStep?: number;
  /** The locale for the number's text, such as "de". The browser's own when not set, so pass it when the input renders on a server. */
  locale?: string;
  /** How the number is written, as `Intl.NumberFormat` takes it: style, such as percent or currency, and fraction digits, which a commit rounds to. Compact and scientific notation can't be read back, and significant digits are not supported. Put a unit or a currency sign in a `Field.Affix` instead when you can. */
  formatOptions?: NumberFormatOptions;
  /** A form with no number is invalid. */
  required?: boolean;
  placeholder?: string;
  ref?: Ref<HTMLInputElement>;
} & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  | 'value'
  | 'defaultValue'
  | 'type'
  | 'onChange'
  | 'min'
  | 'max'
  | 'step'
  | 'disabled'
  | 'required'
  | 'role'
  // A text input's own limits, which would contradict the number's.
  | 'pattern'
  | 'maxLength'
  | 'minLength'
  | 'list'
  | 'multiple'
>;

// The text the person is typing, and the value it started from: a value the product sets since ends the draft. `failed` once a commit read the text as no number.
type Draft = { text: string; base: number | null; failed: boolean };

/**
 * A text input for a number, in the locale's own format, that the person types
 * into freely. It parses on blur, Enter and each step, rewrites the text and
 * calls `onValueChange`. The number goes in a native input the browser
 * validates, so `required`, `min` and `max` block a submit and Form.Root shows
 * them in the field's format. Arrow Up and Down step, and Page Up and Page
 * Down step by `largeStep`. Field.Increment and Field.Decrement beside it are
 * step buttons.
 */
export function NumberInput({
  value,
  onValueChange,
  min,
  max,
  step: stepProp,
  largeStep,
  locale,
  formatOptions,
  required,
  readOnly,
  inputMode,
  name,
  className,
  ref,
  onKeyDown: onKeyDownProp,
  onBlur: onBlurProp,
  onCompositionStart: onCompositionStartProp,
  onCompositionEnd: onCompositionEndProp,
  ...props
}: FieldNumberInputProps) {
  const field = useField();
  const ctx = useFieldContext();
  const strings = useStrings();
  const text = { locale, formatOptions };
  // A step that is no length is no step.
  const step = stepProp !== undefined && stepProp > 0 ? stepProp : undefined;
  const range = { min, max, step };
  // What a key or a button moves by: a percent is a fraction, so one shown percent is 0.01.
  const by = step ?? (formatOptions?.style === 'percent' ? 0.01 : 1);
  if (min !== undefined && max !== undefined && max < min) {
    warnOnce('number-input-range', 'Field.NumberInput has a max below its min, so every commit becomes the min.');
  }
  if (formatOptions?.maximumSignificantDigits !== undefined || formatOptions?.minimumSignificantDigits !== undefined) {
    warnOnce('number-input-significant', 'Field.NumberInput does not support significant-digit formatOptions: the text rounds by them, but a commit keeps its digits. Use fraction digits.');
  }
  const current = value !== null && Number.isFinite(value) ? value : null;
  const [draft, setDraft] = useState<Draft | null>(null);
  const composing = useRef<Draft | null | false>(false);
  // The draft is the person's until they commit, or the product sets another value.
  const typing = draft !== null && Object.is(draft.base, current);
  if (draft !== null && !typing) setDraft(null);
  const own = current === null ? '' : formatNumber(current, text);
  const shown = typing ? draft.text : own;
  const fixed = readOnly ?? !onValueChange;
  // A commit that read the text as no number leaves it, invalid, until it is a number or the product sets one.
  const unreadable = typing && draft.failed;

  // What the text says: a number, null for an empty text, or undefined for text that means none.
  function typed(): number | null | undefined {
    if (!typing) return current;
    return draft.text.trim() === '' ? null : (parseNumber(draft.text, text) ?? undefined);
  }

  function commit(next: number | null) {
    const result = next === null ? null : commitNumber(next, range, text);
    setDraft(null);
    if (Object.is(result, current)) return;
    field.notifyValueChange();
    onValueChange?.(result);
  }

  function commitDraft() {
    if (!typing || fixed) return;
    const next = typed();
    if (next === undefined) setDraft({ ...draft, failed: true });
    else commit(next);
  }

  function stepBy(size: number) {
    if (fixed) return;
    const from = typed();
    commit(stepNumber(from === undefined ? current : from, size, range, text));
  }

  // A button is at a bound when a step would not change the value, as a key would find it.
  const atMax = current !== null && stepNumber(current, by, range, text) === current;
  const atMin = current !== null && stepNumber(current, -by, range, text) === current;
  const stepRef = useRef((_direction: 1 | -1) => {});
  stepRef.current = (direction) => stepBy(direction * by);
  const stepper = useMemo<StepperEntry>(
    () => ({
      step: (direction) => stepRef.current(direction),
      inputId: ctx.inputId,
      disabled: field.disabled || fixed,
      atMin,
      atMax,
    }),
    [atMax, atMin, ctx.inputId, field.disabled, fixed],
  );
  usePublishStepper(ctx.store, stepper);

  const node = useRef<HTMLInputElement | null>(null);
  const refs = useComposedRefs(node, ref);
  // A keystroke or a paste that could not become a number never reaches the input, so the caret stays where it was. onChange checks the same, for what this can't see.
  const refuse = useRef((_event: InputEvent) => {});
  refuse.current = (event) => {
    const target = event.target as HTMLInputElement;
    const { selectionStart: from, selectionEnd: to } = target;
    if (fixed || event.isComposing || event.data == null || from === null || to === null) return;
    if (event.inputType !== 'insertText' && event.inputType !== 'insertFromPaste') return;
    if (!isPartialNumber(target.value.slice(0, from) + event.data + target.value.slice(to), text)) event.preventDefault();
  };
  useLayoutEffect(() => {
    const input = node.current;
    if (!input) return;
    const listener = (event: Event) => refuse.current(event as InputEvent);
    input.addEventListener('beforeinput', listener);
    return () => input.removeEventListener('beforeinput', listener);
  }, []);

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
        const size = event.key.startsWith('Page') ? (largeStep ?? by * 10) : by;
        stepBy(event.key.endsWith('Up') ? size : -size);
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
    if (composing.current === false && !isPartialNumber(next, text)) return;
    // The text stays invalid until it reads as a number, or as none.
    const failed = unreadable && next.trim() !== '' && parseNumber(next, text) === null;
    setDraft({ text: next, base: current, failed });
  }

  // The text input sends nothing: the value input does, as the number the form reads.
  const control = field.getControlProps(
    { ...props, ref: refs, 'aria-invalid': unreadable ? true : props['aria-invalid'] },
    { sendsName: false },
  );
  const valueInput = field.getValueInputProps(
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
  );
  const valueNode = useRef<HTMLInputElement | null>(null);
  const valueRef = useComposedRefs(valueNode, valueInput.ref);
  // The value input is invalid too, so a submit, Enter's implicit one included, is blocked and Form.Root words it.
  useCustomValidity(valueNode, () => valueNode.current, unreadable ? strings.badInput : undefined);
  // Only a number keypad where the minus key is not needed: a field that takes negatives needs the full one.
  const whole = step !== undefined && Number.isInteger(step) && min !== undefined && Number.isInteger(min);
  const keypad = min !== undefined && min >= 0 ? (whole ? 'numeric' : 'decimal') : 'text';
  return (
    <>
      <input
        {...control}
        type="text"
        role="spinbutton"
        data-todae-number-input=""
        inputMode={inputMode ?? keypad}
        spellCheck={false}
        aria-required={required || undefined}
        aria-valuenow={current ?? undefined}
        aria-valuemin={min}
        aria-valuemax={max}
        // Not while typing: it would say a number that is not on screen.
        aria-valuetext={current === null || typing ? undefined : own}
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
      <FieldValueInput input={{ ...valueInput, ref: valueRef }} />
    </>
  );
}
