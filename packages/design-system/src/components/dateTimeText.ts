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
  /**
   * Punctuation the locale writes in a date and not in a time, nor between a
   * date and a time, such as "/" in en-US, and the reverse, such as ":". A
   * date and a time never meet across these, and a date has none of a time's.
   */
  dateMarks: Set<string>;
  timeMarks: Set<string>;
  /** How many numbers the locale writes in a date alone, such as 2 in "Oct 13, 2026" and 3 in "10/13/2026", and in a time alone. */
  dateNumbers: Set<number>;
  timeNumbers: Set<number>;
};

const localeDateTimes = new Map<string, LocaleDateTime>();

const PUNCTUATION = /[^\p{L}\p{M}\p{N}\s]/u;

const written = (locale: string | undefined, style: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale, { ...style, calendar: 'gregory', timeZone: 'UTC' }).format(Date.UTC(2026, 9, 13, 21, 30, 15));

/** The punctuation in the locale's text in a style, such as "/" and ":" in en-US, or ":" in a month's name in sa. */
const punctuation = (locale: string | undefined, style: Intl.DateTimeFormatOptions) =>
  [...fold(written(locale, style))].filter((char) => PUNCTUATION.test(char));

const DATE_PARTS = new Set(['year', 'month', 'day', 'weekday', 'era', 'relatedYear', 'yearName']);
const TIME_PARTS = new Set(['hour', 'minute', 'second', 'dayPeriod']);

function localeDateTime(locale: string | undefined): LocaleDateTime {
  const key = locale ?? '';
  const cached = localeDateTimes.get(key);
  if (cached) return cached;
  const joiners = new Set<string>();
  const between = new Set<string>();
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
    const inner = parts.slice(from + 1, to);
    for (const part of inner) for (const char of fold(part.value)) if (PUNCTUATION.test(char)) between.add(char);
    const outside = [...parts.slice(0, Math.min(dates[0]!, times[0]!)), ...inner, ...parts.slice(Math.max(dates.at(-1)!, times.at(-1)!) + 1)];
    for (const part of outside) {
      if (part.type !== 'literal') continue;
      for (const word of splitWords(part.value)) if (/\p{L}/u.test(word)) joiners.add(word);
    }
  }
  // Every way the locale writes a date alone, or a time alone.
  const dateStyles: Intl.DateTimeFormatOptions[] = [
    { year: '2-digit', month: '2-digit', day: '2-digit' },
    { year: 'numeric', month: 'numeric', day: 'numeric' },
    { dateStyle: 'medium' },
    { dateStyle: 'long' },
    { dateStyle: 'full' },
  ];
  const timeStyles: Intl.DateTimeFormatOptions[] = [
    { hour: 'numeric', minute: '2-digit', second: '2-digit' },
    { hour: 'numeric', minute: '2-digit', hourCycle: 'h23' },
    { timeStyle: 'short' },
    { timeStyle: 'medium' },
  ];
  // Their marks, such as ":" after the month in sa: a date's own are the ones
  // between its numbers, and a time's own are in none of the date's text.
  const inNumericDate = new Set(dateStyles.slice(0, 2).flatMap((style) => punctuation(locale, style)));
  const inDate = new Set(dateStyles.flatMap((style) => punctuation(locale, style)));
  const inTime = new Set(timeStyles.flatMap((style) => punctuation(locale, style)));
  // How many numbers they have, such as 4 in tok, which numbers the weekday.
  const numbers = (style: Intl.DateTimeFormatOptions) => atoms(written(locale, style)).filter((atom) => atom.number).length;
  const dateNumbers = new Set(dateStyles.map(numbers));
  const timeNumbers = new Set(timeStyles.map(numbers));
  const only = (marks: Set<string>, other: Set<string>) => new Set([...marks].filter((char) => !other.has(char) && !between.has(char)));
  const text = { joiners, dateFirst: dateFirst || !timeFirst, timeFirst, dateMarks: only(inNumericDate, inTime), timeMarks: only(inTime, inDate), dateNumbers, timeNumbers };
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

const render = (list: Atom[]) => list.map((atom, index) => (index ? atom.gap : '') + atom.text).join('');

/**
 * The date, when the year in its text is written as Intl writes a year, with
 * all its digits or its last two, so the hour of a time typed after a date
 * without a year, as "9" in "Oct 13 9 05 pm", is not taken for one.
 */
const writesYear = (half: Atom[], date: Temporal.PlainDate | null) => {
  if (!date) return null;
  const year = String(date.year);
  return half.some((atom) => atom.number && (atom.text === year || (atom.text.length === 2 && atom.text === year.slice(-2)))) ? date : null;
};

const hasMark = (list: Atom[], marks: Set<string>) => list.some((atom, index) => index > 0 && [...atom.gap].some((char) => marks.has(char)));

/**
 * The date and time in typed text, or `null` when the text is not one. It
 * reads a date as `parseDate` does, with its year in full or as its last two
 * digits, then a time as `parseTime` does, in the order the locale writes
 * them, with or without the words the locale writes between them, such as
 * `10/13/2026 9:30 pm` or `Oct 13, 2026 at 9:30 PM` in en-US. The time needs
 * its minutes, as in `21:30` or `2130`, or a word such as `pm`, so an hour
 * alone, as in `13.10.2026 21`, is not read. Text that reads as more than one
 * date and time is not read.
 */
export function parseDateTime(text: string, options: DateTimeTextOptions = {}): Temporal.PlainDateTime | null {
  const { joiners, dateFirst, timeFirst, dateMarks, timeMarks, dateNumbers, timeNumbers } = localeDateTime(options.locale);
  const list = atoms(text);
  // How many numbers come before each atom.
  const counts = [0];
  for (const atom of list) counts.push(counts.at(-1)! + (atom.number ? 1 : 0));
  const total = counts.at(-1)!;
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
  // A time has as many numbers as the locale writes in one, or one number with
  // its minutes in it, as 2130, or with a word, as 9 pm.
  const timeReads = (half: Atom[], timeText: string) => {
    const numbers = half.filter((atom) => atom.number);
    if (numbers.length === 1) return numbers[0]!.text.length >= 3 || /\p{L}/u.test(timeText);
    return timeNumbers.has(numbers.length);
  };
  const read = (dateHalf: Atom[], dateText: string, timeHalf: Atom[], timeText: string, between: boolean) => {
    if (hasMark(dateHalf, timeMarks) || !timeReads(timeHalf, timeText)) return;
    const date = writesYear(dateHalf, parseDate(dateText, options));
    const time = date && parseTime(timeText, options);
    if (!date || !time) return;
    const value = date.toPlainDateTime(time);
    (between ? joined : found).set(value.toString(), value);
  };
  for (let at = 1; at < list.length; at++) {
    const after = list[at]!;
    // Not inside a word's marks, nor between two numbers across a mark only a date or a time has, as in "10/13" or "9:30".
    if (/^\p{M}/u.test(after.text)) continue;
    if (list[at - 1]!.number && after.number && [...after.gap].some((char) => dateMarks.has(char) || timeMarks.has(char))) continue;
    const head = list.slice(0, at);
    const tail = list.slice(at);
    const [before, rest] = [render(head), render(tail)];
    for (const strip of [false, true]) {
      // Whether this pass left out a word between the halves.
      const between = strip && (trim(before, true, true) !== trim(before, true, false) || trim(rest, true, true) !== trim(rest, false, true));
      if (dateFirst && dateNumbers.has(counts[at]!)) {
        read(head, trim(before, true, strip), tail, trim(rest, strip, true), between);
      }
      if (timeFirst && dateNumbers.has(total - counts[at]!)) {
        read(tail, trim(rest, strip, true), head, trim(before, true, strip), between);
      }
    }
  }
  const readings = joined.size > 0 ? joined : found;
  if (readings.size !== 1) return null;
  return readings.values().next().value!;
}
