/// <reference lib="esnext.temporal" preserve="true" />
// Relative time, such as "3 minutes ago", from a clock the product owns: no hooks or context.
import { localeFirstDay, type DayOfWeek } from './weekInfo.js';

export type RelativeTimeTextOptions = {
  /** The locale, such as "ko". The runtime's own when not set. */
  locale?: string;
  /** How long the words are, as `Intl.RelativeTimeFormat` takes it: `long` (3 minutes ago), `short` (3 min. ago) or `narrow`. `long` when not set. */
  style?: Intl.RelativeTimeFormatStyle;
  /** `auto` writes words such as "yesterday" and "now" where the locale has them; `always` writes a number, such as "1 day ago". `auto` when not set. */
  numeric?: Intl.RelativeTimeFormatNumeric;
  /** The day weeks start on, from 1 for Monday to 7 for Sunday, as `Calendar.Root` takes it. The locale's own when not set. */
  firstDayOfWeek?: DayOfWeek;
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
 * hours between the two. From a day it counts calendar days, weeks, months or
 * years in `value`'s time zone and the Gregorian calendar, so `last month` is
 * the month before.
 */
export function formatRelativeTime(
  value: Temporal.ZonedDateTime,
  now: Temporal.ZonedDateTime | Temporal.Instant,
  options: RelativeTimeTextOptions = {},
): string {
  const format = formatter(options);
  // Nanoseconds, since milliseconds floor each side and can round a difference up past a unit.
  const elapsed = Number((value.epochNanoseconds - now.epochNanoseconds) / 1_000_000_000n);
  // The same instant reads as just past, so numeric 'always' writes "0 seconds ago", not "in 0 seconds".
  const seconds = elapsed === 0 ? -0 : elapsed;
  if (Math.abs(seconds) < 60) return format.format(seconds, 'second');
  if (Math.abs(seconds) < 3600) return format.format(Math.trunc(seconds / 60), 'minute');
  const hours = Math.trunc(seconds / 3600);

  // The time between picks the unit; the count is in the calendar, in value's time zone, so a
  // -1 that numeric 'auto' writes as "yesterday", "last week", "last month" or "last year" is the
  // date, week, month or year before, and 11 pm two days back is "2 days ago".
  const to = value.withCalendar('iso8601').toPlainDate();
  const from = Temporal.Instant.fromEpochNanoseconds(now.epochNanoseconds).toZonedDateTimeISO(value.timeZoneId).toPlainDate();
  const days = from.until(to, { largestUnit: 'day' }).days;
  // A day with a clock change can hold 25 hours on one date.
  if (Math.abs(hours) < 24 || days === 0) return format.format(hours, 'hour');
  if (Math.abs(days) < 7) return format.format(days, 'day');
  const span = from.until(to, { largestUnit: 'year' });
  const months = (to.year - from.year) * 12 + to.month - from.month;
  if (span.years !== 0 || Math.abs(months) >= 12) return format.format(to.year - from.year, 'year');
  if (span.months !== 0) return format.format(months, 'month');
  const first = options.firstDayOfWeek ?? localeFirstDay(options.locale);
  const weekStart = (date: Temporal.PlainDate) => date.subtract({ days: (date.dayOfWeek - first + 7) % 7 });
  return format.format(weekStart(from).until(weekStart(to)).days / 7, 'week');
}
