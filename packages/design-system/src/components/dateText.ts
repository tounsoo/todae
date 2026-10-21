/// <reference lib="esnext.temporal" preserve="true" />
// Server-safe date text for a text input beside Field.DatePicker: no hooks or context.
import { fold } from './foldText.js';

export type DateTextOptions = {
  /** The locale, such as "ko". The runtime's own when not set. */
  locale?: string;
};

type Part = 'year' | 'month' | 'day';
type Slot = Part | 'weekday';

// Dates are shown in the Gregorian calendar whatever the locale's own, as Calendar does.
const GREGORY = { calendar: 'gregory', timeZone: 'UTC' } as const;
const NUMERIC = { year: 'numeric', month: 'numeric', day: 'numeric', calendar: 'gregory', timeZone: 'UTC' } as const;

/**
 * The date as `locale` writes it in numbers, such as `10/13/2026` in en-US,
 * `13.10.2026` in de and `2026. 10. 13.` in ko. A date in another calendar is
 * written as the same day in the Gregorian calendar.
 */
export function formatDate(date: Temporal.PlainDate, options: DateTextOptions = {}): string {
  return date.withCalendar('iso8601').toLocaleString(options.locale, NUMERIC);
}

/**
 * Text as dates are compared: compatibility forms folded (full-width digits
 * become ASCII), case folded, accents that Greek capitals drop removed, every
 * script's digits as ASCII, and each run of anything but letters and digits
 * as one space.
 */
export function normalize(text: string) {
  return fold(text)
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A name's words, with the spaces between them optional.
const words = (name: string) => name.split(' ').filter(Boolean).map(escape).join(' ?');
// Any of the names, longest first so a longer name wins.
const anyOf = (names: Iterable<string>) =>
  `(?:${[...names].sort((a, b) => b.length - a.length).map(words).join('|')})`;
const NUMBER = '(?<!\\d)(\\d+)(?!\\d)';

// The styles typed text may follow, and the styles that name months and weekdays.
const TEMPLATE_STYLES: Intl.DateTimeFormatOptions[] = [
  { dateStyle: 'medium' },
  { dateStyle: 'long' },
  { dateStyle: 'full' },
];
// The locale's styles for a month and day without a year.
const MONTH_DAY_STYLES: Intl.DateTimeFormatOptions[] = [
  { month: 'short', day: 'numeric' },
  { month: 'long', day: 'numeric' },
  { weekday: 'short', month: 'short', day: 'numeric' },
  { weekday: 'long', month: 'long', day: 'numeric' },
  { weekday: 'long', month: 'short', day: 'numeric' },
];
const NAME_STYLES: Intl.DateTimeFormatOptions[] = /* @__PURE__ */ TEMPLATE_STYLES.concat([
  { day: 'numeric', month: 'short', year: 'numeric' },
  { day: 'numeric', month: 'long', year: 'numeric' },
  { month: 'long' },
  { month: 'short' },
  { weekday: 'long' },
  { weekday: 'short' },
]);

/**
 * The date styles as patterns for each month, or, with `noYear`, the same
 * patterns without the year.
 */
function templatesFor(
  locale: string | undefined,
  styles: Intl.DateTimeFormatOptions[],
  monthNames: Set<string>[],
  anyWeekday: string,
  noYear: boolean,
) {
  const templates: Template[] = [];
  const seen = new Set<string>();
  for (const style of styles) {
    const format = new Intl.DateTimeFormat(locale, { ...style, ...GREGORY });
    for (let month = 1; month <= 12; month++) {
      const pieces: string[] = [];
      const slots: Slot[] = [];
      let named = false;
      for (const part of format.formatToParts(sample(month, 13))) {
        const value = normalize(part.value);
        if (part.type === 'year' && noYear) continue;
        if (part.type === 'year' || part.type === 'day') {
          pieces.push(NUMBER);
          slots.push(part.type);
        } else if (part.type === 'month' && !/\d/.test(value)) {
          // Any of this month's names, so a name that is also a weekday's cannot be read as another month.
          pieces.push(anyOf(monthNames[month]!));
          named = true;
        } else if (part.type === 'weekday') {
          pieces.push(`(${anyWeekday})?`);
          slots.push('weekday');
        } else {
          // A literal, an era, or a month written with its number, such as "tháng 10":
          // its words may be left out, and its number is the month.
          for (const bit of value.split(/(\d+)/)) {
            if (/^\d+$/.test(bit)) {
              pieces.push(NUMBER);
              slots.push('month');
            } else {
              for (const word of bit.split(' ').filter(Boolean)) pieces.push(`(?:${escape(word)})?`);
            }
          }
        }
      }
      const source = `^${pieces.join(' ?')}$`;
      const id = `${source}|${slots.join()}|${named ? month : ''}`;
      if (seen.has(id)) continue;
      seen.add(id);
      templates.push({ regex: new RegExp(source, 'u'), slots, month: named ? month : undefined });
    }
  }
  return templates;
}

/** A date style for one month, as a pattern over normalized text. */
type Template = { regex: RegExp; slots: Slot[]; month?: number };

type LocaleText = {
  /** The order `formatDate` writes the year, month and day in. */
  order: Part[];
  /**
   * The order the locale's short date style writes them in, when not `order`,
   * such as day first in "13.10.26" in gsw, whose `formatDate` writes "2026-10-13".
   */
  shortOrder: Part[] | null;
  /** The order a year of one or two digits is read in first: the short style's when it writes one, else `order`. */
  shortYearOrder: Part[];
  templates: Template[];
  /** The orders the locale writes a month and a day in numbers, without a year. */
  monthDayOrders: Part[][];
  /** The date styles, and the locale's styles without a year, with no year. */
  monthDayTemplates: Template[];
  /** ISO weekdays (1 is Monday) by name, without spaces. */
  weekdays: Map<string, number[]>;
};

const localeTexts = /* @__PURE__ */ new Map<string, LocaleText>();

const sample = (month: number, day: number) => new Date(Date.UTC(2026, month - 1, day, 12));

function localeText(locale: string | undefined): LocaleText {
  const key = locale ?? '';
  const cached = localeTexts.get(key);
  if (cached) return cached;

  // Month names by month, and weekday names by ISO weekday.
  const monthNames = Array.from({ length: 13 }, () => new Set<string>());
  const weekdayNames = Array.from({ length: 8 }, () => new Set<string>());
  for (const style of NAME_STYLES) {
    const format = new Intl.DateTimeFormat(locale, { ...style, ...GREGORY });
    for (let month = 1; month <= 12; month++) {
      for (const part of format.formatToParts(sample(month, 13))) {
        if (part.type === 'month' && !/\p{Nd}/u.test(part.value)) monthNames[month]!.add(normalize(part.value));
      }
    }
    // 2026-10-12 is a Monday.
    for (let weekday = 1; weekday <= 7; weekday++) {
      for (const part of format.formatToParts(sample(10, 11 + weekday))) {
        if (part.type === 'weekday') weekdayNames[weekday]!.add(normalize(part.value));
      }
    }
  }
  for (const names of [...monthNames, ...weekdayNames]) names.delete('');
  const weekdays = new Map<string, number[]>();
  weekdayNames.forEach((names, weekday) => {
    for (const name of names) {
      const bare = name.replace(/ /g, '');
      weekdays.set(bare, [...(weekdays.get(bare) ?? []), weekday]);
    }
  });
  const anyWeekday = anyOf(weekdayNames.flatMap((names) => [...names]));

  const templates = templatesFor(locale, TEMPLATE_STYLES, monthNames, anyWeekday, false);
  const monthDayTemplates = templatesFor(locale, [...TEMPLATE_STYLES, ...MONTH_DAY_STYLES], monthNames, anyWeekday, true);

  const partsOf = (style: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...style, ...GREGORY })
      .formatToParts(sample(10, 13))
      .filter((part): part is Intl.DateTimeFormatPart & { type: Part } => ['year', 'month', 'day'].includes(part.type));
  const order = partsOf(NUMERIC).map((part) => part.type);
  const short = partsOf({ dateStyle: 'short' });
  const shortTypes = short.map((part) => part.type);
  const shortOrder = shortTypes.join() === order.join() ? null : shortTypes;
  // Its digits counted as digits, not code units, as a digit of adlm is two.
  const shortYear = short.some((part) => part.type === 'year' && normalize(part.value).length <= 2);
  const shortYearOrder = shortOrder && shortYear ? shortOrder : order;
  const monthDayOrders = [
    order.filter((part) => part !== 'year'),
    new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric', ...GREGORY })
      .formatToParts(sample(10, 13))
      .map((part) => part.type)
      .filter((type): type is Part => type === 'month' || type === 'day'),
  ];
  const text = { order, shortOrder, shortYearOrder, templates, weekdays, monthDayOrders, monthDayTemplates };
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

type Fields = Partial<Record<Slot, string>>;

function toDate({ year, month, day, weekday }: Fields, weekdays: LocaleText['weekdays']) {
  // A three-digit year is one still being typed; a day or month has at most two digits.
  if (!year || !month || !day || year.length === 3 || month.length > 2 || day.length > 2) return null;
  let date: Temporal.PlainDate;
  try {
    date = Temporal.PlainDate.from(
      { year: fullYear(year), month: Number(month), day: Number(day) },
      { overflow: 'reject' },
    );
  } catch (error) {
    // A day the month does not have, or a year past Temporal's range.
    if (error instanceof RangeError) return null;
    throw error;
  }
  // A weekday must be the date's.
  if (weekday !== undefined && !weekdays.get(weekday.replace(/ /g, ''))?.includes(date.dayOfWeek)) return null;
  return date;
}

/**
 * The date in typed text, or `null` when the text is not one. It reads a date
 * in numbers in the order `formatDate` writes them, or in the order of the
 * locale's short date style, as `13.10.26` in gsw, whose `formatDate` writes
 * `2026-10-13`. When both orders read a date, a year of four or more digits
 * is read in `formatDate`'s order, and a year of one or two digits in the
 * short style's order when that style writes the year in two digits. It also
 * reads a date as `Intl.DateTimeFormat` writes it in the locale's medium, long
 * or full date style. Letter case does not matter, digits may be in any
 * script, and the parts may be separated by any punctuation, symbols or
 * spaces. The month may be any of its long or short names. A weekday may be
 * long, short or left out, but must be the date's. The style's other words
 * may be replaced by a space. Three numbers that start with a year of four or
 * more digits are read as year, month and day, unless the locale writes the
 * year first in another order. A year of one or two digits is the nearest
 * such year to this one; a year of three digits is not read.
 */
export function parseDate(text: string, options: DateTextOptions = {}): Temporal.PlainDate | null {
  return readDate(text, options)?.date ?? null;
}

/** The date `parseDate` reads in typed text, and the number it read as the year, as typed. */
export function readDate(text: string, options: DateTextOptions = {}): { date: Temporal.PlainDate; year: string } | null {
  const { order, shortOrder, shortYearOrder, templates, weekdays } = localeText(options.locale);
  const input = normalize(text);
  if (!/\p{L}/u.test(input)) {
    const numbers = /^(\d+) (\d+) (\d+)$/.exec(input);
    if (!numbers) return null;
    const readIn = (parts: Part[]) => {
      const fields: Fields = Object.fromEntries(parts.map((part, index) => [part, numbers[index + 1]]));
      const date = toDate(fields, weekdays);
      return date && { date, year: fields.year!, parts };
    };
    const readings = [readIn(order), shortOrder && readIn(shortOrder)].filter((reading) => reading !== null);
    // Two readings have years of the same length, as a day or month has at most two digits:
    // a year in full in formatDate's order, and one of one or two digits in shortYearOrder.
    const reading = readings.find((one) => one.parts === (one.year.length > 2 ? order : shortYearOrder)) ?? readings[0];
    if (reading) return { date: reading.date, year: reading.year };
    if (order[0] === 'year' || numbers[1]!.length < 4) return null;
    const date = toDate({ year: numbers[1], month: numbers[2], day: numbers[3] }, weekdays);
    return date && { date, year: numbers[1]! };
  }
  // Text with words follows one of the locale's date styles, and must read as one date.
  const found = new Map<string, { date: Temporal.PlainDate; year: string }>();
  for (const template of templates) {
    const match = template.regex.exec(input);
    if (!match) continue;
    const fields: Fields = {};
    template.slots.forEach((slot, index) => {
      fields[slot] = match[index + 1];
    });
    if (template.month !== undefined) fields.month = String(template.month);
    const date = toDate(fields, weekdays);
    if (date && !found.has(date.toString())) found.set(date.toString(), { date, year: fields.year! });
    if (found.size > 1) return null;
  }
  return found.size === 1 ? found.values().next().value! : null;
}

/**
 * Whether typed text is a month and a day without a year, as the locale
 * writes one in numbers, or in one of its date styles with the year left out
 * or its styles without a year, with any of the month's names and any
 * weekday. Text `parseDate` reads with a two-digit year may also be one, as
 * "10/13 12" is October 13 and the 12 of a time.
 */
export function isMonthDay(text: string, options: DateTextOptions = {}): boolean {
  const { monthDayOrders, monthDayTemplates } = localeText(options.locale);
  const input = normalize(text);
  // February 29 too.
  const valid = (month: number, day: number) =>
    month >= 1 && month <= 12 && day >= 1 && day <= new Temporal.PlainYearMonth(2000, month).daysInMonth;
  if (!/\p{L}/u.test(input)) {
    const numbers = /^(\d{1,2}) (\d{1,2})$/.exec(input);
    return (
      numbers !== null &&
      monthDayOrders.some((order) => {
        const month = Number(numbers[order.indexOf('month') + 1]);
        return valid(month, Number(numbers[order.indexOf('day') + 1]));
      })
    );
  }
  return monthDayTemplates.some((template) => {
    const match = template.regex.exec(input);
    if (!match) return false;
    const fields: Fields = {};
    template.slots.forEach((slot, index) => {
      fields[slot] = match[index + 1];
    });
    const month = template.month ?? Number(fields.month);
    return fields.day !== undefined && fields.day.length <= 2 && valid(month, Number(fields.day));
  });
}
