/// <reference lib="esnext.temporal" preserve="true" />
// Server-safe date and time text for a text input beside Field.DateTimePicker: no hooks or context.
import { fold, isMonthDay, readDate, type DateTextOptions } from './dateText';
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
  /** The marks the locale writes before and after a month and a day without a year, such as "." after "13. 10." in cs. */
  yearlessEdges: { start: Set<string>; end: Set<string> };
};

const localeDateTimes = new Map<string, LocaleDateTime>();

// How the locale may write a month and a day without a year, for the marks before and after them.
const monthDays: Intl.DateTimeFormatOptions[] = [
  { month: 'numeric', day: 'numeric' },
  { month: '2-digit', day: '2-digit' },
  { month: 'short', day: 'numeric' },
  { month: 'long', day: 'numeric' },
  { weekday: 'short', month: 'short', day: 'numeric' },
  { weekday: 'long', month: 'long', day: 'numeric' },
  { weekday: 'long', month: 'short', day: 'numeric' },
];

const PUNCTUATION = /[^\p{L}\p{M}\p{N}\s]/u;

const written = (locale: string | undefined, style: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale, { ...style, calendar: 'gregory', timeZone: 'UTC' }).formatToParts(Date.UTC(2026, 9, 13, 21, 30, 15));

/** The punctuation in text, such as "/" and ":" in en-US, or ":" in a month's name in sa. */
const punctuation = (text: string) => [...fold(text)].filter((char) => PUNCTUATION.test(char));

const join = (parts: Intl.DateTimeFormatPart[]) => parts.map((part) => part.value).join('');

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
    // Not the marks that end a word, as "." in "г." after the year in ru, which belong to the date.
    for (const part of inner) {
      for (const char of fold(part.value).replace(/\p{L}[\p{L}\p{M}]*[^\s\p{L}\p{M}\p{N}]*/gu, '')) if (PUNCTUATION.test(char)) between.add(char);
    }
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
  const dates = dateStyles.map((style) => join(written(locale, style)));
  const times = timeStyles.map((style) => join(written(locale, style)));
  const inNumericDate = new Set(dates.slice(0, 2).flatMap(punctuation));
  const inDate = new Set(dates.flatMap(punctuation));
  const inTime = new Set(times.flatMap(punctuation));
  // How many numbers they have, such as 4 in tok, which numbers the weekday,
  // in digits a number reads as, which Han decimal numbers, as 一, are not.
  const numbers = (style: Intl.DateTimeFormatOptions) =>
    atoms(join(written(locale, { ...style, numberingSystem: 'latn' }))).filter((atom) => atom.number).length;
  const dateNumbers = new Set(dateStyles.map(numbers));
  const timeNumbers = new Set(timeStyles.map(numbers));
  const yearlessEdges = { start: new Set(['']), end: new Set(['']) };
  for (const style of monthDays) {
    const format = new Intl.DateTimeFormat(locale, { ...style, calendar: 'gregory', timeZone: 'UTC' });
    // Every month, as some end their short names with a mark, as "кӑр." in cv.
    for (let month = 0; month < 12; month++) {
      const text = fold(format.format(Date.UTC(2026, month, 13)));
      yearlessEdges.start.add(/^[^\p{L}\p{M}\p{N}]*/u.exec(text)![0].trim());
      yearlessEdges.end.add(trailing(text).trim());
    }
  }
  const only = (marks: Set<string>, other: Set<string>) => new Set([...marks].filter((char) => !other.has(char) && !between.has(char)));
  const text = { joiners, dateFirst: dateFirst || !timeFirst, timeFirst, dateMarks: only(inNumericDate, inTime), timeMarks: only(inTime, inDate), dateNumbers, timeNumbers, yearlessEdges };
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

/** The punctuation, symbols or spaces after the last number or letter of text. */
const trailing = (text: string) => /[^\p{L}\p{M}\p{N}]*$/u.exec(fold(text))![0];

/** A gap with its spaces as one space. */
const spaced = (gap: string) => gap.replace(/\s+/gu, ' ');

/** The gaps between each two numbers that follow each other. */
const numberGaps = (list: Atom[]) =>
  list.flatMap((atom, index) => (index > 0 && atom.number && list[index - 1]!.number ? [spaced(atom.gap)] : []));

const render = (list: Atom[]) => list.map((atom, index) => (index ? atom.gap : '') + atom.text).join('');

const hasMark = (list: Atom[], marks: Set<string>) => list.some((atom, index) => index > 0 && [...atom.gap].some((char) => marks.has(char)));

/**
 * The date and time in typed text, or `null` when the text is not one. It
 * reads a date as `parseDate` does, with its year in full or as its last two
 * digits, then a time as `parseTime` does, in the order the locale writes
 * them, with or without the words the locale writes between them, such as
 * `10/13/2026 9:30 pm` or `Oct 13, 2026 at 9:30 PM` in en-US. The time needs
 * its minutes, as in `21:30` or `2130`, or a word, as in `9 pm`, so an hour
 * alone, as in `13.10.2026 21`, is not read. Text that reads as more than one
 * date and time, or also as a month and day without a year and a time, as
 * `10/13 12 05 pm` in en-US, is not read.
 */
export function parseDateTime(text: string, options: DateTimeTextOptions = {}): Temporal.PlainDateTime | null {
  const { joiners, dateFirst, timeFirst, dateMarks, timeMarks, dateNumbers, timeNumbers, yearlessEdges } = localeDateTime(options.locale);
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
  // its minutes in it, as 2130, or with a word, as 9 pm or 21 h in fr-CA.
  const timeReads = (numbers: string[], timeText: string) => {
    if (numbers.length === 1) return numbers[0]!.length >= 3 || /\p{L}/u.test(timeText);
    return timeNumbers.has(numbers.length);
  };
  // The date, when its year is written in full or in its last two digits, not in one digit.
  const dated = (dateText: string) => {
    const read = readDate(dateText, options);
    if (!read) return null;
    const year = String(read.date.year);
    return read.year === year || read.year === year.slice(-2) ? read.date : null;
  };
  // Readings whose time has a mark of the locale's dates, as "21.30" in de,
  // which are read only when the text reads no other way.
  const loose = new Map<string, Temporal.PlainDateTime>();
  // Whether the text may also be a month and a day without a year, as
  // isMonthDay reads it, and a time, in either order, as "10/13 12 05 pm" in
  // en-US, which a date with a two-digit year, 2012, would also read,
  // "13. 10. 11 05 15" in cs, or "11.05.15 13.10" in da, a time and October 13. Where the two meet, the gap may
  // end a month and day as the locale writes them, as "13. 10." in cs but not
  // "10/13/" in en-US, and the time has one gap between its numbers.
  let alsoYearless = false;
  // Whether the text reads as a date and a time in the order the locale doesn't write them.
  let otherWay = false;
  // isMonthDay for each text once, as each cut asks it of the same halves again.
  const checked = new Map<string, boolean>();
  const monthDay = (dateText: string) => {
    let known = checked.get(dateText);
    if (known === undefined) checked.set(dateText, (known = isMonthDay(dateText, options)));
    return known;
  };
  const yearlessAt = (dateHalf: Atom[], dateText: string, gap: string, timeHalf: Atom[], timeText: string, timeAfter: boolean) => {
    if (hasMark(dateHalf, timeMarks) || dateHalf.filter((atom) => atom.number).length > 2) return false;
    const gaps = numberGaps(timeHalf);
    if (gaps.some((other) => other !== gaps[0]) || hasMark(timeHalf, dateMarks)) return false;
    const numbers = timeHalf.flatMap((atom) => (atom.number ? [atom.text] : []));
    if (!timeReads(numbers, timeText) || !parseTime(timeText, options) || !monthDay(dateText)) return false;
    const folded = fold(gap);
    const edges = timeAfter ? yearlessEdges.end : yearlessEdges.start;
    return [...edges].some((edge) => {
      const left = timeAfter
        ? folded.startsWith(edge) ? folded.slice(edge.length) : folded
        : folded.endsWith(edge) ? folded.slice(0, folded.length - edge.length) : folded;
      return ![...left].some((char) => dateMarks.has(char) || timeMarks.has(char));
    });
  };
  const read = (dateHalf: Atom[], dateText: string, timeHalf: Atom[], timeText: string, between: boolean, own: boolean) => {
    const numbers = timeHalf.flatMap((atom) => (atom.number ? [atom.text] : []));
    if (hasMark(dateHalf, timeMarks) || !timeReads(numbers, timeText)) return;
    const date = dated(dateText);
    const time = date && parseTime(timeText, options);
    if (!date || !time) return;
    const value = date.toPlainDateTime(time);
    const marked = hasMark(timeHalf, dateMarks);
    if (!own) otherWay ||= !marked;
    else (marked ? loose : between ? joined : found).set(value.toString(), value);
  };
  for (let at = 1; at < list.length; at++) {
    const after = list[at]!;
    // Not inside a word's marks, nor between two numbers across a mark only a date or a time has, as in "10/13" or "9:30".
    if (/^\p{M}/u.test(after.text)) continue;
    const head = list.slice(0, at);
    const tail = list.slice(at);
    const [before, rest] = [render(head), render(tail)];
    for (const strip of [false, true]) {
      alsoYearless ||=
        yearlessAt(head, trim(before, true, strip), after.gap, tail, trim(rest, strip, true), true) ||
        yearlessAt(tail, trim(rest, strip, true), after.gap, head, trim(before, true, strip), false);
    }
    if (list[at - 1]!.number && after.number && [...after.gap].some((char) => dateMarks.has(char) || timeMarks.has(char))) continue;
    for (const strip of [false, true]) {
      // Whether this pass left out a word between the halves.
      const between = strip && (trim(before, true, true) !== trim(before, true, false) || trim(rest, true, true) !== trim(rest, false, true));
      if (dateNumbers.has(counts[at]!)) read(head, trim(before, true, strip), tail, trim(rest, strip, true), between, dateFirst);
      if (dateNumbers.has(total - counts[at]!)) read(tail, trim(rest, strip, true), head, trim(before, true, strip), between, timeFirst);
    }
  }
  const readings = joined.size > 0 ? joined : found.size > 0 ? found : otherWay ? new Map() : loose;
  if (readings.size !== 1 || alsoYearless) return null;
  return readings.values().next().value!;
}
