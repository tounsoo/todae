/// <reference lib="esnext.temporal" preserve="true" />
// Server-safe date text for a text input beside Field.DatePicker: no hooks or context.

export type DateTextOptions = {
  /** The locale, such as "ko". The runtime's own when not set. */
  locale?: string;
};

type Part = 'year' | 'month' | 'day';

// Dates are shown in the Gregorian calendar whatever the locale's own, as Calendar does.
const GREGORY = { calendar: 'gregory', timeZone: 'UTC' } as const;
const NUMERIC = { year: 'numeric', month: 'numeric', day: 'numeric', ...GREGORY } as const;

/**
 * The date as `locale` writes it in numbers, such as `10/13/2026` in en-US,
 * `13.10.2026` in de and `2026. 10. 13.` in ko. A date in another calendar is
 * written as the same day in the Gregorian calendar.
 */
export function formatDate(date: Temporal.PlainDate, options: DateTextOptions = {}): string {
  return date.withCalendar('iso8601').toLocaleString(options.locale, NUMERIC);
}

/** What a word in a date can be: a month (1–12), or a word to skip, such as a weekday or "de". */
type Word = { month?: number; skip?: boolean };

type LocaleText = {
  /** The order `locale` writes the year, month and day in, in numbers. */
  order: Part[];
  /** The words of the locale's dates, and of English ones, as `normalize` writes them. */
  words: Map<string, Word>;
  /** The longest word, so a scan knows how far to look. */
  longest: number;
};

const localeTexts = new Map<string, LocaleText>();

/** The digit a decimal digit of any script stands for. Each script's digits run 0 to 9 in a row. */
function digitValue(char: string) {
  let first = char.codePointAt(0)!;
  while (/\p{Nd}/u.test(String.fromCodePoint(first - 1))) first--;
  return (char.codePointAt(0)! - first) % 10;
}

/**
 * Text as dates are compared: compatibility forms folded (full-width digits
 * become ASCII), lower case, every script's digits as ASCII, and punctuation
 * as spaces, so "Oct." matches "oct" and "terça-feira" matches "terça feira".
 */
function normalize(text: string) {
  return (
    text
      .normalize('NFKC')
      .toLowerCase()
      // The dot that "İ" leaves in lower case outside Turkish.
      .replace(/̇/g, '')
      .replace(/\p{Nd}/gu, (char) => String(digitValue(char)))
      .replace(/\p{Cf}/gu, '')
      .replace(/[\p{P}\p{Z}\s]+/gu, ' ')
      .trim()
  );
}

function addWord(words: Map<string, Word>, text: string, word: Word) {
  for (const piece of normalize(text).split(/\d+/)) {
    const key = piece.trim();
    if (key === '') continue;
    const known = words.get(key) ?? {};
    // A word is a month only when it names one month, in the locale or in English.
    if (word.month !== undefined && known.month === undefined) known.month = word.month;
    if (word.skip) known.skip = true;
    words.set(key, known);
  }
}

// The styles a date is written in, so the words are the forms used inside a date,
// such as "octubre" with "de", "октября" and "באוקטובר".
const STYLES: Intl.DateTimeFormatOptions[] = [
  { dateStyle: 'full' },
  { dateStyle: 'long' },
  { dateStyle: 'medium' },
  { month: 'long' },
  { month: 'short' },
  { day: 'numeric', month: 'long', year: 'numeric' },
  { day: 'numeric', month: 'short', year: 'numeric' },
  { weekday: 'short' },
];

// A day in each month, and a week of days for the weekdays.
const SAMPLE_DAYS = [
  ...Array.from({ length: 12 }, (_, month) => new Date(Date.UTC(2026, month, 13, 12))),
  ...Array.from({ length: 7 }, (_, index) => new Date(Date.UTC(2026, 9, 11 + index, 12))),
];

function localeText(locale: string | undefined): LocaleText {
  const key = locale ?? '';
  let text = localeTexts.get(key);
  if (text) return text;
  const order = new Intl.DateTimeFormat(locale, NUMERIC)
    .formatToParts(new Date(Date.UTC(2026, 9, 13, 12)))
    .map((part) => part.type)
    .filter((type): type is Part => type === 'year' || type === 'month' || type === 'day');
  const words = new Map<string, Word>();
  for (const names of new Set([locale, 'en'])) {
    for (const style of STYLES) {
      const format = new Intl.DateTimeFormat(names, { ...style, ...GREGORY });
      for (const day of SAMPLE_DAYS) {
        const month = day.getUTCMonth();
        for (const part of format.formatToParts(day)) {
          if (part.type === 'month') {
            // A month written with its number, such as "tháng 10", keeps only its word.
            if (/\p{Nd}/u.test(part.value)) addWord(words, part.value, { skip: true });
            else addWord(words, part.value, { month: month + 1 });
          } else if (part.type !== 'day' && part.type !== 'year') {
            addWord(words, part.value, { skip: true });
          }
        }
      }
    }
  }
  const longest = Math.max(0, ...[...words.keys()].map((word) => word.length));
  text = { order, words, longest };
  localeTexts.set(key, text);
  return text;
}

// A year typed with one or two digits is the one nearest to this year, so 26 is 2026.
function fullYear(digits: string) {
  const year = Number(digits);
  if (digits.length > 2) return year;
  const now = Temporal.Now.plainDateISO().year;
  const near = now - (now % 100) + year;
  return near > now + 50 ? near - 100 : near <= now - 50 ? near + 100 : near;
}

type Token = { number: string } | { word: Word };

/** The numbers and known words in the text, or null when a word is not a date's. */
function scan(text: string, { words, longest }: LocaleText): Token[] | null {
  const tokens: Token[] = [];
  let index = 0;
  while (index < text.length) {
    const rest = text.slice(index);
    const number = /^\d+/.exec(rest);
    if (number) {
      tokens.push({ number: number[0] });
      index += number[0].length;
      continue;
    }
    if (rest[0] === ' ') {
      index++;
      continue;
    }
    // The longest word that starts here, so "marzo" wins over "mar".
    let length = Math.min(longest, rest.length);
    while (length > 0 && !words.has(rest.slice(0, length).trimEnd())) length--;
    if (length === 0) return null;
    tokens.push({ word: words.get(rest.slice(0, length).trimEnd())! });
    index += length;
  }
  return tokens;
}

/**
 * The date in typed text, or `null` when the text is not one. It reads the
 * numbers in `locale`'s order, so `10/13/2026` in en-US and `13.10.2026` in de,
 * with any separators and in any script's digits. Text that starts with a
 * year of four or more digits, such as `2026-10-13`, is read as year, month
 * and day unless the locale writes the year first in another order. A month
 * may be a name the locale or English uses in a date, such as `13 Oct 2026`
 * or `13 de octubre de 2026`, and the locale's other date words, such as
 * weekdays, are skipped. A year of one or two digits is the nearest such year
 * to this one; a year of three digits is not read.
 */
export function parseDate(text: string, options: DateTextOptions = {}): Temporal.PlainDate | null {
  const locale = localeText(options.locale);
  const tokens = scan(normalize(text), locale);
  if (!tokens) return null;
  const numbers = tokens.flatMap((token) => ('number' in token ? [token.number] : []));
  const named = tokens.flatMap((token) => ('word' in token && token.word.month !== undefined ? [token.word] : []));
  const { order } = locale;
  let parts: Partial<Record<Part, string>>;
  if (numbers.length === 3) {
    // A month name beside three numbers is a weekday that shares its name, as "mar" does in Spanish.
    if (named.some((word) => !word.skip)) return null;
    const fields: Part[] = order[0] !== 'year' && numbers[0]!.length > 3 ? ['year', 'month', 'day'] : order;
    parts = Object.fromEntries(fields.map((part, index) => [part, numbers[index]]));
  } else if (numbers.length === 2) {
    // The month is the one word that is only a month, else the last that can be one.
    const only = named.filter((word) => !word.skip);
    if (only.length > 1) return null;
    const month = only[0]?.month ?? named.at(-1)?.month;
    if (month === undefined) return null;
    const yearIndex =
      numbers[0]!.length > 3 ? 0 : numbers[1]!.length > 3 ? 1 : order.indexOf('year') < order.indexOf('day') ? 0 : 1;
    parts = { year: numbers[yearIndex], day: numbers[1 - yearIndex], month: String(month) };
  } else {
    return null;
  }
  const { year, month, day } = parts as Record<Part, string>;
  // A three-digit year is one still being typed; a day or month has at most two digits.
  if (year.length === 3 || month.length > 2 || day.length > 2) return null;
  try {
    return Temporal.PlainDate.from(
      { year: fullYear(year), month: Number(month), day: Number(day) },
      { overflow: 'reject' },
    );
  } catch (error) {
    // A day the month does not have, or a year past Temporal's range.
    if (error instanceof RangeError) return null;
    throw error;
  }
}
