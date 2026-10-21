import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type Ref,
} from 'react';
import { useFieldContext, usePublishStepper, type StepperEntry } from './Field.context.js';
import { useCustomValidity } from './customValidity.js';
import { FieldValueInput } from './Field.ValueInput.js';
import { valueBounds } from './Field.shared.js';
import { labelOf } from './buttonName.js';
import { isImeKeyEvent } from './ime.js';
import {
  canStep,
  commitNumber,
  decimalsOf,
  formatNumber,
  isPartialNumber,
  parseNumber,
  shownDecimals,
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
  /** The grid a commit snaps to, counted from `min` or from 0, and what the arrow keys and step buttons move by. It wins over the digits the text shows, so give a step no finer than they are. Without it a commit keeps every digit the text shows, and a key moves by 1, or by 0.01 for a percent. */
  step?: number;
  /** What Page Up and Page Down move by. Defaults to ten steps. */
  largeStep?: number;
  /** The locale for the number's text, such as "de". The browser's own when not set, so pass it when the input renders on a server. */
  locale?: string;
  /** How the number is written, as `Intl.NumberFormat` takes it: style, such as percent or currency, and fraction digits, which a commit rounds to. Compact and scientific notation can't be read back, and significant digits and rounding options are not supported. Put a unit or a currency sign in a `Field.Affix` instead when you can. */
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

// What a text says: a number, none for an empty text, or nothing readable.
type Typed = { read: true; number: number | null } | { read: false };

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
  largeStep: largeStepProp,
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
  ...props
}: FieldNumberInputProps) {
  const field = useField();
  const ctx = useFieldContext();
  const strings = useStrings();
  const text = { locale, formatOptions };
  // A step that is no length is no step.
  const step = stepProp !== undefined && stepProp > 0 ? stepProp : undefined;
  const page = largeStepProp !== undefined && largeStepProp > 0 ? largeStepProp : undefined;
  const range = { min, max, step };
  // What a key or a button moves by: a percent is a fraction, so one shown percent is 0.01.
  const by = step ?? (formatOptions?.style === 'percent' ? 0.01 : 1);
  if (min !== undefined && max !== undefined && max < min) {
    warnOnce('number-input-range', 'Field.NumberInput has a max below its min, so every commit becomes the min.');
  }
  // TypeScript rejects these options; this is for a caller without it.
  const unsupported = ['maximumSignificantDigits', 'minimumSignificantDigits', 'roundingMode', 'roundingIncrement', 'roundingPriority'];
  if (formatOptions && unsupported.some((option) => (formatOptions as Record<string, unknown>)[option] !== undefined)) {
    warnOnce('number-input-rounding', 'Field.NumberInput does not support significant-digit or rounding formatOptions: the text rounds by them, but a commit does not. Use fraction digits.');
  }
  const digits = shownDecimals(text);
  if (digits !== undefined && [step, min, max].some((bound) => bound !== undefined && decimalsOf(bound) > digits)) {
    warnOnce('number-input-digits', 'Field.NumberInput has a step, min or max with more decimals than its format shows, so the text rounds what a commit keeps. Show more fraction digits with formatOptions.');
  }
  const current = value !== null && Number.isFinite(value) ? value : null;
  const [draft, setDraft] = useState<Draft | null>(null);
  // The draft is the person's until they commit, or the product sets another value.
  const typing = draft !== null && Object.is(draft.base, current);
  if (draft !== null && !typing) setDraft(null);
  const own = current === null ? '' : formatNumber(current, text);
  const shown = typing ? draft.text : own;
  const fixed = readOnly ?? !onValueChange;
  // A commit that read the text as no number leaves it, invalid, until it is a number or the product sets one.
  const unreadable = typing && draft.failed;

  function typed(): Typed {
    if (!typing) return { read: true, number: current };
    if (draft.text.trim() === '') return { read: true, number: null };
    const number = parseNumber(draft.text, text);
    return number === null ? { read: false } : { read: true, number };
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
    if (next.read) commit(next.number);
    else setDraft({ ...draft, failed: true });
  }

  // From the text, as a native input steps from its value; from text that is no number, nothing: it stays, and stays invalid.
  function stepBy(size: number) {
    if (fixed) return;
    const from = typed();
    if (!from.read || !canStep(from.number, size, range)) return;
    commit(stepNumber(from.number, size, range, text));
  }

  // A button is at a bound where a key would do nothing: at the bound it steps toward, or outside the range, stepping away.
  const atMax = !canStep(current, by, range);
  const atMin = !canStep(current, -by, range);
  // The step buttons are named from it, so several fields' are told apart.
  const [label, setLabel] = useState('');
  const stepRef = useRef((_direction: 1 | -1) => {});
  stepRef.current = (direction) => stepBy(direction * by);
  const stepper = useMemo<StepperEntry>(
    () => ({
      step: (direction) => stepRef.current(direction),
      inputId: ctx.inputId,
      label,
      disabled: field.disabled || fixed,
      atMin,
      atMax,
    }),
    [atMax, atMin, ctx.inputId, field.disabled, fixed, label],
  );
  usePublishStepper(ctx.store, stepper);

  const node = useRef<HTMLInputElement | null>(null);
  const refs = useComposedRefs(node, ref);
  // A typed character that could not become a number never reaches the input, so the caret stays where it was. Nothing else is filtered: a deletion, a paste or an IME's text lands, and is read or flagged on commit.
  const refuse = useRef((_event: InputEvent) => {});
  refuse.current = (event) => {
    const target = event.target as HTMLInputElement;
    const { selectionStart: from, selectionEnd: to } = target;
    if (fixed || event.isComposing || event.inputType !== 'insertText' || event.data == null || from === null || to === null) return;
    if (!isPartialNumber(target.value.slice(0, from) + event.data + target.value.slice(to), text)) event.preventDefault();
  };
  const clear = useRef(() => {});
  clear.current = () => setDraft(null);
  useLayoutEffect(() => {
    const input = node.current;
    if (!input) return;
    const listener = (event: Event) => refuse.current(event as InputEvent);
    // A reset puts back what the form had, which is not what was typed.
    const reset = () => clear.current();
    const form = input.form;
    input.addEventListener('beforeinput', listener);
    form?.addEventListener('reset', reset);
    return () => {
      input.removeEventListener('beforeinput', listener);
      form?.removeEventListener('reset', reset);
    };
  }, [props.form]);
  // Every commit, as the label can change; the same text bails out.
  const readLabel = useCallback(() => setLabel(labelOf(node.current)), []);
  useLayoutEffect(readLabel);

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
        const size = event.key.startsWith('Page') ? (page ?? by * 10) : by;
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
  // Only a number keypad where the minus key is not needed: a field that takes negatives needs the full one. The digit keypad has no separator either, so it is for a whole grid in a format that shows no fraction. The decimal keypad's separator is the device's, not `locale`'s.
  const whole = step !== undefined && Number.isInteger(step) && min !== undefined && Number.isInteger(min) && !digits;
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
        // Exactly what is on screen, typed or not.
        aria-valuetext={shown || undefined}
        value={shown}
        readOnly={fixed}
        className={cx(styles.input, className)}
        onChange={onChange}
        onKeyDown={composeHandlers(onKeyDownProp, onKeyDown)}
        onBlur={(event: FocusEvent<HTMLInputElement>) => {
          onBlurProp?.(event);
          commitDraft();
        }}
      />
      <FieldValueInput input={{ ...valueInput, ref: valueRef }} />
    </>
  );
}
