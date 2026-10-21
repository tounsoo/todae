import { describe, expect, it } from 'vitest';
import { commitNumber, formatNumber, isPartialNumber, parseNumber, stepNumber } from './numberText.js';

const read = (text: string, locale?: string, formatOptions?: Intl.NumberFormatOptions) =>
  parseNumber(text, { locale, formatOptions });

const LOCALES = [
  'en-US', 'en-GB', 'en-IN', 'de', 'de-CH', 'de-AT', 'fr', 'fr-CA', 'fr-CH', 'es', 'es-MX', 'it', 'pt', 'pt-BR',
  'pt-PT', 'nl', 'sv', 'nb', 'da', 'fi', 'pl', 'ru', 'uk', 'cs', 'tr', 'el', 'he', 'ar', 'ar-EG', 'fa', 'hi',
  'hi-IN-u-nu-deva', 'bn', 'ta', 'ko', 'ja', 'zh', 'zh-TW', 'vi', 'th', 'id', 'hu', 'ro', 'bg', 'sk', 'hr', 'lt',
];
const VALUES = [0, 1, -1, 12, 999, 1000, 1234.5, -1234.5, 0.5, 0.125, 1234567.891, -98765432.1, 1e-7, 123456789012];

describe('formatNumber', () => {
  it.each([
    ['en-US', '1,234.5'],
    ['de-DE', '1.234,5'],
    ['fr-FR', '1 234,5'],
    ['ko-KR', '1,234.5'],
    ['de-CH', '1’234.5'],
    ['hi-IN', '1,234.5'],
    ['ar-EG', '١٬٢٣٤٫٥'],
  ])('writes 1234.5 in %s', (locale, text) => {
    expect(formatNumber(1234.5, { locale })).toBe(text);
  });

  it('keeps every digit a number has, where Intl alone keeps three', () => {
    expect(formatNumber(1.23456789, { locale: 'en' })).toBe('1.23456789');
    expect(formatNumber(1.23456789, { locale: 'en', formatOptions: { maximumFractionDigits: 2 } })).toBe('1.23');
    expect(formatNumber(1.5, { locale: 'en', formatOptions: { minimumFractionDigits: 2 } })).toBe('1.50');
  });

  it('writes a percent, a currency and a unit as Intl does', () => {
    expect(formatNumber(0.125, { locale: 'en', formatOptions: { style: 'percent', maximumFractionDigits: 1 } })).toBe('12.5%');
    expect(formatNumber(12000, { locale: 'ko', formatOptions: { style: 'currency', currency: 'KRW' } })).toBe('₩12,000');
    expect(formatNumber(2, { locale: 'en', formatOptions: { style: 'unit', unit: 'kilometer', unitDisplay: 'long' } })).toBe('2 kilometers');
  });
});

describe('parseNumber', () => {
  it.each([
    ['1,234.5', 'en-US', 1234.5],
    ['1234.5', 'en-US', 1234.5],
    ['1.234,5', 'de-DE', 1234.5],
    ['1234,5', 'de-DE', 1234.5],
    ['1 234,5', 'fr-FR', 1234.5],
    ['1 234,5', 'fr-FR', 1234.5],
    ['1 234,5', 'fr-FR', 1234.5],
    ['1,234.5', 'ko-KR', 1234.5],
    ['1’234.5', 'de-CH', 1234.5],
    ["1'234.5", 'de-CH', 1234.5],
    ['١٬٢٣٤٫٥', 'ar-EG', 1234.5],
    ['１２３４．５', 'ja', 1234.5],
    ['12,34,567.5', 'hi-IN', 1234567.5],
    ['1,234,567.5', 'hi-IN', 1234567.5],
    ['−1,5', 'sv-SE', -1.5],
    ['+12', 'en', 12],
    ['.5', 'en', 0.5],
    ['5.', 'en', 5],
    ['0', 'en', 0],
    ['-0', 'en', 0],
  ])('reads %j in %s as %s', (text, locale, number) => {
    expect(read(text, locale)).toBe(number);
  });

  it('reads a period as a decimal point where the locale does not group with one', () => {
    expect(read('1.5', 'fr')).toBe(1.5);
    expect(read('1.5', 'sv')).toBe(1.5);
    expect(read('1.5', 'de')).toBeNull();
    expect(read('1.234', 'de')).toBe(1234);
    expect(read('1.234,5', 'de')).toBe(1234.5);
  });

  it('reads no number from a text that is not one', () => {
    for (const text of ['', ' ', '-', '+', '.', 'abc', '1e5', '1.2.3', '1,23', '12,3456', '1,,234', ',234', '1 2', '--1', '1-', '12abc']) {
      expect(read(text, 'en'), JSON.stringify(text)).toBeNull();
    }
    expect(read('1,5', 'en')).toBeNull();
    expect(read('1 234', 'de')).toBeNull();
    expect(read('1,234,5', 'de')).toBeNull();
  });

  it('reads a number too large to hold as none', () => {
    expect(read('9'.repeat(400), 'en')).toBeNull();
  });

  it('reads the percent, currency and unit that formatOptions writes, or none', () => {
    const percent = { style: 'percent', maximumFractionDigits: 1 } as const;
    expect(read('12.5%', 'en', percent)).toBe(0.125);
    expect(read('13', 'en', percent)).toBe(0.13);
    expect(read('7%', 'en', percent)).toBe(0.07);
    expect(read('12,5 %', 'de', percent)).toBe(0.125);
    expect(read('12,5 %', 'de', percent)).toBe(0.125);
    expect(read('12.5%', 'en')).toBeNull();
    const krw = { style: 'currency', currency: 'KRW' } as const;
    expect(read('₩12,000', 'ko', krw)).toBe(12000);
    expect(read('12,000', 'ko', krw)).toBe(12000);
    expect(read('-₩12,000', 'ko', krw)).toBe(-12000);
    expect(read('1.234,50 €', 'de', { style: 'currency', currency: 'EUR' })).toBe(1234.5);
    expect(read('(1,234.50)', 'en', { style: 'currency', currency: 'USD', currencySign: 'accounting' })).toBe(-1234.5);
    const km = { style: 'unit', unit: 'kilometer', unitDisplay: 'long' } as const;
    expect(read('1 kilometer', 'en', km)).toBe(1);
    expect(read('2 kilometers', 'en', km)).toBe(2);
    expect(read('2', 'en', km)).toBe(2);
  });

  it('reads what formatNumber writes in every locale', () => {
    for (const locale of LOCALES) {
      for (const value of VALUES) {
        const text = formatNumber(value, { locale });
        expect(read(text, locale), `${locale}: ${text}`).toBe(value);
      }
    }
  });

  it('reads what formatNumber writes with a percent, a currency or a unit in every locale', () => {
    const options: Intl.NumberFormatOptions[] = [
      { style: 'percent', maximumFractionDigits: 2 },
      { style: 'currency', currency: 'EUR' },
      { style: 'currency', currency: 'USD', currencyDisplay: 'code' },
      { style: 'currency', currency: 'JPY', currencyDisplay: 'name' },
      { style: 'unit', unit: 'kilogram' },
      { style: 'unit', unit: 'kilometer', unitDisplay: 'long' },
    ];
    for (const locale of LOCALES) {
      for (const formatOptions of options) {
        for (const value of [0, 1, 2, 5, 12, 0.25, -1234.25, 1234567]) {
          const text = formatNumber(value, { locale, formatOptions });
          const rounded = Number(new Intl.NumberFormat('en', { ...formatOptions, style: 'decimal', maximumFractionDigits: 20 }).format(value).replace(/,/g, ''));
          const expected = formatOptions.style === 'percent' ? value : formatOptions.style === 'currency' ? Math.round(value * 100) / 100 : rounded;
          expect(read(text, locale, formatOptions), `${locale} ${JSON.stringify(formatOptions)}: ${text}`).toBe(
            formatOptions.style === 'currency' && formatOptions.currency === 'JPY' ? Math.round(value) : expected,
          );
        }
      }
    }
  });
});

describe('isPartialNumber', () => {
  it('accepts what a number being typed has', () => {
    for (const text of ['', '-', '+', '.', '-.', '1', '1,', '1,23', '1.', '1.2', '12,345.678', ',5', '٣']) {
      expect(isPartialNumber(text, { locale: 'en' }), JSON.stringify(text)).toBe(true);
    }
    expect(isPartialNumber('1,', { locale: 'de' })).toBe(true);
    expect(isPartialNumber('1.', { locale: 'de' })).toBe(true);
  });

  it('refuses letters, a second decimal point and stray symbols', () => {
    for (const text of ['e', '1e', 'abc', '1.2.3', '1--', '1 2', '$', '12%', '1/2']) {
      expect(isPartialNumber(text, { locale: 'en' }), JSON.stringify(text)).toBe(false);
    }
  });

  it('accepts the percent, currency or unit a formatted number carries', () => {
    expect(isPartialNumber('₩12,0', { locale: 'ko', formatOptions: { style: 'currency', currency: 'KRW' } })).toBe(true);
    expect(isPartialNumber('12.5%', { locale: 'en', formatOptions: { style: 'percent' } })).toBe(true);
  });
});

describe('commitNumber', () => {
  it('snaps to the step from min, or from 0, then clamps', () => {
    expect(commitNumber(7, { step: 5 })).toBe(5);
    expect(commitNumber(8, { step: 5 })).toBe(10);
    expect(commitNumber(7, { min: 2, step: 5 })).toBe(7);
    expect(commitNumber(8, { min: 2, step: 5 })).toBe(7);
    expect(commitNumber(-3, { min: 0, max: 10 })).toBe(0);
    expect(commitNumber(30, { min: 0, max: 10 })).toBe(10);
  });

  it('leaves a value with no step as it is', () => {
    expect(commitNumber(1.23456, {})).toBe(1.23456);
    expect(commitNumber(1.23456, { min: 0, max: 5 })).toBe(1.23456);
  });

  it('goes to the highest point on the grid when max is off it', () => {
    expect(commitNumber(12, { min: 0, max: 10, step: 3 })).toBe(9);
    expect(commitNumber(100, { min: 1, max: 10, step: 4 })).toBe(9);
  });

  it('rounds to the decimals of the step and min, so 0.1 + 0.2 is 0.3', () => {
    expect(commitNumber(0.1 + 0.2, { step: 0.1 })).toBe(0.3);
    expect(commitNumber(0.1 + 0.2, { min: 0.05, step: 0.1 })).toBe(0.35);
    expect(commitNumber(1.005, { step: 0.005 })).toBe(1.005);
  });
});

describe('stepNumber', () => {
  it('steps from a value, snapping first', () => {
    expect(stepNumber(5, 1, { max: 99 })).toBe(6);
    expect(stepNumber(5, -10, { min: 0 })).toBe(0);
    expect(stepNumber(98, 10, { max: 99 })).toBe(99);
    expect(stepNumber(0.2, 0.1, { step: 0.1 })).toBe(0.3);
    expect(stepNumber(3.4, 1, { step: 1 })).toBe(4);
  });

  it('starts an increase from no value at min, or at the step', () => {
    expect(stepNumber(null, 1, { min: 3 })).toBe(3);
    expect(stepNumber(null, 5, {})).toBe(5);
    expect(stepNumber(null, -1, { min: 3 })).toBe(3);
    expect(stepNumber(null, -1, {})).toBe(-1);
  });
});
