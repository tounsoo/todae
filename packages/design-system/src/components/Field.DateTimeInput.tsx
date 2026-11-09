/// <reference lib="esnext.temporal" preserve="true" />
import { formatDateTime, parseDateTime } from './dateTimeText.js';
import { htmlDateTime, valueBounds } from './htmlValue.js';
import { TypedInput, type TypedInputProps } from './Field.TypedInput.js';

export type FieldDateTimeInputProps = TypedInputProps<Temporal.PlainDateTime> & {
  /** The earliest date and time. A form with an earlier one is invalid. */
  min?: Temporal.PlainDateTime;
  /** The latest date and time. A form with a later one is invalid. */
  max?: Temporal.PlainDateTime;
};

/**
 * A text input for a date and time, typed in the locale's own words, such as
 * 10/13/2026 9:30 pm in en-US. It reads the text with parseDateTime on blur,
 * Enter and a submit of its form, rewrites it as formatDateTime writes it and
 * calls `onValueChange`; text that is no date and time stays, invalid. The
 * value goes in a native datetime-local input the browser validates, so
 * `required`, `min` and `max` block a submit and Form.Root shows them. A
 * Field.Picker beside it is named from the dateTimePicker string.
 */
export function DateTimeInput({ min, max, locale, ...props }: FieldDateTimeInputProps) {
  const text = (value: Temporal.PlainDateTime) => formatDateTime(value, { locale });
  return (
    <TypedInput
      {...props}
      format={{
        picks: 'dateTime',
        parse: (typed) => parseDateTime(typed, { locale }),
        format: text,
        equals: (a, b) => a.equals(b),
        valueInput: (value) => ({
          type: 'datetime-local',
          value: value ? htmlDateTime(value) : '',
          // Any time can be typed, so no step is off.
          step: 'any',
          ...valueBounds(min, max, htmlDateTime, text),
        }),
      }}
    />
  );
}
