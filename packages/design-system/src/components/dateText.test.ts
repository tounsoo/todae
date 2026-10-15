import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatDate, parseDate } from './dateText';

const date = (text: string) => Temporal.PlainDate.from(text);
const read = (text: string, locale?: string) => parseDate(text, { locale })?.toString() ?? null;

const LOCALES = [
  'en-US', 'en-GB', 'de', 'fr', 'es', 'it', 'pt', 'ro', 'sq', 'cy', 'tr', 'pl', 'ru', 'uk', 'cs', 'fi', 'hr', 'lt',
  'ko', 'ja', 'zh', 'vi', 'th', 'he', 'ar', 'ar-EG', 'fa', 'hi', 'hi-IN-u-nu-deva', 'ky', 'ug',
  'so', 'mt', 'el', 'ca', 'eu', 'lv', 'mn', 'kk', 'hu', 'et', 'ka', 'my', 'km', 'lo', 'am', 'sr', 'bg', 'ckb', 'ps',
  'dz',
];
// Day 13 of each month, so the day cannot be read as a month, and two dates where it can.
const DATES = [
  ...Array.from({ length: 12 }, (_, index) => Temporal.PlainDate.from({ year: 2026, month: index + 1, day: 13 })),
  date('2026-01-02'),
  date('2026-02-01'),
];
const GREGORY = { calendar: 'gregory', timeZone: 'UTC' } as const;
const STYLES = ['medium', 'long', 'full'] as const;

// Every case below is checked for each locale and date, with Intl's own text as what parseDate must read.
function forEachDate(check: (locale: string, day: Temporal.PlainDate) => void) {
  for (const locale of LOCALES) for (const day of DATES) check(locale, day);
}
const parts = (locale: string, day: Temporal.PlainDate, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale, { ...options, ...GREGORY }).formatToParts(
    new Date(Date.UTC(day.year, day.month - 1, day.day, 12)),
  );
const join = (list: Intl.DateTimeFormatPart[]) => list.map((part) => part.value).join('');
const isLiteral = (part: Intl.DateTimeFormatPart) => part.type === 'literal';

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
  it('reads the numbers formatDate writes, with any separators', () => {
    forEachDate((locale, day) => {
      const text = formatDate(day, { locale });
      expect(read(text, locale), `${locale} ${text}`).toBe(day.toString());
      const numbers = text.match(/\p{Nd}+/gu)!;
      for (const separator of ['/', ' | ', '+', '~', ' - ']) {
        expect(read(numbers.join(separator), locale), `${locale} ${separator}`).toBe(day.toString());
      }
    });
  });

  it('reads the locale’s medium, long and full date styles', () => {
    forEachDate((locale, day) => {
      for (const dateStyle of STYLES) {
        const text = join(parts(locale, day, { dateStyle }));
        expect(read(text, locale), `${locale} ${dateStyle} ${text}`).toBe(day.toString());
      }
    });
  });

  it('reads the date styles in any letter case', () => {
    forEachDate((locale, day) => {
      for (const dateStyle of STYLES) {
        const text = join(parts(locale, day, { dateStyle }));
        for (const cased of [text.toUpperCase(), text.toLocaleUpperCase(locale), text.toLowerCase()]) {
          expect(read(cased, locale), `${locale} ${cased}`).toBe(day.toString());
        }
      }
    });
  });

  it('reads the date styles with any punctuation, symbols or spaces between the parts', () => {
    forEachDate((locale, day) => {
      for (const dateStyle of STYLES) {
        const list = parts(locale, day, { dateStyle });
        const swapped = list.map((part) => (isLiteral(part) ? part.value.replace(/[^\p{L}\p{M}]+/gu, ' | ') : part.value)).join('');
        const spread = list.map((part) => part.value).join(' ~ ');
        expect(read(swapped, locale), `${locale} ${swapped}`).toBe(day.toString());
        expect(read(spread, locale), `${locale} ${spread}`).toBe(day.toString());
      }
    });
  });

  it('reads any of the month’s long or short names', () => {
    forEachDate((locale, day) => {
      for (const dateStyle of STYLES) {
        const list = parts(locale, day, { dateStyle });
        if (!list.some((part) => part.type === 'month' && !/\p{Nd}/u.test(part.value))) continue;
        for (const month of ['long', 'short'] as const) {
          const name = parts(locale, day, { day: 'numeric', month, year: 'numeric' }).find((part) => part.type === 'month')!;
          // Some locales write the short month as its number, such as cs.
          if (/\p{Nd}/u.test(name.value)) continue;
          const text = join(list.map((part) => (part.type === 'month' ? name : part)));
          expect(read(text, locale), `${locale} ${text}`).toBe(day.toString());
        }
      }
    });
  });

  it('reads a long, short or left-out weekday, and only the date’s', () => {
    forEachDate((locale, day) => {
      const list = parts(locale, day, { dateStyle: 'full' });
      if (!list.some((part) => part.type === 'weekday')) return;
      const short = parts(locale, day, { weekday: 'short' }).find((part) => part.type === 'weekday')!;
      const withShort = join(list.map((part) => (part.type === 'weekday' ? short : part)));
      const without = join(list.map((part) => (part.type === 'weekday' ? { ...part, value: ' ' } : part)));
      expect(read(withShort, locale), `${locale} ${withShort}`).toBe(day.toString());
      expect(read(without, locale), `${locale} ${without}`).toBe(day.toString());
      const other = parts(locale, day.add({ days: 3 }), { weekday: 'long' }).find((part) => part.type === 'weekday')!;
      const wrong = join(list.map((part) => (part.type === 'weekday' ? other : part)));
      expect(read(wrong, locale), `${locale} ${wrong}`).toBeNull();
    });
  });

  it('reads the date styles with their other words replaced by a space', () => {
    forEachDate((locale, day) => {
      for (const dateStyle of STYLES) {
        const text = parts(locale, day, { dateStyle })
          .map((part) => (isLiteral(part) || part.type === 'era' ? ' ' : part.value))
          .join('');
        expect(read(text, locale), `${locale} ${text}`).toBe(day.toString());
      }
    });
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
    expect(read('2026-13-10', 'ky')).toBe('2026-10-13');
    expect(read('2026-10-13', 'ky')).toBeNull();
  });

  it('reads a two-digit year in the order of the locale’s short date style', () => {
    // formatDate writes 2026-10-13 in gsw, and its short style 13.10.26.
    expect(read('13.10.26', 'gsw')).toBe('2026-10-13');
    expect(read('2026-10-13', 'gsw')).toBe('2026-10-13');
    expect(read('10/13/26', 'zu')).toBe('2026-10-13');
    // Digits of a script past U+FFFF, two code units each.
    expect(read('13.10.26', 'gsw-u-nu-adlm')).toBe('2026-10-13');
    expect(read('13/10/26', 'ha')).toBe('2026-10-13');
    // formatDate writes 10/13/2026 in so, and its short style 13/10/26.
    expect(read('06/05/26', 'so')).toBe('2026-05-06');
    expect(read('06/05/2026', 'so')).toBe('2026-06-05');
    // mt's short style writes 13/10/2026: a year in full is read in formatDate's
    // order when both orders read a date, and in the short style's when only it does.
    expect(read('06/05/2026', 'mt')).toBe('2026-06-05');
    expect(read('13/10/2026', 'mt')).toBe('2026-10-13');
  });

  it('reads the short date style of every locale that writes a two-digit year in it', () => {
    let checked = 0;
    for (const locale of Intl.DateTimeFormat.supportedLocalesOf(LOCALES.concat(['gsw', 'zu', 'ha', 'sat', 'ak', 'fur', 'os', 'gsw-u-nu-adlm', 'so-u-nu-adlm']))) {
      const year = parts(locale, date('2026-10-13'), { dateStyle: 'short' }).find((part) => part.type === 'year');
      if (!year || [...year.value].length > 2 || !/^\p{Nd}+$/u.test(year.value)) continue;
      checked++;
      for (const day of DATES) {
        const text = join(parts(locale, day, { dateStyle: 'short' }));
        expect(read(text, locale), `${locale} ${text}`).toBe(day.toString());
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('reads a year written first as year, month and day, as ISO does', () => {
    expect(read('2026-10-13', 'en-US')).toBe('2026-10-13');
    expect(read('2026/10/13', 'de')).toBe('2026-10-13');
    expect(read('2026年10月13日', 'ja')).toBe('2026-10-13');
    expect(read('2026년 10월 13일', 'ko')).toBe('2026-10-13');
  });

  it('reads month names and words as the locale writes them', () => {
    expect(read('Oct 13, 2026', 'en-US')).toBe('2026-10-13');
    expect(read('Tuesday, October 13, 2026', 'en-US')).toBe('2026-10-13');
    expect(read('13 octobre 2026', 'fr')).toBe('2026-10-13');
    expect(read('13 mars 2026', 'fr')).toBe('2026-03-13');
    expect(read('13. Okt. 2026', 'de')).toBe('2026-10-13');
    expect(read('13|10|2026', 'de')).toBe('2026-10-13');
    expect(read('13 de octubre de 2026', 'es')).toBe('2026-10-13');
    expect(read('13 mar 2026', 'es')).toBe('2026-03-13');
    expect(read('13 mar 2026', 'it')).toBe('2026-03-13');
    expect(read('13 октября 2026', 'ru')).toBe('2026-10-13');
    expect(read('13 אוק 2026', 'he')).toBe('2026-10-13');
    expect(read('terça-feira, 13 de outubro de 2026', 'pt')).toBe('2026-10-13');
    expect(read('2026年10月13日火曜日', 'ja')).toBe('2026-10-13');
    expect(read('13 NİSAN 2026', 'tr')).toBe('2026-04-13');
    expect(read('13 KASIM 2026', 'tr')).toBe('2026-11-13');
    expect(read('13 EKİM 2026', 'tr')).toBe('2026-10-13');
    expect(read('13 ตค 2026', 'th')).toBe('2026-10-13');
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
    expect(read('13 octmon 2026', 'en-US')).toBeNull();
    expect(read('Tuesday Tuesday 10/13/2026', 'en-US')).toBeNull();
    expect(read('Mon, Oct 13, 2026', 'en-US')).toBeNull();
    expect(read('13.10.2026 tere', 'et')).toBeNull();
    expect(read('13.10.2026 t', 'et')).toBeNull();
    expect(read('t 13.10.2026', 'et')).toBeNull();
    expect(read('de de 13 oct 2026', 'es')).toBeNull();
    expect(read('13 octubre 2026 de', 'es')).toBeNull();
    expect(read('mdmd', 'lt')).toBeNull();
  });

  describe('without Temporal', () => {
    const temporal = Object.getOwnPropertyDescriptor(globalThis, 'Temporal')!;
    beforeEach(() => {
      Reflect.deleteProperty(globalThis, 'Temporal');
    });
    afterEach(() => {
      Object.defineProperty(globalThis, 'Temporal', temporal);
    });

    it('can throw', () => {
      expect(() => parseDate('10/13/2026', { locale: 'en-US' })).toThrow(ReferenceError);
      expect(parseDate('soon', { locale: 'en-US' })).toBeNull();
    });
  });
});
