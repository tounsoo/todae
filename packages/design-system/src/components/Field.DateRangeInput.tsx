/// <reference lib="esnext.temporal" preserve="true" />
import { spanOf, type DateRange } from './dateRange.js';
import { formatDateRange, parseDateRange } from './dateRangeText.js';
import { formatDate } from './dateText.js';
import { htmlDateText } from './htmlValue.js';
import { TypedInput, type TypedInputProps } from './Field.TypedInput.js';

export type FieldDateRangeInputProps = TypedInputProps<DateRange> & {
  /** The earliest date the range can hold. A form with a range that starts earlier is invalid. */
  min?: Temporal.PlainDate;
  /** The latest date the range can hold. A form with a range that ends later is invalid. */
  max?: Temporal.PlainDate;
};

/**
 * A text input for a range of dates, typed in the locale's own words, two
 * dates with a separator between them, such as 10/3/2026 – 10/10/2026 in
 * en-US. It reads the text with parseDateRange on blur, Enter and a submit of
 * its form, rewrites it as formatDateRange writes it and calls
 * `onValueChange`; text that is no range stays, invalid. The range goes in a
 * native text input under the field's name, as an ISO 8601 interval such as
 * 2026-10-03/2026-10-10, so `required` blocks a submit, and a range outside
 * `min` and `max` does too. A Field.Picker beside it opens a Calendar in range
 * mode and is named from the dateRangePicker string.
 */
export function DateRangeInput({ min, max, locale, ...props }: FieldDateRangeInputProps) {
  return (
    <TypedInput
      {...props}
      format={{
        picks: 'dateRange',
        parse: (typed) => parseDateRange(typed, { locale }),
        format: (range) => formatDateRange(range, { locale }),
        equals: (a, b) => a.start.equals(b.start) && a.end.equals(b.end),
        valueInput: (value) => {
          const range = value && spanOf(value.start, value.end);
          return {
            type: 'text',
            value: range
              ? `${htmlDateText(range.start.withCalendar('iso8601'))}/${htmlDateText(range.end.withCalendar('iso8601'))}`
              : '',
          };
        },
        // Worded as a Field.DateInput's bounds are, since a text input can't check them itself.
        outOfBounds: (value, strings) => {
          const { start, end } = spanOf(value.start, value.end);
          if (min !== undefined && Temporal.PlainDate.compare(start, min) < 0) {
            return strings.dateRangeUnderflow(formatDate(min, { locale }));
          }
          if (max !== undefined && Temporal.PlainDate.compare(end, max) > 0) {
            return strings.dateRangeOverflow(formatDate(max, { locale }));
          }
          return undefined;
        },
      }}
    />
  );
}
