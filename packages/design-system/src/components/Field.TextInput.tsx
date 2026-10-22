import { useLayoutEffect, useRef, type ChangeEvent, type InputHTMLAttributes, type Ref, type SyntheticEvent } from 'react';
import { activeIn } from './activeElement.js';
import { mergeDescribedBy, useFieldContext } from './Field.context.js';
import { composeHandlers, cx, useComposedRefs } from './props.js';
import styles from './Field.module.css';
import { useField } from '../hooks/useField.js';
import { useTextEntry, valueChangeHandler } from './Field.shared.js';
import { warnOnce } from './warnOnce.js';

/**
 * Input types that take a string value. A number is `Field.NumberInput`, a
 * time `Field.TimePicker`, a date `Field.DatePicker`, a range of dates
 * `Field.DateRangePicker` and both `Field.DateTimePicker`, with a text input
 * beside any of the pickers read by `parseTime`, `parseDate`,
 * `parseDateRange` or `parseDateTime` for a typed value.
 */
export type FieldTextInputType = 'text' | 'search' | 'email' | 'url' | 'tel' | 'password';

export type FieldTextInputProps = {
  value: string;
  /** Optional: `onValueChange` alone is enough when the event is not needed. */
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  type?: FieldTextInputType;
  ref?: Ref<HTMLInputElement>;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'type' | 'disabled' | 'onChange'>;

export function TextInput({
  value,
  onChange,
  onValueChange,
  type = 'text',
  className,
  maxLength,
  readOnly,
  onSelect,
  ref,
  'aria-describedby': describedBy,
  ...props
}: FieldTextInputProps) {
  const field = useField();
  const own = useRef<HTMLInputElement>(null);
  const composedRef = useComposedRefs(own, ref);
  // The last selection, so a change of type, such as a password's show button switching to text,
  // keeps the caret where it was rather than where the browser puts it.
  const selection = useRef<[number | null, number | null, 'forward' | 'backward' | 'none' | null] | null>(null);
  const shownType = useRef(type);
  useLayoutEffect(() => {
    if (shownType.current === type) return;
    shownType.current = type;
    const input = own.current;
    const [start, end, direction] = selection.current ?? [];
    if (!input || start == null || end == null || activeIn(input) !== input) return;
    const text = input.value;
    // Chromium puts the caret at the start when it next renders a focused input whose type
    // changed, after anything set here, so put it back in the next frame.
    const frame = requestAnimationFrame(() => {
      if (activeIn(input) !== input || input.value !== text) return;
      try {
        input.setSelectionRange(start, end, direction ?? undefined);
      } catch {
        // A type with no selection, such as email.
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [type]);
  const recordSelection = (event: SyntheticEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    try {
      selection.current = [input.selectionStart, input.selectionEnd, input.selectionDirection];
    } catch {
      selection.current = null;
    }
  };
  const ctx = useFieldContext();
  // The type is gone from the union, but a product's cast or plain JavaScript can still pass it.
  const legacyNumber = (type as string) === 'number';
  if (legacyNumber) {
    warnOnce('text-input-number', 'Field.TextInput no longer supports type="number"; use Field.NumberInput, which reads and writes a number in the locale\'s format.');
  }
  // Browsers ignore maxLength on a native number input, so that path shows and announces no limit, as it always did.
  const limit = typeof maxLength === 'number' && !legacyNumber ? maxLength : undefined;
  const counterMounted = useTextEntry(ctx.store, value, limit);
  const hint = counterMounted && limit !== undefined ? ctx.hintId : undefined;
  return (
    <input
      {...field.getControlProps({ ...props, ref: composedRef, 'aria-describedby': mergeDescribedBy(describedBy, hint) })}
      maxLength={maxLength}
      value={value}
      type={type}
      className={cx(styles.input, className)}
      onChange={valueChangeHandler(onChange, onValueChange)}
      onSelect={composeHandlers(onSelect, recordSelection)}
      readOnly={readOnly ?? (!onChange && !onValueChange)}
    />
  );
}
