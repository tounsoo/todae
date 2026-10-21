/// <reference lib="esnext.temporal" preserve="true" />
// Server-safe range text for a text input beside Field.DateRangePicker: no hooks or context.
import { formatDate, parseDate, type DateTextOptions } from './dateText.js';

/** A span of days, start and end included. start is never after end. */
export type DateRange = { start: Temporal.PlainDate; end: Temporal.PlainDate };

export type DateRangeTextOptions = DateTextOptions;

const NUMERIC = { year: 'numeric', month: 'numeric', day: 'numeric', calendar: 'gregory', timeZone: 'UTC' } as const;

const separators = /* @__PURE__ */ new Map<string, string>();

/**
 * What the locale writes between the two dates of a range, such as ` – ` in
 * en-US and ` ~ ` in ko, read from a range over two years so no part of the
 * dates is shared.
 */
function separatorFor(locale: string | undefined): string {
  const key = locale ?? '';
  const cached = separators.get(key);
  if (cached !== undefined) return cached;
  const format = new Intl.DateTimeFormat(locale, NUMERIC);
  const start = new Date(Date.UTC(2025, 9, 3, 12));
  const end = new Date(Date.UTC(2026, 9, 10, 12));
  const parts = format.formatRangeToParts(start, end);
  const lastStart = parts.map((part) => part.source).lastIndexOf('startRange');
  const firstEnd = parts.findIndex((part) => part.source === 'endRange');
  let separator = parts
    .slice(lastStart + 1, firstEnd)
    .map((part) => part.value)
    .join('');
  // ko and hu end a date with a period, which the range puts in its shared
  // middle; formatDate already wrote it.
  const trail = /[^\p{L}\p{N}\s]*$/u.exec(format.format(start))![0];
  if (trail && separator.startsWith(trail)) separator = separator.slice(trail.length);
  const lead = /^[^\p{L}\p{N}\s]*/u.exec(format.format(end))![0];
  if (lead && separator.endsWith(lead)) separator = separator.slice(0, -lead.length);
  if (lastStart < 0 || firstEnd < 0 || !separator.trim()) separator = ' – ';
  separators.set(key, separator);
  return separator;
}

/**
 * The range as `locale` writes it, both dates as `formatDate` writes them with
 * the locale's range separator between, such as `10/3/2026 – 10/10/2026` in
 * en-US and `2026. 10. 3. ~ 2026. 10. 10.` in ko.
 */
export function formatDateRange(range: DateRange, options: DateRangeTextOptions = {}): string {
  return `${formatDate(range.start, options)}${separatorFor(options.locale)}${formatDate(range.end, options)}`;
}

/**
 * The range in typed text, or `null` when the text is not one. It splits the
 * text at each run of characters that are not letters or digits, and at the
 * locale's range separator and each of its words, and reads a date on both
 * sides with `parseDate`. It returns the range when exactly one split reads
 * as two dates, and `null` when none or more than one does, or when the end
 * is before the start. Each date needs its year, as `formatDateRange` writes
 * them, so `Oct 3 – Oct 10, 2026` returns `null`.
 */
export function parseDateRange(text: string, options: DateRangeTextOptions = {}): DateRange | null {
  const cuts: [number, number][] = [];
  for (const match of text.matchAll(/[^\p{L}\p{M}\p{N}]+/gu)) cuts.push([match.index, match.index + match[0].length]);
  const separator = separatorFor(options.locale).trim();
  const words = separator.split(/\s+/).filter(Boolean);
  for (const mark of new Set([separator, ...words])) {
    for (let at = text.indexOf(mark); at >= 0; at = text.indexOf(mark, at + 1)) cuts.push([at, at + mark.length]);
  }
  const found = new Map<string, DateRange>();
  for (const [from, to] of cuts) {
    const start = parseDate(text.slice(0, from), options);
    const end = start && parseDate(text.slice(to), options);
    if (!start || !end) continue;
    found.set(`${start}/${end}`, { start, end });
    if (found.size > 1) return null;
  }
  const range = found.size === 1 ? found.values().next().value! : null;
  return range && Temporal.PlainDate.compare(range.start, range.end) <= 0 ? range : null;
}
