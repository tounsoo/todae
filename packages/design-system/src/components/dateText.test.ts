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

  const LOCALES = [
    'en-US', 'en-GB', 'de', 'fr', 'es', 'it', 'pt', 'ro', 'sq', 'cy', 'tr', 'pl', 'ru', 'uk', 'cs', 'fi', 'hr', 'lt',
    'ko', 'ja', 'zh', 'vi', 'th', 'he', 'ar', 'ar-EG', 'fa', 'hi', 'hi-IN-u-nu-deva', 'ky', 'ug',
  ];
  const DATES = ['2026-01-02', '2026-03-10', '2026-05-31', '2026-10-13', '2026-12-31'].map(date);

  it('reads the numbers it writes, in each locale', () => {
    for (const locale of LOCALES) {
      for (const day of DATES) {
        expect(read(formatDate(day, { locale }), locale), `${locale} ${day}`).toBe(day.toString());
      }
    }
  });

  it('reads the dates the locale writes with month and weekday names, in every month', () => {
    for (const locale of LOCALES) {
      for (const dateStyle of ['medium', 'long', 'full'] as const) {
        for (let month = 1; month <= 12; month++) {
          const day = Temporal.PlainDate.from({ year: 2026, month, day: 13 });
          const text = day.toLocaleString(locale, { dateStyle, calendar: 'gregory' });
          expect(read(text, locale), `${locale} ${dateStyle} ${text}`).toBe(day.toString());
        }
      }
    }
  });

  it('reads digits of any script, and full-width digits', () => {
    expect(read('２０２６/１０/１３', 'ja')).toBe('2026-10-13');
    expect(read('２０２６年１０月１３日', 'zh')).toBe('2026-10-13');
    expect(read('١٣/١٠/٢٠٢٦', 'ar')).toBe('2026-10-13');
    expect(read('१३/१०/२०२६', 'hi')).toBe('2026-10-13');
    expect(read('๑๓/๑๐/๒๐๒๖', 'th')).toBe('2026-10-13');
    expect(read('٢٠٢٦/١٠/١٣', 'fa')).toBe('2026-10-13');
  });

  it('reads the year first in the locale’s own order where the locale writes it first', () => {
    expect(read(formatDate(date('2026-01-02'), { locale: 'ky' }), 'ky')).toBe('2026-01-02');
    expect(read('2026-13-10', 'ky')).toBe('2026-10-13');
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
    expect(read('13 de octubre de 2026', 'es')).toBe('2026-10-13');
    expect(read('13 октября 2026', 'ru')).toBe('2026-10-13');
    expect(read('13 באוקטובר 2026', 'he')).toBe('2026-10-13');
    expect(read('13 אוק 2026', 'he')).toBe('2026-10-13');
    expect(read('13 अक्टू 2026', 'hi')).toBe('2026-10-13');
    expect(read('terça-feira, 13 de outubro de 2026', 'pt')).toBe('2026-10-13');
    expect(read('2026年10月13日火曜日', 'ja')).toBe('2026-10-13');
    expect(read('APRIL 13 2026', 'tr')).toBe('2026-04-13');
  });

  it('reads a short month that shares its name with a weekday as the month, unless another month is named', () => {
    expect(read('13 mar 2026', 'es')).toBe('2026-03-13');
    expect(read('13 mar 2026', 'it')).toBe('2026-03-13');
    expect(read('Mar 13 2026', 'fr')).toBe('2026-03-13');
    expect(read('mar. 13 oct. 2026', 'fr')).toBe('2026-10-13');
    expect(read('mar, 13/10/2026', 'es')).toBe('2026-10-13');
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
    expect(read('Oct 13', 'en-US')).toBeNull();
    expect(read('1/1/999999', 'en-US')).toBeNull();
    expect(read('10/13/202', 'en-US')).toBeNull();
    expect(read('10/13/2026 x y', 'en-US')).toBeNull();
    expect(read('13 Oct Nov 2026', 'en-US')).toBeNull();
  });
});
