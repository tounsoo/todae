// Server-safe number text for Field.NumberInput and a text input beside any number: no hooks or context.
import { fold } from './dateText.js';

/** What `Intl.NumberFormat` takes, less what a commit can't follow: compact and scientific notation, which `parseNumber` can't read back, and significant digits and rounding options, which round the text differently from a commit. */
export type NumberFormatOptions = Omit<
  Intl.NumberFormatOptions,
  | 'notation'
  | 'compactDisplay'
  | 'maximumSignificantDigits'
  | 'minimumSignificantDigits'
  | 'roundingMode'
  | 'roundingIncrement'
  | 'roundingPriority'
>;

export type NumberTextOptions = {
  /** The locale, such as "de". The runtime's own when not set. */
  locale?: string;
  /** How the number is written, as `Intl.NumberFormat` takes it: style percent, currency or unit, and fraction digits. */
  formatOptions?: NumberFormatOptions;
};

const cache = /* @__PURE__ */ new Map<string, Intl.NumberFormat>();

// A decimal number keeps the digits it has, where Intl would round to three.
function withDigits(options: NumberFormatOptions = {}): NumberFormatOptions {
  const plain = (options.style ?? 'decimal') === 'decimal';
  // Not in the type, but a caller without it can pass significant digits.
  const { maximumSignificantDigits, minimumSignificantDigits } = options as Intl.NumberFormatOptions;
  const set = [options.maximumFractionDigits, maximumSignificantDigits, minimumSignificantDigits].some((digits) => digits !== undefined);
  if (!plain || set) return options;
  return { ...options, maximumFractionDigits: Math.max(20, options.minimumFractionDigits ?? 0) };
}

function formatterFor(options: NumberTextOptions) {
  const key = `${options.locale ?? ''}|${JSON.stringify(options.formatOptions ?? {})}`;
  let format = cache.get(key);
  if (!format) {
    format = new Intl.NumberFormat(options.locale, withDigits(options.formatOptions));
    cache.set(key, format);
  }
  return format;
}

/**
 * The number as `locale` writes it, such as `1,234.5` in en-US and `1.234,5`
 * in de. `formatOptions` sets the style, such as percent or currency, and the
 * digits; a plain number shows all the digits it has.
 */
export function formatNumber(value: number, options: NumberTextOptions = {}): string {
  return formatterFor(options).format(value);
}

type Symbols = {
  /** The separators, the first being the one a number is written with: a locale may group a currency with a different mark than a plain number. */
  groups: string[];
  decimals: string[];
  /** Text a formatted number carries besides its digits, such as a currency sign, a unit or a percent sign. */
  decoration: string[];
  percent: boolean;
  /** Digits in the last group of the integer part, and in the others. */
  primary: number;
  secondary: number;
};

const symbolCache = /* @__PURE__ */ new Map<string, Symbols>();

// Minus signs and apostrophes the way a locale or a keyboard writes them, as one each.
const canon = (text: string) => text.replace(/[−‐–—﹣]/g, '-').replace(/[’ʼ]/g, "'");

// The values whose parts show every word a number can take: plural forms of a unit, and a minus.
const SAMPLES = [-1234567.5, -1, 0, 0.5, 1, 2, 3, 5, 11, 21, 100];

function symbolsFor(options: NumberTextOptions): Symbols {
  const key = `${options.locale ?? ''}|${JSON.stringify(options.formatOptions ?? {})}`;
  let found = symbolCache.get(key);
  if (found) return found;
  const formatOptions = options.formatOptions ?? {};
  // The separators of a plain number, which has a decimal whatever the style. The style's own are added below.
  const plain = new Intl.NumberFormat(options.locale, {
    numberingSystem: formatOptions.numberingSystem,
    useGrouping: 'always',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const parts = plain.formatToParts(-1234567890123.5);
  const sizes = parts.filter((part) => part.type === 'integer').map((part) => part.value.length);
  const primary = sizes.length > 1 ? sizes.at(-1)! : 0;
  const secondary = sizes.length > 2 ? sizes.at(-2)! : primary;
  const styled = new Intl.NumberFormat(options.locale, { ...formatOptions, useGrouping: 'always' });
  const decoration = new Set<string>();
  const marks = { group: new Set<string>(), decimal: new Set<string>() };
  for (const part of parts) {
    if (part.type === 'group' || part.type === 'decimal') marks[part.type].add(canon(fold(part.value)));
  }
  for (const sample of SAMPLES) {
    for (const part of styled.formatToParts(sample)) {
      if (part.type === 'group' || part.type === 'decimal') marks[part.type].add(canon(fold(part.value)));
      if (part.type !== 'currency' && part.type !== 'unit' && part.type !== 'percentSign' && part.type !== 'literal') continue;
      const text = canon(fold(part.value)).trim();
      // A sign or a pair of parentheses is read as one, not stripped.
      if (text && !/^[()+-]+$/.test(text)) decoration.add(text);
    }
  }
  found = {
    groups: [...marks.group],
    decimals: marks.decimal.size ? [...marks.decimal] : ['.'],
    // Longer first, so "kilometers" goes before "kilometer".
    decoration: [...decoration].sort((a, b) => b.length - a.length),
    percent: formatOptions.style === 'percent',
    primary,
    secondary,
  };
  symbolCache.set(key, found);
  return found;
}

type Scan = { negative: boolean; groups: string[]; fraction: string | null };

// The digits of a text, or null when it is no number in the locale. `partial` allows what a number being typed has: no digits yet, and groups of any size.
function scan(text: string, options: NumberTextOptions, partial: boolean): Scan | null {
  const symbols = symbolsFor(options);
  let body = canon(fold(text));
  for (const word of symbols.decoration) body = body.split(word).join(' ');
  body = body.replace(/\s+/g, ' ').trim();
  let negative = false;
  // Accounting style writes a negative in parentheses.
  const paren = /^\((.*)\)$/.exec(body);
  if (paren) {
    negative = true;
    body = paren[1]!.trim();
  }
  const sign = /^([+-]) ?/.exec(body);
  if (sign) {
    negative ||= sign[1] === '-';
    body = body.slice(sign[0].length);
  }
  // One mark each: the others the style writes, and a period where the locale doesn't group or point with one, are the same.
  const [group = ''] = symbols.groups;
  const [decimal = '.'] = symbols.decimals;
  for (const mark of symbols.groups.slice(1)) body = body.split(mark).join(group);
  for (const mark of symbols.decimals.slice(1)) body = body.split(mark).join(decimal);
  if (!symbols.groups.includes('.') && !symbols.decimals.includes('.')) body = body.split('.').join(decimal);
  let integer = body;
  let fraction: string | null = null;
  const at = body.indexOf(decimal);
  if (at !== -1) {
    if (body.includes(decimal, at + 1)) return null;
    integer = body.slice(0, at);
    fraction = body.slice(at + decimal.length);
    if (!/^\d*$/.test(fraction)) return null;
  }
  const groups = group && integer.includes(group) ? integer.split(group) : [integer];
  if (groups.some((digits, index) => !/^\d*$/.test(digits) || (!partial && digits === '' && index > 0))) return null;
  if (groups.length > 1 && !partial) {
    const { primary, secondary } = symbols;
    const last = groups.length - 1;
    const ok = groups.every((digits, index) => {
      if (index === 0) return digits.length >= 1 && digits.length <= Math.max(primary, secondary);
      return index === last ? digits.length === primary : digits.length === secondary || digits.length === primary;
    });
    if (!ok) return null;
  }
  if (!partial && groups.join('') === '' && !fraction) return null;
  return { negative, groups, fraction };
}

/**
 * The number a text means in `locale`, such as `1.234,5` in de, or null when
 * it means none. Group separators are read only where the locale puts them,
 * and the text may leave out the percent sign, currency sign or unit that
 * `formatOptions` writes.
 */
export function parseNumber(text: string, options: NumberTextOptions = {}): number | null {
  const read = scan(text, options, false);
  if (!read) return null;
  const digits = `${read.negative ? '-' : ''}${read.groups.join('') || '0'}${read.fraction ? `.${read.fraction}` : ''}`;
  // A percent shifts the decimal point, so 0.07 stays 0.07, not 0.07000000000000001.
  const number = Number(symbolsFor(options).percent ? `${digits}e-2` : digits);
  return Number.isFinite(number) ? number + 0 : null;
}

/** Whether a text could become a number by more typing: a sign, digits, group separators and one decimal separator, in any amount. An empty text is. */
export function isPartialNumber(text: string, options: NumberTextOptions = {}): boolean {
  return scan(text, options, true) !== null;
}

/** The range a value must fall in, and the grid it must sit on, counted from `min`, or from 0 without one. */
export type NumberRange = { min?: number; max?: number; step?: number };

// How many decimals a number needs, such as 2 for 0.25 and 0 for 1e21.
export function decimalsOf(value: number): number {
  const [mantissa = '', exponent = '0'] = value.toExponential().split('e');
  return Math.max(0, (mantissa.split('.')[1]?.length ?? 0) - Number(exponent));
}

const roundTo = (value: number, decimals: number) => Number(value.toFixed(Math.min(100, decimals)));

// Half away from zero, as Intl rounds the text, where Math.round takes a tie toward +Infinity.
const nearest = (value: number) => Math.sign(value) * Math.round(Math.abs(value));

// The grid index of a value, with the same guard as the max line: 0.15 on a 0.1 grid is 1.4999999999999998 steps, and means 1.5.
const indexOf = (value: number, base: number, step: number) => Number(((value - base) / step).toPrecision(12));

const roundersByDigits = /* @__PURE__ */ new Map<number, Intl.NumberFormat>();

/** The decimals the text shows, as the value's own: a percent shows two fewer than the fraction has. Undefined where the text keeps every digit. */
export function shownDecimals(options: NumberTextOptions = {}): number | undefined {
  const resolved = formatterFor(options).resolvedOptions();
  // Significant digits round by magnitude, not by decimals, and are not supported.
  const digits = resolved.maximumFractionDigits;
  if (resolved.maximumSignificantDigits !== undefined || digits === undefined || digits >= 20) return undefined;
  return Math.min(100, digits + (options.formatOptions?.style === 'percent' ? 2 : 0));
}

// Rounded by Intl, as the text is, so 1.005 is 1.01 in both: `toFixed` reads the binary value and would say 1.00.
function roundToShown(value: number, options: NumberTextOptions): number {
  const decimals = shownDecimals(options);
  if (decimals === undefined) return value;
  let rounder = roundersByDigits.get(decimals);
  if (!rounder) {
    rounder = new Intl.NumberFormat('en', { useGrouping: false, maximumFractionDigits: decimals });
    roundersByDigits.set(decimals, rounder);
  }
  return Number(rounder.format(value));
}

// The grid point at `index` steps from `min`, or from 0.
const pointAt = (index: number, { min, step = 1 }: NumberRange) =>
  roundTo((min ?? 0) + index * step, Math.max(decimalsOf(step), decimalsOf(min ?? 0)));

/**
 * The lowest and highest value a commit can give: `min`, and `max`, or the
 * highest point of the `step` grid within it. A `max` below `min` gives way to
 * `min`. Undefined where there is no bound.
 */
export function boundsOf(range: NumberRange): { low?: number; high?: number } {
  const { min, max, step } = range;
  if (max === undefined) return { low: min };
  const base = min ?? 0;
  const high = step === undefined ? max : pointAt(Math.floor(indexOf(max, base, step)), range);
  return { low: min, high: min !== undefined && high < min ? min : high };
}

/**
 * A value as the field holds it, within `min` and `max`. With a `step` it is
 * the nearest point of the grid (a tie goes away from zero, as the text
 * rounds), with the decimals of the step and of `min` so that 0.1 + 0.2 is
 * 0.3; the grid wins over the text's digits. Without one it is rounded to the
 * decimals the text shows, so a currency or a percent holds what it says, and
 * with no digit options keeps all its digits. Where `max` is off the grid, the
 * highest point on it.
 */
export function commitNumber(value: number, range: NumberRange, text: NumberTextOptions = {}): number {
  const { step } = range;
  const { low, high } = boundsOf(range);
  let result = step === undefined ? roundToShown(value, text) : pointAt(nearest(indexOf(value, range.min ?? 0, step)), range);
  if (high !== undefined && result > high) result = high;
  if (low !== undefined && result < low) result = low;
  return result + 0;
}

/**
 * Whether a step of `by` from `from` changes anything, as a native input's
 * `stepUp` and `stepDown` find it: not from the bound it moves toward, nor
 * from a value outside the range, away from it. From no value, always.
 */
export function canStep(from: number | null, by: number, range: NumberRange): boolean {
  if (from === null) return true;
  const { low, high } = boundsOf(range);
  return by > 0 ? high === undefined || from < high : low === undefined || from > low;
}

/**
 * The value a step of `by` from `from` gives, committed. With a `step`, the
 * next point of the grid strictly beyond `from` in the direction of `by` (one
 * more per further step of `by`), so 2.5 up is 3 and 7 down by 5 is 5. Without
 * one, `from + by`, rounded to the decimals of the two so that 1.1 - 1 is 0.1.
 * From a value outside `min` and `max`, a step toward the range lands on the
 * bound. From no value, an increase starts at `min`, or at `by` without one,
 * and a decrease starts at `by`.
 */
export function stepNumber(from: number | null, by: number, range: NumberRange, text: NumberTextOptions = {}): number {
  if (from === null) return commitNumber(by > 0 && range.min !== undefined ? range.min : by, range, text);
  const { low, high } = boundsOf(range);
  if (by > 0 && low !== undefined && from < low) return low;
  if (by < 0 && high !== undefined && from > high) return high;
  const { step } = range;
  if (step === undefined) return commitNumber(roundTo(from + by, Math.max(decimalsOf(from), decimalsOf(by))), range, text);
  const index = indexOf(from, range.min ?? 0, step);
  const count = Math.max(1, Math.round(Math.abs(by) / step));
  return commitNumber(pointAt(by > 0 ? Math.floor(index) + count : Math.ceil(index) - count, range), range, text);
}
