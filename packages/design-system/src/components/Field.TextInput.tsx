import type { ChangeEvent, InputHTMLAttributes, Ref } from 'react';
import { mergeDescribedBy, useFieldContext } from './Field.context.js';
import { cx } from './props.js';
import styles from './Field.module.css';
import { useField } from '../hooks/useField.js';
import { useTextEntry } from './Field.shared.js';

/**
 * Input types that take a string value. The number type keeps its native
 * spinner; `value` is the input's string, such as `"42"`. A time is
 * `Field.TimePicker`, a date `Field.DatePicker` and both
 * `Field.DateTimePicker`, with a text input beside any of them read by
 * `parseTime`, `parseDate` or `parseDateTime` for a typed value.
 */
export type FieldTextInputType = 'text' | 'search' | 'email' | 'url' | 'tel' | 'password' | 'number';

// Browsers ignore maxLength on these, so no limit is shown or announced.
const NO_LENGTH_LIMIT: ReadonlySet<FieldTextInputType> = /* @__PURE__ */ new Set(['number']);

export type FieldTextInputProps = {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
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
  'aria-describedby': describedBy,
  ...props
}: FieldTextInputProps) {
  const field = useField();
  const ctx = useFieldContext();
  const limit = typeof maxLength === 'number' && !NO_LENGTH_LIMIT.has(type) ? maxLength : undefined;
  const counterMounted = useTextEntry(ctx.store, value, limit);
  const hint = counterMounted && limit !== undefined ? ctx.hintId : undefined;
  return (
    <input
      {...field.getControlProps({ ...props, 'aria-describedby': mergeDescribedBy(describedBy, hint) })}
      maxLength={maxLength}
      value={value}
      type={type}
      className={cx(styles.input, className)}
      onChange={(event) => {
        onChange(event);
        onValueChange?.(event.target.value);
      }}
    />
  );
}
