import { describe, expect, it } from 'vitest';
import { formatDateRange, parseDateRange, type DateRange } from './dateRangeText.js';

const date = (text: string) => Temporal.PlainDate.from(text);
const range = (start: string, end: string): DateRange => ({ start: date(start), end: date(end) });
const read = (text: string, locale?: string) => {
  const found = parseDateRange(text, { locale });
  return found ? `${found.start}/${found.end}` : null;
};

const LOCALES = ['en-US', 'en-GB', 'de', 'fr', 'es', 'ko', 'ja', 'zh', 'hu', 'fi', 'he', 'ar', 'th', 'vi', 'gsw'];

describe('formatDateRange', () => {
  it("writes both dates as formatDate does, with the locale's range separator", () => {
    const stay = range('2026-10-03', '2026-10-10');
    // Intl puts thin spaces around the dash.
    expect(formatDateRange(stay, { locale: 'en-US' })).toBe('10/3/2026\u2009–\u200910/10/2026');
    expect(formatDateRange(stay, { locale: 'de' })).toBe('3.10.2026\u2009–\u200910.10.2026');
    expect(formatDateRange(stay, { locale: 'ko' })).toBe('2026. 10. 3. ~ 2026. 10. 10.');
    expect(formatDateRange(stay, { locale: 'ja' })).toBe('2026/10/3～2026/10/10');
    expect(formatDateRange(stay, { locale: 'fr' })).toBe('03/10/2026\u2009–\u200910/10/2026');
  });

  it('writes the date-ending period of ko and hu once, before the separator', () => {
    const stay = range('2026-10-03', '2026-10-10');
    expect(formatDateRange(stay, { locale: 'ko' })).toBe('2026. 10. 3. ~ 2026. 10. 10.');
    expect(formatDateRange(stay, { locale: 'hu' })).toBe('2026. 10. 03.\u2009–\u20092026. 10. 10.');
  });

  it('writes both dates of a one-day range', () => {
    expect(formatDateRange(range('2026-10-03', '2026-10-03'), { locale: 'en-US' })).toBe('10/3/2026\u2009–\u200910/3/2026');
  });

  it('writes the earlier date first when the end comes before the start', () => {
    expect(formatDateRange(range('2026-10-10', '2026-10-03'), { locale: 'en-US' })).toBe('10/3/2026\u2009–\u200910/10/2026');
  });

  it('writes a range in another calendar as the same days in the Gregorian calendar', () => {
    const japanese = { start: date('2026-10-03').withCalendar('japanese'), end: date('2026-10-10').withCalendar('japanese') };
    expect(formatDateRange(japanese, { locale: 'ja' })).toBe('2026/10/3～2026/10/10');
  });
});

describe('parseDateRange', () => {
  it('reads what formatDateRange writes', () => {
    for (const locale of LOCALES) {
      for (const [start, end] of [
        ['2026-10-03', '2026-10-10'],
        ['2025-12-30', '2026-01-13'],
        ['2026-10-13', '2026-10-13'],
      ] as const) {
        const text = formatDateRange(range(start, end), { locale });
        expect({ locale, text, read: read(text, locale) }).toEqual({ locale, text, read: `${start}/${end}` });
      }
    }
  });

  it.each([
    ['en-US', '10/3/2026 - 10/10/2026'],
    ['en-US', '10/3/2026–10/10/2026'],
    ['en-US', 'Oct 3, 2026 – Oct 10, 2026'],
    ['de', '3.10.2026 - 10.10.2026'],
    ['de', '3. Oktober 2026 – 10. Oktober 2026'],
    ['ko', '2026. 10. 3 ~ 2026. 10. 10'],
    ['ko', '2026년 10월 3일 ~ 2026년 10월 10일'],
    ['ja', '2026/10/3 ～ 2026/10/10'],
    ['ja', '2026年10月3日～2026年10月10日'],
    ['fr', '03/10/2026 - 10/10/2026'],
    ['fr', '3 oct. 2026 – 10 oct. 2026'],
  ])('reads a range typed in %s: %s', (locale, text) => {
    expect(read(text, locale)).toBe('2026-10-03/2026-10-10');
  });

  it.each(['en-US', 'de', 'ko', 'ja', 'fr'])('reads ISO dates with a dash or as an ISO 8601 interval in %s', (locale) => {
    expect(read('2026-10-03 – 2026-10-10', locale)).toBe('2026-10-03/2026-10-10');
    expect(read('2026-10-03/2026-10-10', locale)).toBe('2026-10-03/2026-10-10');
  });

  it('reads a range typed end first with the earlier date as its start', () => {
    expect(read('10/10/2026 – 10/3/2026', 'en-US')).toBe('2026-10-03/2026-10-10');
    expect(read('2026-10-10/2026-10-03', 'en-US')).toBe('2026-10-03/2026-10-10');
    expect(read('2026. 10. 10. ~ 2026. 10. 3.', 'ko')).toBe('2026-10-03/2026-10-10');
  });

  it('returns null for text that is not two dates', () => {
    expect(read('10/3/2026', 'en-US')).toBeNull();
    expect(read('', 'en-US')).toBeNull();
    expect(read('10/3/2026 – soon', 'en-US')).toBeNull();
    expect(read('10/3 – 10/10/2026', 'en-US')).toBeNull();
  });

  it('returns null for a range that writes its year once', () => {
    expect(read('Oct 3 – Oct 10, 2026', 'en-US')).toBeNull();
    expect(read('Oct 3, 2026 – Oct 10, 2026', 'en-US')).toBe('2026-10-03/2026-10-10');
  });
});
