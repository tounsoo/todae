import {
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
import { watchLabel } from './buttonName.js';
import { isImeKeyEvent } from './ime.js';
import {
  boundsOf,
  canStep,
  commitNumber,
  decimalsOf,
  formatNumber,
  isPartialNumber,
  keypadFor,
  onGrid,
  parseNumber,
  shownDecimals,
  stepNumber,
  UNSUPPORTED_FORMAT_OPTIONS,
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
  /** Fires on a person's commit, on blur, Enter, a step key, a step button or a submit of the form, with a number within `min` and `max` and, where there is a `step`, on it, which wins over the digits the text shows; without one, rounded to them. Null for an empty text. Typing alone fires nothing. Without it the input is read-only. */
  onValueChange?: (value: number | null) => void;
  /** The lowest number. A commit below it becomes it, and a form with a lower value is invalid. */
  min?: number;
  /** The highest number. A commit above it becomes the highest number on the step that fits. */
  max?: number;
  /** The grid a commit snaps to, counted from `min`, or from 0 without one (a `value` you set that is off it is shown as given, and Todae warns once in development), and what the arrow keys and step buttons move by. It wins over the digits the text shows, so give a step no finer than they are. Without it a commit keeps every digit the text shows, and a key moves by 1, or by 0.01 for a percent. */
  step?: number;
  /** What Page Up and Page Down move by, rounded to whole steps and at least one. Todae warns in development when it is not a multiple of `step`. Defaults to ten steps. */
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

// The text the person is typing, and the value it started from: a value the product sets since ends the draft. `failed` is set when a commit tried to read it and could not.
type Draft = { text: string; base: number | null; failed?: boolean };

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
  if (formatOptions && UNSUPPORTED_FORMAT_OPTIONS.some((option) => (formatOptions as Record<string, unknown>)[option] !== undefined)) {
    warnOnce('number-input-format', 'Field.NumberInput does not support notation, compactDisplay, significant-digit or rounding formatOptions: a text in compact or scientific notation cannot be read back, and the text rounds by the others where a commit does not. Use fraction digits.');
  }
  // Page Up and Page Down move by whole steps.
  if (step !== undefined && page !== undefined && Number((page / step).toPrecision(15)) % 1 !== 0) {
    warnOnce('number-input-large-step', 'Field.NumberInput has a largeStep that is not a multiple of its step, so Page Up and Page Down round it to whole steps.');
  }
  const digits = shownDecimals(text);
  if (digits !== undefined && [step, min, max].some((bound) => bound !== undefined && decimalsOf(bound) > digits)) {
    warnOnce('number-input-digits', 'Field.NumberInput has a step, min or max with more decimals than its format shows, so the text rounds what a commit keeps. Show more fraction digits with formatOptions.');
  }
  const current = value !== null && Number.isFinite(value) ? value : null;
  // Todae's own commits and steps sit on the grid, counted from `min`, or from 0. The browser's own check counts from the value attribute without a `min`, so it can't see this.
  if (current !== null && !onGrid(current, range)) {
    warnOnce('number-input-grid', `Field.NumberInput has a value off its step grid, which counts from ${min === undefined ? '0, as there is no min' : 'its min'}. It is shown as given, and a commit or step moves it onto the grid.`);
  }
  const [draft, setDraft] = useState<Draft | null>(null);
  // The draft is the person's until they commit, or the product sets another value.
  const fixed = readOnly || !onValueChange;
  // A field that can't be edited has no draft: what was typed can't be committed, and would block its form.
  const typing = draft !== null && !fixed && !field.disabled && Object.is(draft.base, current);
  if (draft !== null && !typing) setDraft(null);
  // The draft a commit consumed, set at once, since `setDraft(null)` shows only in the next render and anything a commit calls back into, such as a product's auto-submit, still reads this render's draft. A consumed draft is no draft: it commits at most once.
  const consumed = useRef<Draft | null>(null);
  // From a commit that cleared a draft until the render that shows it: a submit in between waits for it.
  const settling = useRef(false);
  // The submit that waits for a commit, sent again after the render that shows it.
  const held = useRef<{ form: HTMLFormElement; submitter: HTMLElement | null } | null>(null);
  // The draft a commit has not consumed, read when called, since a callback from a commit runs before the next render.
  const live = () => (typing && draft !== consumed.current ? draft : null);
  const own = current === null ? '' : formatNumber(current, text);
  const shown = typing ? draft.text : own;
  // A text that is no number blocks a submit as it is typed, whether or not a commit has read it, and stays so until it is one or the product sets a value. The Form decides when that shows.
  const unreadable = typing && draft.text.trim() !== '' && parseNumber(draft.text, text) === null;
  // It is announced invalid only when more typing could not make it one, or a commit has tried to read it: a lone minus, or a group's separator in de, is on the way to a number.
  const flagged = unreadable && (draft.failed === true || !isPartialNumber(draft.text, text));
  const valueNode = useRef<HTMLInputElement | null>(null);

  function typed(): Typed {
    const open = live();
    if (!open) return { read: true, number: current };
    if (open.text.trim() === '') return { read: true, number: null };
    const number = parseNumber(open.text, text);
    return number === null ? { read: false } : { read: true, number };
  }
  // Where a step starts, from what the text says, as a native input steps from its value. The keys, the buttons and their disabled state all judge this one.
  const from = typed();
  const bounds = boundsOf(range);

  // A commit that could not read the text flags it.
  function fail() {
    const open = live();
    if (open && !open.failed) setDraft({ ...open, failed: true });
  }

  // Returns what it committed, the number the product is told.
  function commit(next: number | null): number | null {
    const result = next === null ? null : commitNumber(next, range, text);
    const open = live();
    if (open) {
      consumed.current = open;
      settling.current = true;
    }
    setDraft(null);
    if (!Object.is(result, current)) {
      field.notifyValueChange();
      onValueChange?.(result);
    }
    return result;
  }

  function commitDraft() {
    if (!live() || fixed) return;
    const next = typed();
    // Text that is no number stays, invalid.
    if (next.read) commit(next.number);
    else fail();
  }

  // A submit of the input's form waits for the commit instead of forcing it. It is cancelled and held, the draft commits as blur and Enter do, and the layout effect after the render that clears the draft sends it again, so the form reads what the product rendered, whatever phase the submit started in: a number the product refuses is never sent, and the product is never told a number other than the one sent. A submit that arrives while a commit waits for its render, such as a product's auto-submit in `onValueChange`, waits too. Text that is no number is flagged, and the form's own check blocks the submit on the value input's custom validity. A form that validates natively checks before it fires `submit`, so a submit with no blur (`requestSubmit()` with focus in the text) is blocked on the last committed number when that is invalid: commit first, by blur or Enter.
  function submitForm(event: SubmitEvent) {
    const form = event.target as HTMLFormElement;
    if (live() && !fixed) {
      const next = typed();
      if (!next.read) return fail();
      event.preventDefault();
      event.stopImmediatePropagation();
      held.current = { form, submitter: event.submitter };
      commit(next.number);
    } else if (settling.current) {
      event.preventDefault();
      event.stopImmediatePropagation();
      held.current = { form, submitter: event.submitter };
    }
  }

  // From text that is no number, nothing: it stays, and stays invalid.
  function stepBy(size: number) {
    if (fixed) return;
    if (!from.read) return fail();
    if (!canStep(from.number, size, range, text)) return;
    commit(stepNumber(from.number, size, range, text));
  }

  // A button is disabled where a key would do nothing: from text that is no number, at the bound it steps toward, or outside the range, stepping away.
  const atMax = flagged || (from.read && !canStep(from.number, by, range, text));
  const atMin = flagged || (from.read && !canStep(from.number, -by, range, text));
  // The step buttons are named from it, so several fields' are told apart.
  const [label, setLabel] = useState('');
  // The native listeners and the stepper entry outlive a render, so they call the latest of these.
  const latest = useRef({ step: (_direction: 1 | -1) => {}, refuse: (_event: InputEvent) => {}, submit: (_event: SubmitEvent) => {} });
  const stepper = useMemo<StepperEntry>(
    () => ({
      step: (direction) => latest.current.step(direction),
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
  function refuse(event: InputEvent) {
    const target = event.target as HTMLInputElement;
    const { selectionStart: from, selectionEnd: to } = target;
    if (fixed || event.isComposing || event.inputType !== 'insertText' || event.data == null || from === null || to === null) return;
    if (!isPartialNumber(target.value.slice(0, from) + event.data + target.value.slice(to), text)) event.preventDefault();
  }
  useLayoutEffect(() => {
    latest.current = { step: (direction) => stepBy(direction * by), refuse, submit: submitForm };
    // The render that shows a commit, not one that began before it (an effect of this same pass, when a commit started inside another's effect): a submit that waited for it goes now, with what the product rendered.
    if (draft !== null && draft === consumed.current) return;
    settling.current = false;
    const waiting = held.current;
    held.current = null;
    if (!waiting?.form.isConnected) return;
    const { form, submitter } = waiting;
    form.requestSubmit(submitter?.isConnected && (submitter as HTMLButtonElement).form === form ? submitter : undefined);
  });
  useLayoutEffect(() => {
    const input = node.current;
    if (!input) return;
    const listener = (event: Event) => latest.current.refuse(event as InputEvent);
    input.addEventListener('beforeinput', listener);
    // One listener on the document, in the capture phase, for the form the input has when the event comes, so a `form` attribute that names a form mounted later works. It runs before React's handlers on the root, such as Form.Root's `onSubmit`, and before a handler on the form.
    const doc = input.ownerDocument;
    const onSubmit = (event: Event) => {
      if (event.target === input.form) latest.current.submit(event as SubmitEvent);
    };
    // A reset puts back what the form had, which is not what was typed, unless a handler cancels it. Those run after this listener, and after a microtask too, so it waits a task.
    const onReset = (event: Event) => {
      if (event.target !== input.form) return;
      window.setTimeout(() => {
        if (!event.defaultPrevented) setDraft(null);
      });
    };
    doc.addEventListener('submit', onSubmit, true);
    doc.addEventListener('reset', onReset, true);
    return () => {
      input.removeEventListener('beforeinput', listener);
      doc.removeEventListener('submit', onSubmit, true);
      doc.removeEventListener('reset', onReset, true);
    };
  }, []);
  // The label's own text can change, such as a translation that loads later, and a label can mount, be replaced or go from anywhere in the page, so the page's one shared observer follows them.
  useLayoutEffect(() => watchLabel(node.current, setLabel).stop, []);

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
    setDraft({ text: event.target.value, base: current });
  }

  // The text input sends nothing: the value input does, as the number the form reads.
  const control = field.getControlProps(
    { ...props, ref: refs, 'aria-invalid': flagged ? true : props['aria-invalid'] },
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
  const valueRef = useComposedRefs(valueNode, valueInput.ref);
  // The value input is invalid too, so a submit, Enter's implicit one included, is blocked and Form.Root words it.
  useCustomValidity(valueNode, () => valueNode.current, unreadable ? strings.badInput : undefined);
  return (
    <>
      <input
        {...control}
        type="text"
        role="spinbutton"
        data-todae-number-input=""
        inputMode={inputMode ?? keypadFor({ min, step, shown: digits })}
        spellCheck={false}
        aria-required={required || undefined}
        // The number the text says while it reads, and the range a commit can give, where `max` is not on the step's grid.
        aria-valuenow={(from.read ? from.number : current) ?? undefined}
        aria-valuemin={bounds.low}
        aria-valuemax={bounds.high}
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
