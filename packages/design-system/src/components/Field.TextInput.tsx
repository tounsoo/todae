import type { ChangeEvent, InputHTMLAttributes, Ref } from 'react';
import { mergeDescribedBy, useFieldContext } from './Field.context.js';
import { cx } from './props.js';
import styles from './Field.module.css';
import { useField } from '../hooks/useField.js';
import { useTextEntry, valueChangeHandler } from './Field.shared.js';
import { warnOnce } from './warnOnce.js';

/**
 * Input types that take a string value. A number is `Field.NumberInput`, a
 * time `Field.TimePicker`, a date `Field.DatePicker` and both
 * `Field.DateTimePicker`, with a text input beside any of the pickers read by
 * `parseTime`, `parseDate` or `parseDateTime` for a typed value.
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
  'aria-describedby': describedBy,
  ...props
}: FieldTextInputProps) {
  const field = useField();
  const ctx = useFieldContext();
  // The type is gone from the union, but a product's cast or plain JavaScript can still pass it.
  if ((type as string) === 'number') {
    warnOnce('text-input-number', 'Field.TextInput no longer supports type="number"; use Field.NumberInput, which reads and writes a number in the locale\'s format.');
  }
  const limit = typeof maxLength === 'number' ? maxLength : undefined;
  const counterMounted = useTextEntry(ctx.store, value, limit);
  const hint = counterMounted && limit !== undefined ? ctx.hintId : undefined;
  return (
    <input
      {...field.getControlProps({ ...props, 'aria-describedby': mergeDescribedBy(describedBy, hint) })}
      maxLength={maxLength}
      value={value}
      type={type}
      className={cx(styles.input, className)}
      onChange={valueChangeHandler(onChange, onValueChange)}
      readOnly={readOnly ?? (!onChange && !onValueChange)}
    />
  );
}
