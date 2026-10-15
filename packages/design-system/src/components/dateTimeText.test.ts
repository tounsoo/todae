import { describe, expect, it } from 'vitest';
import { parseDate } from './dateText';
import { formatDateTime, parseDateTime } from './dateTimeText';
import { parseTime } from './timeText';

// Lets the test runner hear from this test between locales, as each sweep runs for a while.
const breathe = () => new Promise((resolve) => setTimeout(resolve));

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
  at('1999-07-04T23:59'), at('2026-03-09T09:30:15'), at('2023-10-23T21:30'), at('2012-12-12T12:12'),
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

// Every base locale ICU had when this was written, that the runtime has.
const ALL_LOCALES = Intl.DateTimeFormat.supportedLocalesOf([
'dz', 'af', 'agq', 'ak', 'sq', 'am', 'ar', 'hy', 'ars', 'as', 'asa', 'ast', 'az', 'bm', 'eu', 'bas', 'be', 'bem',
'bn', 'bez', 'bg', 'bgc', 'bho', 'blo', 'bo', 'bs', 'br', 'brx', 'my', 'luy', 'ca', 'ccp', 'ce', 'ceb', 'cs', 'cgg',
'zh', 'chr', 'cv', 'ckb', 'syr', 'sa', 'sr-ME', 'kw', 'csw', 'cy', 'da', 'dav', 'de', 'doi', 'dje', 'mn', 'fa-AF',
'dsb', 'dua', 'nl', 'dyo', 'ebu', 'ee', 'et', 'el', 'en', 'eo', 'es', 'ewo', 'fa', 'fo', 'ff', 'fi', 'fil', 'fr',
'fy', 'fur', 'ga', 'gaa', 'om', 'gd', 'ka', 'gl', 'gv', 'kok', 'gsw', 'gu', 'guz', 'ha', 'haw', 'sr-Latn', 'he', 'hi',
'hr', 'hsb', 'hu', 'ia', 'ig', 'is', 'id', 'ie', 'ii', 'it', 'ja', 'jv', 'jgo', 'yi', 'jmc', 'kab', 'kl', 'kam', 'kn',
'ks', 'kk', 'kde', 'kea', 'kgp', 'km', 'khq', 'ki', 'rw', 'ky', 'kkj', 'kln', 'ku', 'ko', 'ksb', 'ksf', 'ksh', 'kxv',
'lag', 'lo', 'lv', 'lb', 'lg', 'lij', 'ln', 'lt', 'lkt', 'lmo', 'lrc', 'lu', 'luo', 'mk', 'mai', 'ml', 'mi', 'mr',
'mas', 'ms', 'mer', 'mfe', 'mg', 'mgh', 'mgo', 'mt', 'mni', 'ro', 'mua', 'raj', 'mzn', 'naq', 'nb', 'nd', 'nds', 'ne',
'nmg', 'nn', 'nnh', 'no', 'nqo', 'nso', 'nus', 'nyn', 'oc', 'or', 'os', 'pa', 'ps', 'pcm', 'pl', 'pt', 'prg', 'qu',
'rm', 'rn', 'rof', 'ru', 'rwk', 'sg', 'sah', 'saq', 'sat', 'sbp', 'sc', 'sr', 'sd', 'se', 'seh', 'ses', 'shi', 'si',
'sk', 'sl', 'smn', 'sn', 'so', 'st', 'su', 'sv', 'sw', 'sw-CD', 'szl', 'ta', 'tt', 'te', 'teo', 'tg', 'th', 'ti',
'tk', 'tn', 'to', 'tok', 'tr', 'twq', 'tzm', 'ug', 'uk', 'ur', 'uz', 'vai', 'vec', 'vi', 'vmw', 'vun', 'wae', 'wo',
'xh', 'xnr', 'xog', 'yav', 'yo', 'yrl', 'yue', 'za', 'zgh', 'zu'
  ]);

describe('parseDateTime', () => {
  it('reads what formatDateTime writes in every locale', async () => {
    for (const locale of LOCALES) {
      await breathe();
      for (const value of VALUES) {
        const text = formatDateTime(value, { locale });
        expect(read(text, locale), `${locale}: ${text}`).toBe(value.toString());
      }
    }
  }, 60_000);

  it("reads the locale's date and time styles in every locale", async () => {
    for (const locale of LOCALES) {
      await breathe();
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
  }, 60_000);

  it('reads a date and a time in the styles of every locale the runtime has, when it reads each alone', async () => {
    const all = ALL_LOCALES;
    const gregory = { calendar: 'gregory', timeZone: 'UTC' } as const;
    const styles: [Intl.DateTimeFormatOptions, Intl.DateTimeFormatOptions][] = [
      [{ year: 'numeric', month: 'numeric', day: 'numeric' }, { hour: 'numeric', minute: '2-digit' }],
      ...(['medium', 'long', 'full'] as const).flatMap((dateStyle) =>
        (['short', 'medium'] as const).map((timeStyle): [Intl.DateTimeFormatOptions, Intl.DateTimeFormatOptions] => [{ dateStyle }, { timeStyle }]),
      ),
    ];
    for (const locale of all) {
      await breathe();
      for (const value of [at('2026-10-13T21:30:15'), at('1999-01-02T09:05:59'), at('2023-10-23T21:30:15'), at('2012-12-12T12:12:12')]) {
        for (const [date, time] of styles) {
          const dateOnly = value.toPlainDate().toLocaleString(locale, { ...date, ...gregory });
          const timeOnly = value.toLocaleString(locale, { ...time, ...gregory });
          if (!parseDate(dateOnly, { locale }) || !parseTime(timeOnly, { locale })) continue;
          const text = value.toLocaleString(locale, { ...date, ...time, ...gregory });
          const expected = parseTime(timeOnly, { locale })!;
          expect(read(text, locale), `${locale}: ${text}`).toBe(value.toPlainDate().toPlainDateTime(expected).toString());
        }
      }
    }
  }, 60_000);

  it('reads typed text, with or without the words between the date and the time', () => {
    expect(read('10/13/2026 9:30 pm', 'en-US')).toBe('2026-10-13T21:30:00');
    expect(read('Oct 13, 2026 at 9:30 PM', 'en-US')).toBe('2026-10-13T21:30:00');
    expect(read('oct 13 2026 9:30pm', 'en-US')).toBe('2026-10-13T21:30:00');
    expect(read('13.10.2026 21:30', 'de')).toBe('2026-10-13T21:30:00');
    expect(read('13. Oktober 2026 um 21:30', 'de')).toBe('2026-10-13T21:30:00');
    expect(read('2026. 10. 13. 오후 9:30', 'ko')).toBe('2026-10-13T21:30:00');
    expect(read('2026年10月13日21:30', 'ja')).toBe('2026-10-13T21:30:00');
    expect(read('2026/10/13 21:30', 'zh-u-nu-hanidec')).toBe('2026-10-13T21:30:00');
  });

  it('reads a date and a time joined by punctuation where a word meets a number', () => {
    expect(read('2026.10.13.오후9:30', 'ko')).toBe('2026-10-13T21:30:00');
    expect(read('2026년 10월 13일 화요일오후 9:30', 'ko')).toBe('2026-10-13T21:30:00');
    expect(read('2026年10月13日下午9:30', 'zh')).toBe('2026-10-13T21:30:00');
    expect(read('13.10.2026,21:30', 'de')).toBe('2026-10-13T21:30:00');
    expect(read('10/13/26 9:05', 'en-US')).toBe('2026-10-13T09:05:00');
  });

  it('reads a day that matches the last digits of the year, where the day ends the date', () => {
    expect(read('2023. 10. 23. 21:30', 'ko')).toBe('2023-10-23T21:30:00');
    expect(read('2012. 12. 12. 12:12', 'hu')).toBe('2012-12-12T12:12:00');
    expect(read('2020. febr. 20. 20:20', 'hu')).toBe('2020-02-20T20:20:00');
  });

  it("reads the locale's own words and marks between the date and the time", () => {
    // "/" is what az writes between them in newer locale data.
    expect(read('13 oktyabr 2026/21:30', 'az')).toBe('2026-10-13T21:30:00');
    // "am" is cy for "at", and also AM.
    expect(read('12 Rhagfyr 2012 am 12:12', 'cy')).toBe('2012-12-12T12:12:00');
  });

  it('does not read a date typed without a year beside a time of two numbers', () => {
    // In newer locale data rw writes a date with a year as "2026 Ukw. 13", and without one as "13 Ukw.".
    const date = Temporal.PlainDate.from('2026-10-09').toLocaleString('rw', { month: 'short', day: 'numeric', calendar: 'gregory' });
    expect(read(`${date} 21 05`, 'rw')).toBeNull();
    expect(read('9 Ukw. 21 05', 'rw')).toBeNull();
  });

  it('keeps the marks inside a date or a time from ending the date', () => {
    expect(read('13.10.23 21:30', 'ru')).toBe('2023-10-13T21:30:00');
    expect(read('13.10.23, 21:30', 'uk')).toBe('2023-10-13T21:30:00');
    expect(read('13.10.23 21.30', 'da')).toBe('2023-10-13T21:30:00');
    expect(read('9:05 2.1.26', 'nb')).toBeNull();
  });

  it("reads a two-digit year beside a month's name", () => {
    expect(read('Oct 13 26 9:05', 'en-US')).toBe('2026-10-13T09:05:00');
    expect(read('23 Dip 13 21:30', 'tn')).toBe('2023-10-13T21:30:00');
    expect(read('13. márc. 10. 21:05', 'hu')).toBe('2013-03-10T21:05:00');
    // lmo writes a date as "2026 marz 10".
    expect(read('10 marz 13 21:05', 'lmo')).toBe('2010-03-13T21:05:00');
    expect(read('13 Oct 26 21:05', 'en-GB')).toBe('2026-10-13T21:05:00');
  });

  it("reads a date and a time joined by any mark that isn't only a date's or a time's", () => {
    expect(read('13.10.2026-21:30', 'de')).toBe('2026-10-13T21:30:00');
    expect(read('Oct 13, 2026-9:30 PM', 'en-US')).toBe('2026-10-13T21:30:00');
    expect(read('10/13/2026/9:30', 'en-US')).toBeNull();
    expect(read('13.10.2026:21:30', 'de')).toBeNull();
  });

  it('needs the minutes of a time, or a word for the part of the day', () => {
    expect(read('13.10.2026 21', 'de')).toBeNull();
    expect(read('13.10.2026 2130', 'de')).toBe('2026-10-13T21:30:00');
    expect(read('10/13/2026 9 pm', 'en-US')).toBe('2026-10-13T21:00:00');
    expect(read('13 oct. 2026 21 h', 'fr-CA')).toBe('2026-10-13T21:00:00');
    expect(read('13 oct. 2026 21 h 05', 'fr-CA')).toBe('2026-10-13T21:05:00');
  });

  it('does not read the hour of a time as the year of a date typed without one', () => {
    expect(read('10/13 9 05', 'en-US')).toBeNull();
    expect(read('Oct 13 9 05 PM', 'en-US')).toBeNull();
    expect(read('Oct 13 9:05 PM', 'en-US')).toBeNull();
    expect(read('10/13 9:05', 'en-US')).toBeNull();
    expect(read('10/13 12:05', 'en-US')).toBeNull();
    expect(read('13.10. 9:05', 'de')).toBeNull();
    expect(read('13/10 21:05', 'en-GB')).toBeNull();
    expect(read('10/13 21:05', 'ja')).toBeNull();
    expect(read('2/29 20 05', 'en-US')).toBeNull();
    expect(read('29.2. 20 05', 'de')).toBeNull();
    expect(read('Tue, Oct 13 9 05', 'en-US')).toBeNull();
    expect(read('mardi 13 octobre 9 05', 'fr')).toBeNull();
    expect(read('10. 9. 21 05', 'ko')).toBeNull();
    expect(read('10/9 21 05', 'ja')).toBeNull();
    expect(read('3. 4. 9 05', 'hu')).toBeNull();
    expect(read('13/10 9 05', 'sv')).toBeNull();
    expect(read('9 05 3/4', 'vi')).toBeNull();
  });

  it('does not read a time typed before a date the locale writes first', () => {
    expect(read('21 05 10. 9.', 'ko')).toBeNull();
    expect(read('9 05 4. 3.', 'cs')).toBeNull();
  });

  it('reads a two-digit year beside the time', () => {
    expect(read('26. 10. 13. 21:05', 'ko')).toBe('2026-10-13T21:05:00');
    expect(read('21:05 13/10/26', 'vi')).toBe('2026-10-13T21:05:00');
    expect(read('13/10/26 21:05', 'en-GB')).toBe('2026-10-13T21:05:00');
    expect(read('13.10.26 г. 21:30', 'bg')).toBe('2026-10-13T21:30:00');
    // kkj writes a date with a two-digit year as "13/10 26".
    expect(read('13/10 26 21:30', 'kkj')).toBe('2026-10-13T21:30:00');
    // Also October 12 at 13:21:05 when the year is left out, which is not read.
    expect(read('12. 10. 13. 21:05', 'ko')).toBe('2012-10-13T21:05:00');
    expect(read('26.10.13 21:05', 'ko')).toBe('2026-10-13T21:05:00');
    expect(read('13.10.26 21:05', 'cs')).toBe('2026-10-13T21:05:00');
    expect(read('13. 10. 26 21:05', 'bs')).toBe('2026-10-13T21:05:00');
    expect(read('10-13-26 9:05', 'en-US')).toBe('2026-10-13T09:05:00');
    expect(read('21:05 13 10 26', 'vi')).toBe('2026-10-13T21:05:00');
    // "/" doesn't end a date in en-US, so 12 is not the hour of "10/13".
    expect(read('10/13/12 05 pm', 'en-US')).toBe('2012-10-13T17:00:00');
    expect(read('10/13/12 09 05', 'en-US')).toBe('2012-10-13T09:05:00');
  });

  it('does not read a two-digit year that may be the hour of a date without a year, nor a year of one digit', () => {
    expect(read('10/13 12 05 pm', 'en-US')).toBeNull();
    expect(read('Oct 13 11 05 PM', 'en-US')).toBeNull();
    expect(read('13 oct. 21 h 05', 'fr-CA')).toBeNull();
    expect(read('13.10 12.05.15', 'da')).toBeNull();
    // The day 09 has the digits of 2009, but is not its year.
    expect(read('Oct 09 9 05 pm', 'en-US')).toBeNull();
    expect(read('05/13/5 9:30 pm', 'en-US')).toBeNull();
    expect(read('10/13/6 9:30 pm', 'en-US')).toBeNull();
    // Also October 13 at 11:05:15, the date as cs writes it without a year.
    expect(read('13. 10. 11 05 15', 'cs')).toBeNull();
    expect(read('12. 12. 12 12 12', 'cs')).toBeNull();
    expect(read('13.10.12 05 15', 'de')).toBeNull();
    expect(read('13-10 11 05 15', 'af')).toBeNull();
    expect(read('13. Okt. 11 05 15', 'de')).toBeNull();
    // 2015 has 2026's weekdays, and the month's other names read too.
    expect(read('Tuesday Oct 13 15 05 30', 'en-US')).toBeNull();
    expect(read('13 octubre 12 05 15', 'es')).toBeNull();
    expect(read('13 октябрь 12 05 15', 'ru')).toBeNull();
    // A time typed before the date, in a locale that writes the date first.
    expect(read('05 06 07 04.03.09', 'de')).toBeNull();
    expect(read('05 06 07 04/03/09', 'agq')).toBeNull();
    expect(read('13.10. 21.30', 'de')).toBeNull();
    expect(read('10/13/12 9:05', 'en-US')).toBe('2012-10-13T09:05:00');
  });

  it("reads a time written with a mark of the locale's dates, as 21.30, after a date", async () => {
    expect(read('13.10.2026 21.30', 'de')).toBe('2026-10-13T21:30:00');
    expect(read('13.10.2026 um 21.30', 'de')).toBe('2026-10-13T21:30:00');
    expect(read('13.10.2026 21.30', 'ru')).toBe('2026-10-13T21:30:00');
    expect(read('13.10.2026 21.30', 'nb')).toBe('2026-10-13T21:30:00');
    expect(read('13.10.2026 г. 21.30', 'bg')).toBe('2026-10-13T21:30:00');
    const gregory = { calendar: 'gregory', timeZone: 'UTC' } as const;
    for (const locale of ALL_LOCALES) {
      await breathe();
      const date = Temporal.PlainDate.from('2026-10-13').toLocaleString(locale, { year: 'numeric', month: 'numeric', day: 'numeric', ...gregory });
      for (const mark of ['.', '-', '/']) {
        const time = `21${mark}30`;
        if (!parseTime(time, { locale }) || !parseDate(date, { locale })) continue;
        const text = `${date} ${time}`;
        const value = read(text, locale);
        // Read as 21:30 on the date, or not at all where the text also reads another way.
        if (value !== null) expect(value, `${locale}: ${text}`).toBe('2026-10-13T21:30:00');
      }
    }
  }, 60_000);

  it('does not read a date typed without a year, beside a time, in any locale the runtime has', async () => {
    const gregory = { calendar: 'gregory', timeZone: 'UTC' } as const;
    const dates: Intl.DateTimeFormatOptions[] = [
      { month: 'numeric', day: 'numeric' },
      { month: 'short', day: 'numeric' },
      { weekday: 'long', month: 'long', day: 'numeric' },
      { weekday: 'long', month: 'short', day: 'numeric' },
      { month: 'long', day: 'numeric' },
    ];
    const cases: [string, string][] = [
      ['2026-10-09', '21 05'],
      ['2026-03-04', '9 05'],
      ['2020-02-29', '20 05'],
      ['2009-10-13', '9 05'],
      ['2026-10-13', '11 05 15'],
      ['2026-10-13', '12 05 15'],
      ['2026-10-13', '15 05 30'],
      ['2026-10-13', '20 05 30'],
    ];
    for (const locale of ALL_LOCALES) {
      await breathe();
      // The time goes where formatDateTime writes it: first when the hour comes before the year.
      const types = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', ...gregory })
        .formatToParts(Date.UTC(2026, 9, 13, 21))
        .map((part) => part.type);
      const timeFirst = types.indexOf('hour') < types.indexOf('year');
      // The locale's own time, with a word for the part of the day where it writes one, typed with spaces for its marks.
      const own = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', hour12: true, ...gregory })
        .format(Date.UTC(2026, 9, 13, 23, 5))
        .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
        .trim();
      for (const style of dates) {
        // Where parseTime reads it, unlike a word for the part of the day between the numbers, as in blo.
        const owns: [string, string][] = parseTime(own, { locale }) ? [['2026-10-13', own]] : [];
        for (const [day, time] of [...cases, ...owns]) {
          const date = Temporal.PlainDate.from(day).toLocaleString(locale, { ...style, ...gregory });
          const text = timeFirst ? `${time} ${date}` : `${date} ${time}`;
          expect(read(text, locale), `${locale}: ${text}`).toBeNull();
        }
      }
    }
  }, 120_000);

  it('reads a word with a letter of no one script', () => {
    const value = at('2026-10-13T00:00');
    for (const locale of ['haw', 'to', 'ha']) {
      const text = value.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short', calendar: 'gregory', timeZone: 'UTC' });
      expect(read(text, locale), `${locale}: ${text}`).toBe(value.toString());
    }
  });

  it('returns null for text that is not one date and time', () => {
    for (const text of ['', '10/13/2026', '9:30 pm', '10/13/2026 25:00', '2/30/2026 9:30', 'tomorrow at 9', '10/13/2026 9:30 pm 9:30']) {
      expect(read(text, 'en-US'), text).toBeNull();
    }
  });
});
