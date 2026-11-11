/// <reference lib="esnext.temporal" preserve="true" />
import { formatDate, parseDate } from './dateText.js';
import { htmlDate, valueBounds } from './htmlValue.js';
import { TypedInput, type TypedInputProps } from './Field.TypedInput.js';

export type FieldDateInputProps = TypedInputProps<Temporal.PlainDate> & {
  /** The earliest date. A form with an earlier date is invalid. */
  min?: Temporal.PlainDate;
  /** The latest date. A form with a later date is invalid. */
  max?: Temporal.PlainDate;
};

/**
 * A text input for a date, typed in the locale's own words, such as
 * 10/13/2026 or Oct 13, 2026 in en-US. It reads the text with parseDate on
 * blur, Enter and a submit of its form, rewrites it as formatDate writes it
 * and calls `onValueChange`; text that is no date stays, invalid. The date goes
 * in a native date input the browser validates, so `required`, `min` and `max`
 * block a submit and Form.Root shows them. A Field.Picker beside it opens a
 * Calendar and is named from the datePicker string.
 */
export function DateInput({ min, max, locale, ...props }: FieldDateInputProps) {
  const text = (date: Temporal.PlainDate) => formatDate(date, { locale });
  return (
    <TypedInput
      {...props}
      format={{
        picks: 'date',
        parse: (typed) => parseDate(typed, { locale }),
        format: text,
        equals: (a, b) => a.equals(b),
        valueInput: (value) => ({
          type: 'date',
          value: value ? htmlDate(value.withCalendar('iso8601')) : '',
          ...valueBounds(min, max, (date) => htmlDate(date.withCalendar('iso8601')), text),
        }),
      }}
    />
  );
}
