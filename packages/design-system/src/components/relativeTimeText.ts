/// <reference lib="esnext.temporal" preserve="true" />
// Server-safe relative time, such as "3 minutes ago", for a time the product shows beside a clock it owns: no hooks or context.

export type RelativeTimeTextOptions = {
  /** The locale, such as "ko". The runtime's own when not set. */
  locale?: string;
  /** How long the words are, as `Intl.RelativeTimeFormat` takes it: `long` (3 minutes ago), `short` (3 min. ago) or `narrow`. `long` when not set. */
  style?: Intl.RelativeTimeFormatStyle;
  /** `auto` writes words such as "yesterday" and "now" where the locale has them; `always` writes a number, such as "1 day ago". `auto` when not set. */
  numeric?: Intl.RelativeTimeFormatNumeric;
};

const cache = /* @__PURE__ */ new Map<string, Intl.RelativeTimeFormat>();

function formatter({ locale, style = 'long', numeric = 'auto' }: RelativeTimeTextOptions) {
  const key = `${locale ?? ''}|${style}|${numeric}`;
  let format = cache.get(key);
  if (!format) {
    format = new Intl.RelativeTimeFormat(locale, { style, numeric });
    cache.set(key, format);
  }
  return format;
}

/**
 * How long before or after `now` the time `value` is, as `locale` writes it,
 * such as `3 minutes ago`, `yesterday` or `in 2 weeks` in en and `3분 전`,
 * `어제` or `2주 후` in ko. Under a day it counts whole seconds, minutes or
 * hours that have passed; from a day it counts days, weeks, months or years
 * between the two dates in `value`'s time zone and the Gregorian calendar.
 */
export function formatRelativeTime(
  value: Temporal.ZonedDateTime,
  now: Temporal.ZonedDateTime | Temporal.Instant,
  options: RelativeTimeTextOptions = {},
): string {
  const format = formatter(options);
  const seconds = Math.trunc((value.epochMilliseconds - now.epochMilliseconds) / 1000);
  if (Math.abs(seconds) < 60) return format.format(seconds, 'second');
  if (Math.abs(seconds) < 3600) return format.format(Math.trunc(seconds / 60), 'minute');
  const hours = Math.trunc(seconds / 3600);

  // Calendar units count dates in value's time zone, so 11 pm two days back is "2 days ago", not "yesterday".
  const to = value.withCalendar('iso8601').toPlainDate();
  const from = Temporal.Instant.fromEpochNanoseconds(now.epochNanoseconds).toZonedDateTimeISO(value.timeZoneId).toPlainDate();
  const days = from.until(to, { largestUnit: 'day' }).days;
  // A day with a clock change can hold 25 hours on one date.
  if (Math.abs(hours) < 24 || days === 0) return format.format(hours, 'hour');
  if (Math.abs(days) < 7) return format.format(days, 'day');
  const span = from.until(to, { largestUnit: 'year' });
  if (span.years !== 0) return format.format(span.years, 'year');
  if (span.months !== 0) return format.format(span.months, 'month');
  return format.format(Math.trunc(days / 7), 'week');
}
