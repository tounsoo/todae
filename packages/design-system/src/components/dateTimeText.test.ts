import { describe, expect, it } from 'vitest';
import { formatDateTime, parseDateTime } from './dateTimeText';

const at = (text: string) => Temporal.PlainDateTime.from(text);
const read = (text: string, locale?: string) => parseDateTime(text, { locale })?.toString() ?? null;

const LOCALES = [
  'en-US', 'en-GB', 'en-AU', 'de', 'fr', 'fr-CA', 'es', 'es-MX', 'it', 'pt', 'pt-BR', 'nl', 'sv', 'nb', 'da', 'fi',
  'pl', 'ru', 'uk', 'cs', 'tr', 'el', 'he', 'ar', 'ar-EG', 'fa', 'hi', 'hi-IN-u-nu-deva', 'bn', 'ta', 'te', 'mr',
  'ko', 'ja', 'zh', 'en-CA', 'es-US', 'zh-TW', 'zh-HK', 'vi', 'th', 'id', 'ms', 'fil', 'sw', 'am', 'my', 'km', 'lo', 'ka', 'hy', 'kk',
  'mn', 'ur', 'ps', 'ckb', 'so', 'sq', 'ca', 'eu', 'gl', 'cy', 'ga', 'is', 'lt', 'lv', 'et', 'hu', 'ro', 'bg', 'sr',
];
const VALUES = [
  at('2026-10-13T00:00'), at('2026-10-13T09:30'), at('2026-01-02T12:45'), at('2026-12-31T21:30'),
  at('1999-07-04T23:59'), at('2026-03-09T09:30:15'),
];

describe('formatDateTime', () => {
  it('writes the date in numbers and the time, with seconds when it has seconds', () => {
    expect(formatDateTime(at('2026-10-13T21:30'), { locale: 'en-US' })).toBe('10/13/2026, 9:30 PM');
    expect(formatDateTime(at('2026-10-13T21:30'), { locale: 'de' })).toBe('13.10.2026, 21:30');
    expect(formatDateTime(at('2026-10-13T21:30:15'), { locale: 'de' })).toBe('13.10.2026, 21:30:15');
  });

  it('writes a date in another calendar as the same day in the Gregorian calendar', () => {
    const value = at('2026-10-13T21:30').withCalendar('japanese');
    expect(formatDateTime(value, { locale: 'en-US' })).toBe('10/13/2026, 9:30 PM');
  });
});

describe('parseDateTime', () => {
  it('reads what formatDateTime writes in every locale', () => {
    for (const locale of LOCALES) {
      for (const value of VALUES) {
        const text = formatDateTime(value, { locale });
        expect(read(text, locale), `${locale}: ${text}`).toBe(value.toString());
      }
    }
  });

  it("reads the locale's date and time styles in every locale", () => {
    for (const locale of LOCALES) {
      for (const dateStyle of ['medium', 'long', 'full'] as const) {
        for (const timeStyle of ['short', 'medium'] as const) {
          for (const value of VALUES) {
            const text = value.toLocaleString(locale, { dateStyle, timeStyle, calendar: 'gregory', timeZone: 'UTC' });
            const expected = timeStyle === 'short' ? value.with({ second: 0 }) : value;
            expect(read(text, locale), `${locale} ${dateStyle} ${timeStyle}: ${text}`).toBe(expected.toString());
          }
        }
      }
    }
  });

  it('reads typed text, with or without the words between the date and the time', () => {
    expect(read('10/13/2026 9:30 pm', 'en-US')).toBe('2026-10-13T21:30:00');
    expect(read('Oct 13, 2026 at 9:30 PM', 'en-US')).toBe('2026-10-13T21:30:00');
    expect(read('oct 13 2026 9:30pm', 'en-US')).toBe('2026-10-13T21:30:00');
    expect(read('13.10.2026 21:30', 'de')).toBe('2026-10-13T21:30:00');
    expect(read('13. Oktober 2026 um 21:30', 'de')).toBe('2026-10-13T21:30:00');
    expect(read('2026. 10. 13. 오후 9:30', 'ko')).toBe('2026-10-13T21:30:00');
    expect(read('2026年10月13日21:30', 'ja')).toBe('2026-10-13T21:30:00');
  });

  it('returns null for text that is not one date and time', () => {
    for (const text of ['', '10/13/2026', '9:30 pm', '10/13/2026 25:00', '2/30/2026 9:30', 'tomorrow at 9', '10/13/2026 9:30 pm 9:30']) {
      expect(read(text, 'en-US'), text).toBeNull();
    }
  });
});
