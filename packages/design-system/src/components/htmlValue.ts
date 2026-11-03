/// <reference lib="esnext.temporal" preserve="true" />
import { warnOnce } from '../internal/warnOnce.js';

// How the Field pickers write a value for their value input, as HTML writes it for that input's type.

// A time for a value input stops at the smallest unit that is set.
function timeUnit(value: Temporal.PlainTime | Temporal.PlainDateTime) {
  if (value.millisecond || value.microsecond || value.nanosecond) return 'millisecond';
  return value.second ? 'second' : 'minute';
}

// HTML writes a year past 9999 as plain digits (20261-10-07); Temporal writes it
// with a sign and six digits (+020261-10-07).
function toHtmlYear(text: string) {
  return text.replace(/^\+0*(\d{4,})(?=-)/, '$1');
}

// A native date input holds the years 1 to 275760; a value or bound outside them reads as none.
function checkHtmlYear(year: number) {
  if (year < 1 || year > 275760) {
    warnOnce(
      'value-input-year',
      `Field.DatePicker and Field.DateTimePicker carry their value in a native date input, which holds only the years 1 to 275760. The year ${year} reads as no date, so it is submitted as empty and a required, min or max check ignores it.`,
    );
  }
}

/** A date as HTML writes one, such as 2026-10-07, for Field.DateRangePicker's text value input, which holds any year. */
export const htmlDateText = (value: Temporal.PlainDate) => toHtmlYear(value.toString({ calendarName: 'never' }));

/** A date as HTML writes one, such as 2026-10-07, for Field.DatePicker's value input. */
export const htmlDate = (value: Temporal.PlainDate) => {
  checkHtmlYear(value.year);
  return htmlDateText(value);
};

/** A date and time as HTML writes one, such as 2026-10-07T09:30, for Field.DateTimePicker's value input. */
export const htmlDateTime = (value: Temporal.PlainDateTime) => {
  const iso = value.withCalendar('iso8601');
  checkHtmlYear(iso.year);
  return toHtmlYear(iso.toString({ smallestUnit: timeUnit(value), calendarName: 'never' }));
};

/** A time as HTML writes one, such as 09:30 or 09:30:15, for Field.TimePicker's value input. */
export const htmlTime = (value: Temporal.PlainTime) => value.toString({ smallestUnit: timeUnit(value) });

/** The `min`, `max` and `bound` options of a value input, from a picker's bounds: each in the type's format, and as the picker shows it. */
export function valueBounds<T>(
  min: T | undefined,
  max: T | undefined,
  html: (value: T) => string,
  label: (value: T) => string,
) {
  return {
    min: min == null ? undefined : html(min),
    max: max == null ? undefined : html(max),
    bound: {
      min: min == null ? undefined : label(min),
      max: max == null ? undefined : label(max),
    },
  };
}
