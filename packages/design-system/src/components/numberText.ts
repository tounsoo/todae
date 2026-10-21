// Server-safe number text for Field.NumberInput and a text input beside any number: no hooks or context.
import { fold } from './dateText.js';

export type NumberTextOptions = {
  /** The locale, such as "de". The runtime's own when not set. */
  locale?: string;
  /** How the number is written, as `Intl.NumberFormat` takes it: style percent, currency or unit, and fraction digits. */
  formatOptions?: Intl.NumberFormatOptions;
};

const cache = /* @__PURE__ */ new Map<string, Intl.NumberFormat>();

// A decimal number keeps the digits it has, where Intl would round to three.
function withDigits(options: Intl.NumberFormatOptions = {}): Intl.NumberFormatOptions {
  const plain = (options.style ?? 'decimal') === 'decimal' && (options.notation ?? 'standard') === 'standard';
  const set = [
    options.maximumFractionDigits,
    options.maximumSignificantDigits,
    options.minimumSignificantDigits,
  ].some((digits) => digits !== undefined);
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
function decimalsOf(value: number): number {
  const [mantissa = '', exponent = '0'] = value.toExponential().split('e');
  return Math.max(0, (mantissa.split('.')[1]?.length ?? 0) - Number(exponent));
}

/**
 * A value as the field holds it: on the `step` grid, then within `min` and
 * `max`, with the decimals of the step and of `min` so that 0.1 + 0.2 is 0.3.
 * Where `max` is off the grid, the highest point on it. Without a `step`, a
 * value keeps all its digits.
 */
export function commitNumber(value: number, { min, max, step }: NumberRange): number {
  const grid = step !== undefined && step > 0 ? step : undefined;
  const base = min ?? 0;
  let result = value;
  if (grid !== undefined) {
    result = base + Math.round((value - base) / grid) * grid;
    if (max !== undefined && result > max) result = base + Math.floor(Number(((max - base) / grid).toPrecision(12))) * grid;
    if (min !== undefined && result < min) result = min;
    result = Number(result.toFixed(Math.min(100, Math.max(decimalsOf(grid), decimalsOf(base)))));
  } else {
    if (min !== undefined && result < min) result = min;
    if (max !== undefined && result > max) result = max;
  }
  return result + 0;
}

/**
 * The value `by` above or below `from`, committed. From no value, an increase
 * starts at `min`, or at `by` without one, and a decrease starts at `by`.
 */
export function stepNumber(from: number | null, by: number, range: NumberRange): number {
  if (from === null) return commitNumber(by > 0 && range.min !== undefined ? range.min : by, range);
  return commitNumber(commitNumber(from, range) + by, range);
}
