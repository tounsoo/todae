import { describe, expect, it } from 'vitest';
import { formatTime, parseTime } from './timeText';

const time = (text: string) => Temporal.PlainTime.from(text);
const read = (text: string, locale?: string) => parseTime(text, { locale })?.toString() ?? null;

const LOCALES = [
  'en-US', 'en-GB', 'en-AU', 'de', 'fr', 'fr-CA', 'es', 'es-MX', 'it', 'pt', 'pt-BR', 'nl', 'sv', 'nb', 'da', 'fi',
  'pl', 'ru', 'uk', 'cs', 'tr', 'el', 'he', 'ar', 'ar-EG', 'fa', 'hi', 'hi-IN-u-nu-deva', 'bn', 'ta', 'te', 'mr',
  'ko', 'ja', 'zh', 'en-CA', 'es-US', 'zh-TW', 'zh-HK', 'vi', 'th', 'id', 'ms', 'fil', 'sw', 'am', 'my', 'km', 'lo', 'ka', 'hy', 'kk',
  'mn', 'ur', 'ps', 'ckb', 'so', 'sq', 'ca', 'eu', 'gl', 'cy', 'ga', 'is', 'lt', 'lv', 'et', 'hu', 'ro', 'bg', 'sr',
];
const TIMES = [
  time('00:00'), time('00:30'), time('01:05'), time('09:30'), time('11:59'), time('12:00'), time('12:45'),
  time('13:07'), time('21:30'), time('23:59'), time('09:30:15'), time('21:05:59'),
];

describe('formatTime', () => {
  it('writes the short style, or the medium style when the time has seconds', () => {
    expect(formatTime(time('21:30'), { locale: 'en-US' })).toBe(time('21:30').toLocaleString('en-US', { timeStyle: 'short' }));
    expect(formatTime(time('21:30:15'), { locale: 'de' })).toBe('21:30:15');
    expect(formatTime(time('09:05'), { locale: 'de' })).toBe('09:05');
  });
});

describe('parseTime', () => {
  it('reads what formatTime writes in every locale', () => {
    for (const locale of LOCALES) {
      for (const value of TIMES) {
        const text = formatTime(value, { locale });
        expect(read(text, locale), `${locale}: ${text}`).toBe(value.toString());
      }
    }
  });

  it('reads both hour cycles in every locale', () => {
    for (const locale of LOCALES) {
      for (const hourCycle of ['h12', 'h23'] as const) {
        for (const value of TIMES) {
          const text = value.toLocaleString(locale, { hour: 'numeric', minute: '2-digit', hourCycle });
          expect(read(text, locale), `${locale} ${hourCycle}: ${text}`).toBe(value.with({ second: 0 }).toString());
        }
      }
    }
  });

  it('reads an hour alone, and hours and minutes without a separator', () => {
    expect(read('9')).toBe('09:00:00');
    expect(read('21')).toBe('21:00:00');
    expect(read('930')).toBe('09:30:00');
    expect(read('0930')).toBe('09:30:00');
    expect(read('2130')).toBe('21:30:00');
  });

  it('reads a 0 to 11 clock, as ja may write one', () => {
    expect(read('午後0:30', 'ja')).toBe('12:30:00');
    expect(read('午前0:30', 'ja')).toBe('00:30:00');
    for (const value of TIMES) {
      const text = value.toLocaleString('ja', { hour: 'numeric', minute: '2-digit', hourCycle: 'h11' });
      expect(read(text, 'ja'), text).toBe(value.with({ second: 0 }).toString());
    }
  });

  it('reads a part of the day written as several words with or without its spaces and dots', () => {
    const pm = (locale: string) => time('21:30').toLocaleString(locale, { hour: 'numeric', minute: '2-digit', hourCycle: 'h12' });
    expect(read(pm('es-MX'), 'es-MX')).toBe('21:30:00');
    expect(read('9:30 pm', 'es-MX')).toBe('21:30:00');
    expect(read('9:30pm', 'en-CA')).toBe('21:30:00');
    expect(read('9:30 p.m.', 'en-CA')).toBe('21:30:00');
    expect(read('9:30 pm', 'es')).toBe('21:30:00');
  });

  it('reads the locale’s words for the morning and afternoon on either side', () => {
    expect(read('9pm', 'en-US')).toBe('21:00:00');
    expect(read('9:30 PM', 'en-US')).toBe('21:30:00');
    expect(read('pm 9:30', 'en-US')).toBe('21:30:00');
    expect(read('12 am', 'en-US')).toBe('00:00:00');
    expect(read('12 pm', 'en-US')).toBe('12:00:00');
    expect(read('오후 9:30', 'ko')).toBe('21:30:00');
    expect(read('9:30 오전', 'ko')).toBe('09:30:00');
  });

  it('reads any separator and any script’s digits', () => {
    expect(read('21.30')).toBe('21:30:00');
    expect(read('21h30', 'fr-CA')).toBe('21:30:00');
    expect(read('٢١:٣٠', 'ar')).toBe('21:30:00');
    expect(read('２１：３０')).toBe('21:30:00');
  });

  it('returns null for text that is not a time', () => {
    for (const text of ['', ' ', 'noon', '24:00', '9:60', '9:5', '13 pm', '9:30:5', '1:2:3:4', '12345', 'am 9 pm', '9 30 xyz']) {
      expect(read(text, 'en-US'), text).toBeNull();
    }
  });

  it('does not read another locale’s words for the morning or afternoon', () => {
    expect(read('오후 9:30', 'en-US')).toBeNull();
  });
});
