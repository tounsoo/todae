import { describe, expect, it } from 'vitest';
import type { NumberFormatOptions } from './numberText.js';
import {
  boundsOf,
  canStep,
  commitNumber,
  formatNumber,
  isPartialNumber,
  onGrid,
  keypadFor,
  parseNumber,
  shownDecimals,
  stepNumber,
  UNSUPPORTED_FORMAT_OPTIONS,
} from './numberText.js';

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

  it('snaps with the guard the max line has, so 0.15 on a 0.1 grid is 0.2', () => {
    expect(commitNumber(0.15, { step: 0.1 })).toBe(0.2);
    expect(commitNumber(0.35, { step: 0.1 })).toBe(0.4);
    expect(commitNumber(1.005, { step: 0.01 })).toBe(1.01);
  });

  it('rounds to the digits the text shows, and to none where it shows all', () => {
    const usd = { locale: 'en', formatOptions: { style: 'currency', currency: 'USD' } } as const;
    expect(commitNumber(19.999, {}, usd)).toBe(20);
    expect(commitNumber(0.075, {}, { locale: 'en', formatOptions: { style: 'percent' } })).toBe(0.08);
    expect(commitNumber(1234.5, {}, { locale: 'ja', formatOptions: { style: 'currency', currency: 'JPY' } })).toBe(1235);
    expect(commitNumber(1.26, {}, { formatOptions: { maximumFractionDigits: 1 } })).toBe(1.3);
    expect(commitNumber(1.2345678, {}, { locale: 'en' })).toBe(1.2345678);
    expect(commitNumber(1.2345678, {}, { locale: 'en', formatOptions: { minimumFractionDigits: 2 } })).toBe(1.2345678);
  });

  it('gives way to min when max is below it, with or without a step', () => {
    expect(commitNumber(7, { min: 10, max: 5 })).toBe(10);
    expect(commitNumber(7, { min: 10, max: 5, step: 1 })).toBe(10);
  });

  it('rounds to the decimals of the step and min, so 0.1 + 0.2 is 0.3', () => {
    expect(commitNumber(0.1 + 0.2, { step: 0.1 })).toBe(0.3);
    expect(commitNumber(0.1 + 0.2, { min: 0.05, step: 0.1 })).toBe(0.35);
    expect(commitNumber(1.005, { step: 0.005 })).toBe(1.005);
  });
});

describe('commitNumber on a grid the text does not show', () => {
  const percent = { locale: 'en', formatOptions: { style: 'percent' } } as const;
  const yen = { locale: 'ja', formatOptions: { style: 'currency', currency: 'JPY' } } as const;

  it('lets the step win over the digits the text shows', () => {
    expect(commitNumber(0.075, { step: 0.005 }, percent)).toBe(0.075);
    expect(commitNumber(0.0775, { step: 0.005 }, percent)).toBe(0.08);
    expect(commitNumber(1.5, { step: 0.5 }, yen)).toBe(1.5);
    // The grid is nearest the typed value, not the value after the text's rounding: 2.46 is nearer 0 than 5.
    expect(commitNumber(2.46, { step: 5 }, { formatOptions: { maximumFractionDigits: 1 } })).toBe(0);
  });

  it('shows how many decimals a text shows, in the value\'s own terms', () => {
    expect(shownDecimals(percent)).toBe(2);
    expect(shownDecimals(yen)).toBe(0);
    expect(shownDecimals({ locale: 'en' })).toBeUndefined();
  });

  it('rounds a tie away from zero, for both signs, as the text does', () => {
    expect(commitNumber(2.5, { step: 1 })).toBe(3);
    expect(commitNumber(-2.5, { step: 1 })).toBe(-3);
    expect(commitNumber(7.5, { step: 5 })).toBe(10);
    expect(commitNumber(-7.5, { step: 5 })).toBe(-10);
    expect(commitNumber(-0.15, { step: 0.1 })).toBe(-0.2);
    expect(commitNumber(0.5, {}, { formatOptions: { maximumFractionDigits: 0 } })).toBe(1);
    expect(commitNumber(-0.5, {}, { formatOptions: { maximumFractionDigits: 0 } })).toBe(-1);
  });
});

describe('the step grid of a large number', () => {
  it('keeps the digits a double has: an index of 13 digits is not rounded to 12', () => {
    expect(commitNumber(12345678901.23, { step: 0.01 })).toBe(12345678901.23);
    expect(commitNumber(1234567890123, { step: 1 })).toBe(1234567890123);
    expect(commitNumber(1234567890123.4, { step: 1 })).toBe(1234567890123);
    expect(boundsOf({ min: 0, max: 12345678901.23, step: 0.01 })).toEqual({ low: 0, high: 12345678901.23 });
    expect(boundsOf({ max: 1234567890123, step: 1 })).toEqual({ low: undefined, high: 1234567890123 });
  });

  it('still reads float error as the tie it is', () => {
    expect(commitNumber(0.15, { step: 0.1 })).toBe(0.2);
    expect(commitNumber(0.3, { step: 0.1 })).toBe(0.3);
    expect(commitNumber(1.005, { step: 0.01 })).toBe(1.01);
    expect(commitNumber(0.7, { step: 0.1 })).toBe(0.7);
  });
});

describe('the step grid beyond 15 digits', () => {
  it('commits an exact 16-digit value unchanged, as it does with no step', () => {
    expect(commitNumber(1234567890123456, { step: 1 })).toBe(1234567890123456);
    expect(commitNumber(Number.MAX_SAFE_INTEGER, { step: 1 })).toBe(Number.MAX_SAFE_INTEGER);
    expect(commitNumber(12345678901234.56, { step: 0.01 })).toBe(12345678901234.56);
  });

  it('never lands above max', () => {
    expect(commitNumber(5e15, { max: 1234567890123456, step: 1 })).toBe(1234567890123456);
    expect(boundsOf({ max: 1234567890123456, step: 1 })).toEqual({ low: undefined, high: 1234567890123456 });
    // Above 2^53 a double holds no point between, so a point past `max` is never handed back.
    for (const max of [32506050087487, 660362327190000, 7620026433952.68]) {
      expect(boundsOf({ max, step: 0.0001 }).high, String(max)).toBe(max);
      expect(commitNumber(max, { max, step: 0.0001 }), String(max)).toBe(max);
    }
    const off = Number('32506050087487.00005');
    expect(boundsOf({ max: off, step: 0.0001 }).high).toBeLessThanOrEqual(off);
  });

  it('steps from a 16-digit value, and finds no step where a double has no next point', () => {
    expect(stepNumber(1234567890123456, 1, { step: 1 })).toBe(1234567890123457);
    expect(canStep(1234567890123456, 1, { step: 1 })).toBe(true);
    expect(canStep(2 ** 53, 1, { step: 1 })).toBe(false);
    expect(stepNumber(2 ** 53, 1, { step: 1 })).toBe(2 ** 53);
  });
});

describe('stepNumber with no step and a format that shows digits', () => {
  it('goes to the next shown unit beyond the draft, not past it', () => {
    const percent = { formatOptions: { style: 'percent' as const } };
    expect(stepNumber(0.075, 0.01, {}, percent)).toBe(0.08);
    expect(stepNumber(0.075, -0.01, {}, percent)).toBe(0.07);
    expect(stepNumber(0.07, 0.01, {}, percent)).toBe(0.08);
    const usd = { locale: 'en', formatOptions: { style: 'currency' as const, currency: 'USD' } };
    expect(stepNumber(2.505, 1, {}, usd)).toBe(3.5);
    expect(stepNumber(1.1, 1, {}, usd)).toBe(2.1);
  });
});

describe('keypadFor', () => {
  it('is numeric for a whole grid from 0 or more, in a format that shows no fraction digits or keeps every digit', () => {
    expect(keypadFor({ min: 0, step: 1 })).toBe('numeric');
    expect(keypadFor({ min: 0, step: 5, shown: 0 })).toBe('numeric');
    expect(keypadFor({ min: 1, step: 1, shown: undefined })).toBe('numeric');
  });

  it('is decimal for any other min of 0 or more', () => {
    expect(keypadFor({ min: 0, step: 1, shown: 2 })).toBe('decimal');
    expect(keypadFor({ min: 0, step: 0.5 })).toBe('decimal');
    expect(keypadFor({ min: 0 })).toBe('decimal');
    expect(keypadFor({ min: 0.5, step: 1 })).toBe('decimal');
  });

  it('is text with no min of 0 or more, since the number keypads have no minus key', () => {
    expect(keypadFor({})).toBe('text');
    expect(keypadFor({ min: -1, step: 1 })).toBe('text');
    expect(keypadFor({ step: 1, shown: 0 })).toBe('text');
  });

  it('follows the format of a locale through shownDecimals', () => {
    expect(keypadFor({ min: 0, step: 1, shown: shownDecimals({ locale: 'en' }) })).toBe('numeric');
    expect(keypadFor({ min: 0, step: 1, shown: shownDecimals({ locale: 'en', formatOptions: { style: 'currency', currency: 'USD' } }) })).toBe('decimal');
    expect(keypadFor({ min: 0, step: 1, shown: shownDecimals({ locale: 'ja', formatOptions: { style: 'currency', currency: 'JPY' } }) })).toBe('numeric');
    expect(keypadFor({ min: 0, step: 1, shown: shownDecimals({ locale: 'en', formatOptions: { style: 'percent' } }) })).toBe('decimal');
  });
});

describe('boundsOf and canStep', () => {
  it('takes the clean grid point for a max that carries float noise', () => {
    const range = { min: 0, max: 0.1 + 0.2, step: 0.1 };
    expect(boundsOf(range).high).toBe(0.3);
    expect(commitNumber(5, range)).toBe(0.3);
    expect(canStep(0.3, 0.1, range)).toBe(false);
    expect(boundsOf({ max: 1.1 * 3, step: 0.1 }).high).toBe(3.3);
  });

  it('finds the highest and lowest value a commit can give', () => {
    expect(boundsOf({})).toEqual({ low: undefined });
    expect(boundsOf({ min: 0, max: 10, step: 3 })).toEqual({ low: 0, high: 9 });
    expect(boundsOf({ min: 1, max: 10 })).toEqual({ low: 1, high: 10 });
    expect(boundsOf({ min: 10, max: 5, step: 1 })).toEqual({ low: 10, high: 10 });
    expect(boundsOf({ max: 0.35, step: 0.1 })).toEqual({ low: undefined, high: 0.3 });
  });

  it('finds no step at the bound it moves toward, and none away from outside the range', () => {
    const range = { min: 0, max: 10, step: 3 };
    expect(canStep(9, 1, range)).toBe(false);
    expect(canStep(9, -1, range)).toBe(true);
    expect(canStep(0, -1, range)).toBe(false);
    expect(canStep(0, 1, range)).toBe(true);
    // Off the grid, above the highest point.
    expect(canStep(9.5, 1, range)).toBe(false);
    expect(canStep(150, 1, { max: 100 })).toBe(false);
    expect(canStep(150, -1, { max: 100 })).toBe(true);
    expect(canStep(-4, -1, { min: 0 })).toBe(false);
    expect(canStep(-4, 1, { min: 0 })).toBe(true);
    expect(canStep(null, 1, range)).toBe(true);
    expect(canStep(5, 1, {})).toBe(true);
  });
});

describe('a grid read at large operands', () => {
  // value - base cancels digits, and a small step multiplies the error: 100.3 from 100 by 0.1 is 2.9999999999999716 steps.
  const cases: [number, number, number][] = [
    [100, 0.1, 100.3],
    [100, 0.1, 100.7],
    [1000, 0.01, 1000.05],
    [1000, 0.01, 1000.07],
    [1000, 0.01, 1000.15],
    [14.63, 0.005, 15.045],
    [10000, 0.01, 10000.05],
  ];
  it.each(cases)('min %s, step %s: %s is on the grid and steps both ways', (min, step, at) => {
    const range = { min, step };
    expect(onGrid(at, range)).toBe(true);
    expect(canStep(at, step, range)).toBe(true);
    expect(canStep(at, -step, range)).toBe(true);
    expect(stepNumber(at, step, range)).toBeGreaterThan(at);
    expect(stepNumber(at, -step, range)).toBeLessThan(at);
    expect(commitNumber(at, range)).toBe(at);
  });

  it('still finds a value that is off the grid off it', () => {
    expect(onGrid(100.35, { min: 100, step: 0.1 })).toBe(false);
    expect(onGrid(100.30001, { min: 100, step: 0.1 })).toBe(false);
    expect(commitNumber(100.35, { min: 100, step: 0.1 })).toBe(100.4);
  });
});

describe('boundsOf with a max that carries noise below a grid point', () => {
  it('gives the clean grid point, which a commit can reach', () => {
    const max = 0.3 - 0.1;
    expect(boundsOf({ min: 0, max, step: 0.1 }).high).toBe(0.2);
    expect(commitNumber(5, { min: 0, max, step: 0.1 })).toBe(0.2);
    expect(boundsOf({ max: 1.1 - 0.2, step: 0.1 }).high).toBe(0.9);
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

  it('rounds the sum to the decimals of the value and the step, with no step too', () => {
    expect(stepNumber(1.1, -1, {})).toBe(0.1);
    expect(stepNumber(0.1, 0.2, {})).toBe(0.3);
    expect(stepNumber(stepNumber(0.3, -1, {}), 1, {})).toBe(0.3);
    expect(stepNumber(1e21, 1, {})).toBe(1e21);
  });

  it('lands on the bound first from outside the range', () => {
    expect(stepNumber(150, -1, { max: 100 })).toBe(100);
    expect(stepNumber(150, -1, { max: 100, step: 7 })).toBe(98);
    expect(stepNumber(-3, 1, { min: 0 })).toBe(0);
    expect(stepNumber(-3, 1, { min: 0, step: 5 })).toBe(0);
    expect(stepNumber(9, 3, { min: 0, max: 10, step: 3 })).toBe(9);
  });

  it('goes to the next point of the grid beyond an off-grid value, in the direction of the step', () => {
    expect(stepNumber(2.5, 1, { step: 1 })).toBe(3);
    expect(stepNumber(2.5, -1, { step: 1 })).toBe(2);
    expect(stepNumber(7, -5, { step: 5 })).toBe(5);
    expect(stepNumber(7, 5, { step: 5 })).toBe(10);
    expect(stepNumber(13, 5, { step: 5 })).toBe(15);
    expect(stepNumber(13, -5, { step: 5 })).toBe(10);
    expect(stepNumber(15, 5, { step: 5 })).toBe(20);
    expect(stepNumber(0.15, 0.1, { step: 0.1 })).toBe(0.2);
    expect(stepNumber(-2.5, 1, { step: 1 })).toBe(-2);
    expect(stepNumber(-2.5, -1, { step: 1 })).toBe(-3);
    expect(stepNumber(3, 1, { min: 2, step: 5 })).toBe(7);
    // A page step moves more of them: the first is the next point, as for a single step.
    expect(stepNumber(13, 50, { step: 5 })).toBe(60);
    expect(stepNumber(15, -50, { step: 5 })).toBe(-35);
  });

  it('steps a percent down from 8% on a finer grid than the text shows', () => {
    const percent = { locale: 'en', formatOptions: { style: 'percent' } } as const;
    expect(stepNumber(0.08, -0.005, { step: 0.005 }, percent)).toBe(0.075);
    expect(stepNumber(0.08, -0.01, {}, percent)).toBe(0.07);
    expect(stepNumber(1, 0.5, { step: 0.5 }, { locale: 'ja', formatOptions: { style: 'currency', currency: 'JPY' } })).toBe(1.5);
  });

  it('starts an increase from no value at min, or at the step', () => {
    expect(stepNumber(null, 1, { min: 3 })).toBe(3);
    expect(stepNumber(null, 5, {})).toBe(5);
    expect(stepNumber(null, -1, { min: 3 })).toBe(3);
    expect(stepNumber(null, -1, {})).toBe(-1);
  });
});

describe('format and parse', () => {
  const STYLES: Intl.NumberFormatOptions[] = [
    {},
    { minimumFractionDigits: 2 },
    { maximumFractionDigits: 0 },
    { maximumFractionDigits: 1 },
    { useGrouping: false },
    { style: 'percent' },
    { style: 'percent', maximumFractionDigits: 1 },
    { style: 'currency', currency: 'USD' },
    { style: 'currency', currency: 'EUR', currencyDisplay: 'code' },
    { style: 'currency', currency: 'JPY' },
    { style: 'currency', currency: 'USD', currencySign: 'accounting' },
    { style: 'unit', unit: 'kilometer', unitDisplay: 'long' },
    { style: 'unit', unit: 'celsius' },
  ];
  const SAMPLE_LOCALES = ['en-US', 'de', 'fr', 'de-CH', 'hi-IN', 'ar-EG', 'ja', 'ko', 'sv', 'es'];

  it('reads back the committed value of every supported format, as the text shows it', () => {
    for (const locale of SAMPLE_LOCALES) {
      for (const formatOptions of STYLES) {
        for (const typed of [0, 1, -1, 19.999, 0.075, 1234.5, -1234.567, 1234567.891, 0.005, 12]) {
          const text = { locale, formatOptions };
          const committed = commitNumber(typed, {}, text);
          const shown = formatNumber(committed, text);
          expect(read(shown, locale, formatOptions), `${locale} ${JSON.stringify(formatOptions)} ${typed}: ${shown}`).toBe(committed);
        }
      }
    }
  });
});

describe('NumberFormatOptions', () => {
  it('rejects the options a commit does not round by, and the notations parseNumber cannot read', () => {
    const options: NumberFormatOptions[] = [
      // @ts-expect-error significant digits round by magnitude
      { maximumSignificantDigits: 2 },
      // @ts-expect-error significant digits round by magnitude
      { minimumSignificantDigits: 2 },
      // @ts-expect-error a rounding mode is not the commit's
      { roundingMode: 'floor' },
      // @ts-expect-error a rounding increment is not the commit's
      { roundingIncrement: 5 },
      // @ts-expect-error a rounding priority is not the commit's
      { roundingPriority: 'morePrecision' },
      // @ts-expect-error compact notation can't be read back
      { notation: 'compact' },
      { maximumFractionDigits: 1 },
    ];
    expect(options).toHaveLength(7);
  });

  it('names the same options at runtime', () => {
    expect([...UNSUPPORTED_FORMAT_OPTIONS].sort()).toEqual(
      ['compactDisplay', 'maximumSignificantDigits', 'minimumSignificantDigits', 'notation', 'roundingIncrement', 'roundingMode', 'roundingPriority'],
    );
  });
});
