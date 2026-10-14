import { describe, expect, it } from 'vitest';
import { formatDate, parseDate } from './dateText';

const date = (text: string) => Temporal.PlainDate.from(text);
const read = (text: string, locale?: string) => parseDate(text, { locale })?.toString() ?? null;

describe('formatDate', () => {
  it('writes the date in numbers in the locale’s order', () => {
    expect(formatDate(date('2026-10-13'), { locale: 'en-US' })).toBe('10/13/2026');
    expect(formatDate(date('2026-10-13'), { locale: 'de' })).toBe('13.10.2026');
    expect(formatDate(date('2026-10-13'), { locale: 'ko' })).toBe('2026. 10. 13.');
    expect(formatDate(date('2026-10-13'), { locale: 'en-GB' })).toBe('13/10/2026');
  });

  it('writes a date in another calendar as its ISO date, in the Gregorian calendar', () => {
    expect(formatDate(date('2026-10-13').withCalendar('hebrew'), { locale: 'en-US' })).toBe('10/13/2026');
    expect(formatDate(date('2026-10-13'), { locale: 'th' })).toBe('13/10/2026');
  });
});

describe('parseDate', () => {
  it('reads numbers in the locale’s order, with any separators', () => {
    expect(read('10/13/2026', 'en-US')).toBe('2026-10-13');
    expect(read('10-13-2026', 'en-US')).toBe('2026-10-13');
    expect(read(' 10 13 2026 ', 'en-US')).toBe('2026-10-13');
    expect(read('13.10.2026', 'de')).toBe('2026-10-13');
    expect(read('13/10/2026', 'en-GB')).toBe('2026-10-13');
    expect(read('2026. 10. 13.', 'ko')).toBe('2026-10-13');
  });

  it('reads every date it writes, in any locale', () => {
    for (const locale of ['en-US', 'en-GB', 'de', 'fr', 'ko', 'ja', 'zh', 'ar-EG', 'fa', 'hi-IN-u-nu-deva', 'th', 'he']) {
      expect(read(formatDate(date('2026-10-13'), { locale }), locale), locale).toBe('2026-10-13');
    }
  });

  it('reads a year written first as year, month and day, as ISO does', () => {
    expect(read('2026-10-13', 'en-US')).toBe('2026-10-13');
    expect(read('2026/10/13', 'de')).toBe('2026-10-13');
    expect(read('2026年10月13日', 'ja')).toBe('2026-10-13');
    expect(read('2026년 10월 13일', 'ko')).toBe('2026-10-13');
  });

  it('reads month names in the locale and in English, and skips weekdays', () => {
    expect(read('Oct 13, 2026', 'en-US')).toBe('2026-10-13');
    expect(read('Tuesday, October 13, 2026', 'en-US')).toBe('2026-10-13');
    expect(read('13 octobre 2026', 'fr')).toBe('2026-10-13');
    expect(read('13 oct. 2026', 'fr')).toBe('2026-10-13');
    expect(read('13 Oct 2026', 'de')).toBe('2026-10-13');
    expect(read('13. Oktober 2026', 'de')).toBe('2026-10-13');
    expect(read('2026 October 13', 'en-US')).toBe('2026-10-13');
  });

  it('takes a one- or two-digit year as the nearest such year', () => {
    const now = Temporal.Now.plainDateISO().year;
    expect(parseDate('1/2/26', { locale: 'en-US' })!.year % 100).toBe(26);
    expect(Math.abs(parseDate('1/2/26', { locale: 'en-US' })!.year - now)).toBeLessThanOrEqual(50);
    expect(Math.abs(parseDate('1/2/5', { locale: 'en-US' })!.year - now)).toBeLessThanOrEqual(50);
  });

  it('returns null for text that is not a date', () => {
    expect(read('', 'en-US')).toBeNull();
    expect(read('2/30/2026', 'en-US')).toBeNull();
    expect(read('13/13/2026', 'en-US')).toBeNull();
    expect(read('10/13', 'en-US')).toBeNull();
    expect(read('10/13/2026/1', 'en-US')).toBeNull();
    expect(read('soon', 'en-US')).toBeNull();
    expect(read('next 10/13/2026', 'en-US')).toBeNull();
    expect(read('Oct Nov 2026', 'en-US')).toBeNull();
    expect(read('Oct 13', 'en-US')).toBeNull();
    expect(read('1/1/999999', 'en-US')).toBeNull();
  });
});
