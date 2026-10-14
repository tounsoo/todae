/// <reference lib="esnext.temporal" preserve="true" />
// Server-safe date and time text for a text input beside Field.DateTimePicker: no hooks or context.
import { fold, parseDate, type DateTextOptions } from './dateText';
import { parseTime, splitWords } from './timeText';

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

/** A number, or a letter with its marks, and the punctuation, symbols or spaces before it. */
type Atom = { text: string; number: boolean; gap: string };

function atoms(text: string): Atom[] {
  const out: Atom[] = [];
  let gap = '';
  for (const [piece] of fold(text).matchAll(/\p{N}+|\p{L}\p{M}*|\p{M}+|[^\p{L}\p{M}\p{N}]+/gu)) {
    if (!/^[\p{L}\p{M}\p{N}]/u.test(piece)) {
      gap += piece;
      continue;
    }
    out.push({ text: piece, number: /^\p{N}/u.test(piece), gap });
    gap = '';
  }
  return out;
}

const SPACE_OR_COMMA = /[\s,，、،]/u;

/**
 * Whether a date may end and a time start before `atoms[at]`: anywhere but
 * inside a word's marks, or between two numbers with no space or comma
 * between them, such as in "9:05" or "10/13".
 */
function canCut(list: Atom[], at: number) {
  const before = list[at - 1]!;
  const after = list[at]!;
  if (/^\p{M}/u.test(after.text)) return false;
  return !(before.number && after.number && !SPACE_OR_COMMA.test(after.gap));
}

const render = (list: Atom[]) => list.map((atom, index) => (index ? atom.gap : '') + atom.text).join('');

/**
 * The date and time in typed text, or `null` when the text is not one. It
 * reads a date as `parseDate` does, then a time as `parseTime` does, in the
 * order the locale writes them, with or without the words the locale writes
 * between them, such as `10/13/2026 9:30 pm` or `Oct 13, 2026 at 9:30 PM` in
 * en-US. Where a number of the date meets a number of the time, as in
 * `13.10.2026 21:30`, a space or a comma goes between them. Text that reads as
 * more than one date and time is not read.
 */
export function parseDateTime(text: string, options: DateTimeTextOptions = {}): Temporal.PlainDateTime | null {
  const { joiners, dateFirst, timeFirst } = localeDateTime(options.locale);
  const list = atoms(text);
  const found = new Map<string, Temporal.PlainDateTime>();
  // The words the locale writes between, before or after the halves may be left in or out.
  const trim = (half: string, start: boolean, end: boolean) => {
    const words = splitWords(half);
    let first = 0;
    while (start && first < words.length - 1 && joiners.has(words[first]!)) first++;
    let last = words.length;
    while (end && last > first + 1 && joiners.has(words[last - 1]!)) last--;
    return words.slice(first, last).join(' ');
  };
  const read = (dateText: string, timeText: string) => {
    const date = parseDate(dateText, options);
    const time = date && parseTime(timeText, options);
    if (!date || !time) return;
    const value = date.toPlainDateTime(time);
    found.set(value.toString(), value);
  };
  for (let at = 1; at < list.length; at++) {
    if (!canCut(list, at)) continue;
    const before = render(list.slice(0, at));
    const after = render(list.slice(at));
    for (const strip of [false, true]) {
      if (dateFirst) {
        const timeText = trim(after, strip, true);
        // A date typed without a year must not take the time's hour as one, as
        // in "10/13 9 05": a last number of one or two digits, standing alone,
        // that is the year and also starts a time with the rest.
        const last = list[at - 1]!;
        const date = parseDate(trim(before, true, strip), options);
        const hour =
          date &&
          last.number &&
          last.text.length <= 2 &&
          at > 1 &&
          canCut(list, at - 1) &&
          Number(last.text) === date.year % 100 &&
          parseTime(`${last.text} ${timeText}`, options);
        if (!hour) read(trim(before, true, strip), timeText);
      }
      if (timeFirst) read(trim(after, strip, true), trim(before, true, strip));
    }
  }
  if (found.size !== 1) return null;
  return found.values().next().value!;
}
