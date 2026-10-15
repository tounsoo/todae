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
  /** The orders the locale writes a month and a day in numbers, with a year and without. */
  monthDay: Set<'md' | 'dm'>;
  /** Punctuation the locale writes between the date and the time and not inside either, such as "/" in az. */
  marks: Set<string>;
  /** The orders the locale writes a month's name and a day in, with a year and without. */
  namedMonthDay: Set<'md' | 'dm'>;
};

const localeDateTimes = new Map<string, LocaleDateTime>();

const PUNCTUATION = /[^\p{L}\p{M}\p{N}\s]/u;

/** The punctuation in the literals of the locale's text in a style, such as "/" and ":" in en-US. */
const punctuation = (locale: string | undefined, style: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale, { ...style, calendar: 'gregory', timeZone: 'UTC' })
    .formatToParts(Date.UTC(2026, 9, 13, 21, 30, 15))
    .flatMap((part) => (part.type === 'literal' ? [...fold(part.value)].filter((char) => PUNCTUATION.test(char)) : []));

const DATE_PARTS = new Set(['year', 'month', 'day', 'weekday', 'era', 'relatedYear', 'yearName']);
const TIME_PARTS = new Set(['hour', 'minute', 'second', 'dayPeriod']);

function localeDateTime(locale: string | undefined): LocaleDateTime {
  const key = locale ?? '';
  const cached = localeDateTimes.get(key);
  if (cached) return cached;
  const joiners = new Set<string>();
  const marks = new Set<string>();
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
    const between = parts.slice(from + 1, to);
    for (const part of between) for (const char of fold(part.value)) if (PUNCTUATION.test(char)) marks.add(char);
    const outside = [...parts.slice(0, Math.min(dates[0]!, times[0]!)), ...between, ...parts.slice(Math.max(dates.at(-1)!, times.at(-1)!) + 1)];
    for (const part of outside) {
      if (part.type !== 'literal') continue;
      for (const word of splitWords(part.value)) if (/\p{L}/u.test(word)) joiners.add(word);
    }
  }
  // A mark the locale also writes inside a numeric date or a time, such as "." in ru, which also ends "г.", can't end the date.
  for (const style of [
    { year: '2-digit', month: '2-digit', day: '2-digit' },
    { year: 'numeric', month: 'numeric', day: 'numeric' },
    { hour: 'numeric', minute: '2-digit', second: '2-digit' },
    { hour: 'numeric', minute: '2-digit', hourCycle: 'h23' },
  ] as const) {
    for (const char of punctuation(locale, style)) marks.delete(char);
  }
  const monthDay = new Set<'md' | 'dm'>();
  for (const style of [{ month: 'numeric', day: 'numeric' }, { year: 'numeric', month: 'numeric', day: 'numeric' }] as const) {
    const types = new Intl.DateTimeFormat(locale, { ...style, calendar: 'gregory', timeZone: 'UTC' })
      .formatToParts(Date.UTC(2026, 9, 13))
      .map((part) => part.type);
    monthDay.add(types.indexOf('month') < types.indexOf('day') ? 'md' : 'dm');
  }
  const namedMonthDay = new Set<'md' | 'dm'>();
  // With a year too, since some locales write "Okt 9" without one but "9 Okt 2026" with it.
  for (const month of ['short', 'long'] as const) {
    for (const year of [undefined, 'numeric', '2-digit'] as const) {
      const types = new Intl.DateTimeFormat(locale, { year, month, day: 'numeric', calendar: 'gregory', timeZone: 'UTC' })
        .formatToParts(Date.UTC(2026, 9, 13))
        .map((part) => part.type);
      namedMonthDay.add(types.indexOf('month') < types.indexOf('day') ? 'md' : 'dm');
    }
  }
  const text = { joiners, dateFirst: dateFirst || !timeFirst, timeFirst, monthDay, marks, namedMonthDay };
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
 * inside a word's marks, or between two numbers with no space, comma or mark
 * the locale writes between the date and the time, such as in "9:05" or
 * "10/13" in en-US.
 */
function canCut(list: Atom[], at: number, marks: Set<string>) {
  const before = list[at - 1]!;
  const after = list[at]!;
  if (/^\p{M}/u.test(after.text)) return false;
  return !(before.number && after.number && !SPACE_OR_COMMA.test(after.gap) && ![...after.gap].some((char) => marks.has(char)));
}

// Leap years four years apart: every month and day, February 29 too, falls on every weekday in one of them.
const ANY_YEAR = [2000, 2004, 2008, 2012, 2016, 2020, 2024];

// Stands for a year in a candidate date until one of ANY_YEAR takes its place.
const year0 = '\u0000';

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
  const { joiners, dateFirst, timeFirst, monthDay, marks, namedMonthDay } = localeDateTime(options.locale);
  const list = atoms(text);
  const found = new Map<string, Temporal.PlainDateTime>();
  // Readings with a word the locale writes between the halves left out of
  // them, which win over readings that take the word into a half, as "am" in
  // cy, which is "at" between the halves and also AM.
  const joined = new Map<string, Temporal.PlainDateTime>();
  // The words the locale writes between, before or after the halves may be left in or out.
  const trim = (half: string, start: boolean, end: boolean) => {
    const words = splitWords(half);
    let first = 0;
    while (start && first < words.length - 1 && joiners.has(words[first]!)) first++;
    let last = words.length;
    while (end && last > first + 1 && joiners.has(words[last - 1]!)) last--;
    return words.slice(first, last).join(' ');
  };
  const read = (date: Temporal.PlainDate | null, timeText: string, between: boolean) => {
    const time = date && parseTime(timeText, options);
    if (!date || !time) return;
    const value = date.toPlainDateTime(time);
    (between ? joined : found).set(value.toString(), value);
  };
  // Whether part of a date reads as a date without a year: two numbers that are
  // a month and a day in an order the locale writes them in, or words that read
  // as a date with a year put before or after them, or, for a day and a month's
  // name in an order the locale writes them in, on either side of the day, as
  // "13 Ukw." in rw, which in newer locale data writes the year first and the day last.
  const yearless = (half: string) => {
    const numbers = /^(\d{1,2}) (\d{1,2})$/.exec(half);
    if (!numbers) {
      const words = half.split(' ');
      const day = words.filter((word) => /^\d+$/.test(word));
      const rest = words.filter((word) => !/^\d+$/.test(word)).join(' ');
      const moved =
        day.length !== 1
          ? []
          : words[0] === day[0] && namedMonthDay.has('dm')
            ? [`${year0} ${rest} ${day[0]}`, `${rest} ${year0} ${day[0]}`]
            : words.at(-1) === day[0] && namedMonthDay.has('md')
              ? [`${day[0]} ${rest} ${year0}`, `${day[0]} ${year0} ${rest}`]
              : [];
      return ANY_YEAR.some((year) =>
        [`${half} ${year}`, `${year} ${half}`, ...moved.map((candidate) => candidate.replace(year0, String(year)))].some((candidate) =>
          parseDate(candidate, options),
        ),
      );
    }
    return [...monthDay].some((order) => {
      const [month, day] = (order === 'md' ? [numbers[1], numbers[2]] : [numbers[2], numbers[1]]).map(Number) as [number, number];
      return month >= 1 && month <= 12 && day >= 1 && day <= new Temporal.PlainYearMonth(2000, month).daysInMonth;
    });
  };
  for (let at = 1; at < list.length; at++) {
    if (!canCut(list, at, marks)) continue;
    const before = render(list.slice(0, at));
    const after = render(list.slice(at));
    for (const strip of [false, true]) {
      // A date typed without a year must not take a number of the time to make
      // one up, as "10/13 9 05" would read as 2009-10-13T05:00 in en-US and
      // "10. 9. 21 05" as 2010-09-21T05:00 in ko: when the date's number beside
      // the time stands apart, the time reads with it, and the rest of the date
      // reads without a year, the text may be that date and time, so this cut
      // is not read.
      // Whether this pass left out a word between the halves.
      const between = strip && (trim(before, true, true) !== trim(before, true, false) || trim(after, true, true) !== trim(after, false, true));
      if (dateFirst) {
        const date = parseDate(trim(before, true, strip), options);
        const timeText = trim(after, strip, true);
        const last = list[at - 1]!;
        const taken =
          date !== null &&
          last.number &&
          at > 1 &&
          canCut(list, at - 1, marks) &&
          parseTime(`${last.text} ${timeText}`, options) !== null &&
          yearless(trim(render(list.slice(0, at - 1)), true, strip));
        if (!taken) read(date, timeText, between);
      }
      if (timeFirst) {
        const date = parseDate(trim(after, strip, true), options);
        const timeText = trim(before, true, strip);
        const first = list[at]!;
        const taken =
          date !== null &&
          first.number &&
          at + 1 < list.length &&
          canCut(list, at + 1, marks) &&
          parseTime(`${timeText} ${first.text}`, options) !== null &&
          yearless(trim(render(list.slice(at + 1)), strip, true));
        if (!taken) read(date, timeText, between);
      }
    }
  }
  const readings = joined.size > 0 ? joined : found;
  if (readings.size !== 1) return null;
  return readings.values().next().value!;
}
