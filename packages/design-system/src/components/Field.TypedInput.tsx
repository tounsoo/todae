import {
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type Ref,
} from 'react';
import { useFieldContext } from './Field.context.js';
import { usePublishPicks, type FieldPicks } from './fieldRegistry.js';
import { useCustomValidity } from './customValidity.js';
import { FieldValueInput } from './Field.ValueInput.js';
import { useFormSubmitHold } from './useFormSubmitHold.js';
import { useFormReset } from '../internal/formReset.js';
import { isImeKeyEvent } from '../internal/ime.js';
import { composeHandlers, cx, useComposedRefs } from '../internal/props.js';
import styles from './Field.module.css';
import { useField } from './useField.js';
import { useStrings, type Strings } from '../providers/StringsProvider.js';
import type { ValueInputOptions } from './valueInput.js';

/** The native input attributes a typed input takes: none that would contradict its value or its own limits. */
export type TypedInputAttributes = Omit<
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
  | 'pattern'
  | 'maxLength'
  | 'minLength'
  | 'list'
  | 'multiple'
>;

/** The props every typed input shares, around its own value type. */
export type TypedInputProps<Value> = {
  /** The value, or null for none. */
  value: Value | null;
  /** Fires on a person's commit, on blur, Enter or a submit of the form, with the value the text says, or null for an empty text. Typing alone fires nothing, and text that says no value stays, invalid. Without it the input is read-only. */
  onValueChange?: (value: Value | null) => void;
  /** A form with no value is invalid. */
  required?: boolean;
  /** The locale the text is read and written in, such as "ko". The browser's own when not set, so pass it when the input renders on a server. */
  locale?: string;
  placeholder?: string;
  ref?: Ref<HTMLInputElement>;
} & TypedInputAttributes;

/** How one typed input reads, writes and sends its value. */
export type TypedFormat<Value> = {
  /** What a Field.Picker beside it opens: its default name and glyph. */
  picks: FieldPicks;
  /** The value in the text, or null when the text is not one. Never called with an empty text. */
  parse: (text: string) => Value | null;
  /** The value as the text shows it. */
  format: (value: Value) => string;
  equals: (a: Value, b: Value) => boolean;
  /** The value input's type, value for the current value, and bounds. */
  valueInput: (value: Value | null) => Omit<ValueInputOptions, 'name' | 'required'>;
  /** The message for a value the input's bounds don't allow, where its value input can't check them, as for a range in a text input; undefined for a value in bounds. */
  outOfBounds?: (value: Value, strings: Strings) => string | undefined;
};

// The text the person is typing, and the value it started from: a value the product sets since ends the draft. `failed` is set when a commit tried to read it and could not.
type Draft<Value> = { text: string; base: Value | null; failed?: boolean };

const same = <Value,>(a: Value | null, b: Value | null, equals: (a: Value, b: Value) => boolean) =>
  a === null || b === null ? a === b : equals(a, b);

/**
 * A text input the person types a value into freely, in the locale's own
 * words. It reads the text on blur, Enter and a submit of its form, rewrites
 * it and calls `onValueChange`; text that says no value stays, and blocks a
 * submit. The value goes in a native input the browser validates, so
 * `required`, `min` and `max` block a submit and Form.Root shows them.
 * Field.DateInput, Field.TimeInput, Field.DateTimeInput and
 * Field.DateRangeInput are this input with their own format.
 */
export function TypedInput<Value>({
  format,
  value,
  onValueChange,
  required,
  readOnly,
  name,
  className,
  ref,
  onKeyDown: onKeyDownProp,
  onBlur: onBlurProp,
  locale: _locale,
  ...props
}: TypedInputProps<Value> & { format: TypedFormat<Value> }) {
  const field = useField();
  const { registry } = useFieldContext();
  const strings = useStrings();
  usePublishPicks(registry, format.picks);
  const [draft, setDraft] = useState<Draft<Value> | null>(null);
  const fixed = readOnly || !onValueChange;
  // A field that can't be edited has no draft: what was typed can't be committed, and would block its form.
  const typing = draft !== null && !fixed && !field.disabled && same(draft.base, value, format.equals);
  if (draft !== null && !typing) setDraft(null);
  // The draft a commit has not answered, read when called: a commit's callback runs before the render that clears `draft`.
  const live = () => (typing && !waiting() ? draft : null);
  const shown = typing ? draft.text : value === null ? '' : format.format(value);
  // What the draft says, read once for the render: undefined for no draft, null for no value (an empty text), or false for text that says none.
  const drafted: Value | null | false | undefined = typing
    ? draft.text.trim() === ''
      ? null
      : (format.parse(draft.text) ?? false)
    : undefined;
  const unreadable = drafted === false;
  // Announced invalid only once a commit has tried to read it: a date is not one until its last digit.
  const flagged = unreadable && typing && draft.failed === true;
  const node = useRef<HTMLInputElement | null>(null);
  const valueNode = useRef<HTMLInputElement | null>(null);
  const { committed, waiting, mark } = useFormSubmitHold(node, () => {
    const outcome = draftOutcome();
    if (outcome.kind === 'none') return null;
    return outcome.kind === 'commit' ? { commit: () => commit(outcome.value) } : { unreadable: true, flag: fail };
  });

  function fail() {
    const open = live();
    if (open && !open.failed) setDraft({ ...open, failed: true });
  }

  function draftOutcome(): { kind: 'none' | 'unreadable' } | { kind: 'commit'; value: Value | null } {
    if (!live() || fixed || drafted === undefined) return { kind: 'none' };
    return drafted === false ? { kind: 'unreadable' } : { kind: 'commit', value: drafted };
  }

  function commit(next: Value | null) {
    committed();
    setDraft(null);
    if (!same(next, value, format.equals)) {
      field.notifyValueChange();
      onValueChange?.(next);
    }
  }

  function commitDraft() {
    const outcome = draftOutcome();
    if (outcome.kind === 'commit') commit(outcome.value);
    else if (outcome.kind === 'unreadable') fail();
  }

  // A person's pick in a Field.Picker beside it replaces what was typed, even when it picks the value already set, and is a person's edit of this input.
  const onPick = useRef(() => {});
  onPick.current = () => {
    if (draft !== null) setDraft(null);
    field.notifyValueChange();
  };
  useLayoutEffect(() => registry.onPick(() => onPick.current()), [registry]);

  const refs = useComposedRefs(node, ref);
  // A reset puts back what the form had, which is not what was typed.
  useFormReset(node, () => setDraft(null), () => undefined);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // The browser then submits the form, whose value input already holds the commit.
    if (event.key === 'Enter' && !isImeKeyEvent(event) && !fixed) commitDraft();
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    setDraft({ text: event.target.value, base: value });
  }

  // The text input sends nothing: the value input does, in the form a server reads.
  const control = field.getControlProps(
    { ...props, ref: refs, 'aria-invalid': flagged ? true : props['aria-invalid'] },
    { sendsName: false },
  );
  // The value input holds what a readable draft says, so the browser's own check of a form, which runs before its submit event and so before the draft commits, sees it.
  const current = drafted === undefined || drafted === false ? value : drafted;
  const valueInput = field.getValueInputProps({ name, required, ...format.valueInput(current) }, control);
  const valueRef = useComposedRefs(valueNode, valueInput.ref);
  // The value input is invalid too, so a submit, Enter's implicit one included, is blocked and Form.Root words it.
  const outside = current !== null ? format.outOfBounds?.(current, strings) : undefined;
  useCustomValidity(valueNode, () => valueNode.current, unreadable ? strings.badInput : outside);
  return (
    <>
      <input
        {...control}
        type="text"
        data-todae-typed-input=""
        {...mark}
        spellCheck={false}
        autoComplete={props.autoComplete ?? 'off'}
        aria-required={required || undefined}
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
