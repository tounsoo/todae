/// <reference lib="esnext.temporal" preserve="true" />
// Server-safe date text for a text input beside Field.DatePicker: no hooks or context.

export type DateTextOptions = {
  /** The locale, such as "ko". The runtime's own when not set. */
  locale?: string;
};

type Part = 'year' | 'month' | 'day';

// Dates are shown in the Gregorian calendar whatever the locale's own, as Calendar does.
const NUMERIC = { year: 'numeric', month: 'numeric', day: 'numeric', calendar: 'gregory' } as const;

/**
 * The date as `locale` writes it in numbers, such as `10/13/2026` in en-US,
 * `13.10.2026` in de and `2026. 10. 13.` in ko. A date in another calendar is
 * written as its ISO date.
 */
export function formatDate(date: Temporal.PlainDate, options: DateTextOptions = {}): string {
  return date.withCalendar('iso8601').toLocaleString(options.locale, NUMERIC);
}

type LocaleText = {
  /** The order `locale` writes the year, month and day in. */
  order: Part[];
  /** The locale's digits, 0 to 9, when they are not ASCII. */
  digits: string[];
  /** Month (1–12) by lower-case long or short name, in the locale and in English. */
  months: Map<string, number>;
  /** Lower-case weekday names, which a date may carry and parsing skips. */
  weekdays: Set<string>;
};

const localeTexts = new Map<string, LocaleText>();

// Names compare in lower case, without dots, so "Oct." and "oct" match.
const nameKey = (text: string, locale: string | undefined) =>
  text.normalize('NFC').toLocaleLowerCase(locale).replace(/\./g, '');

function localeText(locale: string | undefined): LocaleText {
  const key = locale ?? '';
  let text = localeTexts.get(key);
  if (text) return text;
  const order = new Intl.DateTimeFormat(locale, NUMERIC)
    .formatToParts(new Date(Date.UTC(2026, 9, 13, 12)))
    .map((part) => part.type)
    .filter((type): type is Part => type === 'year' || type === 'month' || type === 'day');
  const numbers = new Intl.NumberFormat(locale, { useGrouping: false });
  const digits = Array.from({ length: 10 }, (_, digit) => numbers.format(digit));
  const months = new Map<string, number>();
  const weekdays = new Set<string>();
  for (const names of new Set([locale, 'en'])) {
    for (const month of ['long', 'short'] as const) {
      const format = new Intl.DateTimeFormat(names, { month, calendar: 'gregory', timeZone: 'UTC' });
      for (let index = 0; index < 12; index++) {
        const name = nameKey(format.format(new Date(Date.UTC(2026, index, 15))), names);
        if (!months.has(name)) months.set(name, index + 1);
      }
    }
    for (const weekday of ['long', 'short'] as const) {
      const format = new Intl.DateTimeFormat(names, { weekday, timeZone: 'UTC' });
      // 2026-10-11 is a Sunday.
      for (let index = 0; index < 7; index++) {
        weekdays.add(nameKey(format.format(new Date(Date.UTC(2026, 9, 11 + index))), names));
      }
    }
  }
  text = { order, digits: digits.join('') === '0123456789' ? [] : digits, months, weekdays };
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

/**
 * The date in typed text, or `null` when the text is not one. It reads the
 * numbers in `locale`'s order, so `10/13/2026` in en-US and `13.10.2026` in de,
 * with any separators, and `2026. 10. 13.`, `2026-10-13` or `2026年10月13日`
 * with the year first. A month may be a name in the locale or in English, such
 * as `13 Oct 2026` or `octobre 13 2026`, and a weekday name is skipped. A year
 * of one or two digits is the nearest such year to this one.
 */
export function parseDate(text: string, options: DateTextOptions = {}): Temporal.PlainDate | null {
  const { locale } = options;
  const { order, digits, months, weekdays } = localeText(locale);
  let ascii = text;
  digits.forEach((digit, value) => {
    ascii = ascii.replaceAll(digit, String(value));
  });
  const numbers: string[] = [];
  let month: number | undefined;
  for (const [token] of ascii.matchAll(/\d+|[\p{L}\p{M}.]+/gu)) {
    if (/^\d/.test(token)) {
      numbers.push(token);
      continue;
    }
    const name = nameKey(token, locale);
    if (name === '' || weekdays.has(name)) continue;
    const named = months.get(name);
    if (named === undefined || month !== undefined) {
      // Units such as 년, 月 or 日 follow a number; any other word is not a date.
      if (numbers.length > 0 && name.length === 1) continue;
      return null;
    }
    month = named;
  }
  let parts: Partial<Record<Part, string>>;
  if (month === undefined) {
    if (numbers.length !== 3) return null;
    // A year written first, as in ISO, is always followed by the month and day.
    const fields: Part[] = numbers[0]!.length > 2 ? ['year', 'month', 'day'] : order;
    parts = Object.fromEntries(fields.map((part, index) => [part, numbers[index]]));
  } else {
    if (numbers.length !== 2) return null;
    // The year is the number with more than two digits, or else the locale's order says.
    const yearIndex =
      numbers[0]!.length > 2 ? 0 : numbers[1]!.length > 2 ? 1 : order.indexOf('year') < order.indexOf('day') ? 0 : 1;
    parts = { year: numbers[yearIndex], day: numbers[1 - yearIndex], month: String(month) };
  }
  try {
    return Temporal.PlainDate.from(
      { year: fullYear(parts.year!), month: Number(parts.month), day: Number(parts.day) },
      { overflow: 'reject' },
    );
  } catch (error) {
    // A day the month does not have, or a year past Temporal's range.
    if (error instanceof RangeError) return null;
    throw error;
  }
}
