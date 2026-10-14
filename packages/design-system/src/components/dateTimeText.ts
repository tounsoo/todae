/// <reference lib="esnext.temporal" preserve="true" />
// Server-safe date and time text for a text input beside Field.DateTimePicker: no hooks or context.
import { parseDate, type DateTextOptions } from './dateText';
import { parseTime, spaceWords, splitWords } from './timeText';

export type DateTimeTextOptions = DateTextOptions;

const hasSeconds = (value: Temporal.PlainDateTime) =>
  value.second !== 0 || value.millisecond !== 0 || value.microsecond !== 0 || value.nanosecond !== 0;

// The date in numbers, as formatDate writes it, and the time in hours and minutes, with seconds when it has them.
const fieldsFor = (seconds: boolean): Intl.DateTimeFormatOptions => ({
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: seconds ? '2-digit' : undefined,
  calendar: 'gregory',
  timeZone: 'UTC',
});

/**
 * The date and time as `locale` writes them, the date in numbers and the time
 * in hours and minutes, or with seconds when it has seconds, such as
 * `10/13/2026, 9:30 PM` in en-US, `13.10.2026, 21:30` in de and
 * `2026. 10. 13. 오후 9:30` in ko. A date in another calendar is written as the
 * same day in the Gregorian calendar.
 */
export function formatDateTime(value: Temporal.PlainDateTime, options: DateTimeTextOptions = {}): string {
  return value.withCalendar('iso8601').toLocaleString(options.locale, fieldsFor(hasSeconds(value)));
}

type LocaleDateTime = {
  /** Words the locale writes between, before or after the date and the time, such as "at" in en-US. */
  joiners: Set<string>;
  /** Whether the locale writes the date before the time, after it, or both, in its styles. */
  dateFirst: boolean;
  timeFirst: boolean;
};

const localeDateTimes = new Map<string, LocaleDateTime>();

const DATE_PARTS = new Set(['year', 'month', 'day', 'weekday', 'era', 'relatedYear', 'yearName']);
const TIME_PARTS = new Set(['hour', 'minute', 'second', 'dayPeriod']);

function localeDateTime(locale: string | undefined): LocaleDateTime {
  const key = locale ?? '';
  const cached = localeDateTimes.get(key);
  if (cached) return cached;
  const joiners = new Set<string>();
  let dateFirst = false;
  let timeFirst = false;
  const styles: Intl.DateTimeFormatOptions[] = [fieldsFor(false), fieldsFor(true)];
  for (const dateStyle of ['medium', 'long', 'full'] as const) {
    for (const timeStyle of ['short', 'medium'] as const) {
      styles.push({ dateStyle, timeStyle, calendar: 'gregory', timeZone: 'UTC' });
    }
  }
  for (const style of styles) {
    const parts = new Intl.DateTimeFormat(locale, style).formatToParts(Date.UTC(2026, 9, 13, 21, 30, 15));
    const dates = parts.flatMap((part, index) => (DATE_PARTS.has(part.type) ? [index] : []));
    const times = parts.flatMap((part, index) => (TIME_PARTS.has(part.type) ? [index] : []));
    if (dates.length === 0 || times.length === 0) continue;
    let from: number;
    let to: number;
    if (dates.at(-1)! < times[0]!) {
      dateFirst = true;
      [from, to] = [dates.at(-1)!, times[0]!];
    } else if (times.at(-1)! < dates[0]!) {
      timeFirst = true;
      [from, to] = [times.at(-1)!, dates[0]!];
    } else continue;
    // The literals between the two halves, and before and after them, such as बजे after the time in hi.
    const outside = [...parts.slice(0, Math.min(dates[0]!, times[0]!)), ...parts.slice(from + 1, to), ...parts.slice(Math.max(dates.at(-1)!, times.at(-1)!) + 1)];
    for (const part of outside) {
      if (part.type !== 'literal') continue;
      for (const word of splitWords(part.value)) if (/\p{L}/u.test(word)) joiners.add(word);
    }
  }
  const text = { joiners, dateFirst: dateFirst || !timeFirst, timeFirst };
  localeDateTimes.set(key, text);
  return text;
}

/**
 * The date and time in typed text, or `null` when the text is not one. It
 * reads a date as `parseDate` does, then a time as `parseTime` does, in the
 * order the locale writes them, with any of the words the locale writes
 * between them, such as `10/13/2026 9:30 pm` or `Oct 13, 2026 at 9:30 PM` in
 * en-US. Text that reads as more than one date and time is not read.
 */
export function parseDateTime(text: string, options: DateTimeTextOptions = {}): Temporal.PlainDateTime | null {
  const { joiners, dateFirst, timeFirst } = localeDateTime(options.locale);
  // The date ends and the time starts between pieces: runs of text between
  // spaces or commas, a letter and a digit beside it, or letters of two
  // scripts. A piece such as "9:05" or "10/13" is one number or date part.
  const all = spaceWords(text)
    .split(/[\s,，、،]+/u)
    .map(splitWords)
    .filter((words) => words.length > 0);
  // Words the locale writes before or after both halves may be left in or out.
  const joiner = (piece: string[]) => piece.length === 1 && joiners.has(piece[0]!);
  let first = 0;
  while (first < all.length - 1 && joiner(all[first]!)) first++;
  let last = all.length;
  while (last > first + 1 && joiner(all[last - 1]!)) last--;
  const pieces = all.slice(first, last);
  const found = new Map<string, Temporal.PlainDateTime>();
  const read = (dateWords: string[], timeWords: string[]) => {
    const date = parseDate(dateWords.join(' '), options);
    if (!date) return;
    const time = parseTime(timeWords.join(' '), options);
    if (!time) return;
    const value = date.toPlainDateTime(time);
    found.set(value.toString(), value);
  };
  const words = (from: number, to: number) => pieces.slice(from, to).flat();
  for (let at = 1; at < pieces.length; at++) {
    // The words the locale writes between the halves may be left in or out.
    let end = at;
    while (end > 1 && joiner(pieces[end - 1]!)) end--;
    let start = at;
    while (start < pieces.length - 1 && joiner(pieces[start]!)) start++;
    for (const [before, after] of [
      [words(0, at), words(at, pieces.length)],
      [words(0, end), words(start, pieces.length)],
    ]) {
      if (dateFirst) read(before!, after!);
      if (timeFirst) read(after!, before!);
    }
  }
  if (found.size !== 1) return null;
  return found.values().next().value!;
}
