// Server-safe number text for Field.NumberInput and a text input beside any number: no hooks or context.
import { fold } from './foldText.js';

/** The options a commit can't follow: compact and scientific notation, which `parseNumber` can't read back, and significant digits and rounding options, which round the text differently from a commit. */
export const UNSUPPORTED_FORMAT_OPTIONS = [
  'notation',
  'compactDisplay',
  'maximumSignificantDigits',
  'minimumSignificantDigits',
  'roundingMode',
  'roundingIncrement',
  'roundingPriority',
] as const;

/** What `Intl.NumberFormat` takes, less `UNSUPPORTED_FORMAT_OPTIONS`. */
export type NumberFormatOptions = Omit<Intl.NumberFormatOptions, (typeof UNSUPPORTED_FORMAT_OPTIONS)[number]>;

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

// What a locale and its format options key the caches by.
const keyOf = (options: NumberTextOptions) => `${options.locale ?? ''}|${JSON.stringify(options.formatOptions ?? {})}`;

function formatterFor(options: NumberTextOptions) {
  const key = keyOf(options);
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
  /** Whether the format writes a negative in parentheses. */
  accounting: boolean;
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
  const key = keyOf(options);
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
    accounting: formatOptions.currencySign === 'accounting',
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
  } else if (partial && symbols.accounting && body.startsWith('(')) {
    // The pair is not closed yet, or its closing one was deleted.
    negative = true;
    body = body.slice(1).trim();
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

// The spacing of doubles at `value`, which a number read from text can be off by half of.
const ulp = (value: number) => (value === 0 || !Number.isFinite(value) ? 0 : 2 ** (Math.floor(Math.log2(Math.abs(value))) - 52));

// How far the operands' own rounding can move a quotient `(value - base) / step`, in steps: each operand is off by up to half its ulp, and the subtraction and the division by up to an ulp of the quotient. A fixed number of digits cannot follow it (100.3 on a 0.1 grid from 100 is 2.9999999999999716 steps).
const noise = (value: number, base: number, step: number, raw: number) =>
  (ulp(value) / 2 + ulp(base) / 2) / step + Number.EPSILON * Math.abs(raw);

// The grid index of a value. An index within twice that noise of a whole number, and at most a quarter step, is that number, so a value on the grid reads as on it at any operand. Up to about 3e14 steps from the base a value a fifth of a step off the grid never does; past that the noise term nears the quarter-step cap, and a value up to a quarter step off reads as on it, so past about 4e14 steps the window can disagree with the browser's stepMismatch. An index within the noise itself of a half is that half, so a tie reads as one (100.35 from 100 by 0.1 is 3.4999999999999716 steps, and means 3.5), and one a few doubles below a half stays below it. Any other index gets the 15-digit guard of the max line, where that moves it by no more than twice the noise (past 1e14 it would drop the fraction): 0.15 on a 0.1 grid is 1.4999999999999998 steps, and means 1.5, and 12345678901.23 on a 0.01 grid is not whole at 16 digits. A whole index is exact as it is. Past 1e15 steps the window still applies, since a double's error there is larger than the decimal grid point it should match (100000000000000.1 on a 0.1 grid). One ulp of the value passes half a step near 2.8e14 in value on a 0.1 grid, where some grid points have no double of their own and a step lands on the nearest double beyond the value. From an index of 2^53 (about 9e14 in value on a 0.1 grid) the index itself is no longer a count, and `stepNumber` steps no further.
function indexOf(value: number, base: number, step: number): number {
  const raw = (value - base) / step;
  if (Number.isInteger(raw)) return raw;
  const error = noise(value, base, step, raw);
  const whole = Math.round(raw);
  if (Math.abs(raw - whole) <= Math.min(0.25, 2 * error)) return whole;
  const half = Math.round(raw * 2) / 2;
  if (Math.abs(raw - half) <= Math.min(0.25, error)) return half;
  const guarded = Number(raw.toPrecision(15));
  return Math.abs(guarded - raw) <= 2 * error ? guarded : raw;
}

/** Whether a value sits on the `step` grid, counted from `min`, or from 0 without one. True with no `step`. */
export function onGrid(value: number, { min, step }: NumberRange): boolean {
  return step === undefined || Number.isInteger(indexOf(value, min ?? 0, step));
}

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

/**
 * The keypad a phone shows: `numeric` for a whole grid from a `min` of 0 or
 * more in a format that shows no fraction digits (`shown` is 0, or undefined
 * where the text keeps every digit), `decimal` for any other `min` of 0 or
 * more, and `text` otherwise, since the number keypads have no minus key and
 * the digit one no separator.
 */
export function keypadFor({ min, step, shown }: { min?: number; step?: number; shown?: number }): 'numeric' | 'decimal' | 'text' {
  if (min === undefined || min < 0) return 'text';
  return step !== undefined && Number.isInteger(step) && Number.isInteger(min) && !shown ? 'numeric' : 'decimal';
}

// The grid point at `index` steps from `min`, or from 0.
const pointAt = (index: number, { min, step = 1 }: NumberRange) =>
  roundTo((min ?? 0) + index * step, Math.max(decimalsOf(step), decimalsOf(min ?? 0)));

// The grid point nearest a value, a tie going to the point with the larger absolute value, so it is "away from zero" in the value and not in the index: the index counts from `min`, and a negative `min` puts the zero inside the grid.
function nearestPoint(value: number, range: NumberRange, step: number): number {
  const index = indexOf(value, range.min ?? 0, step);
  const below = Math.floor(index);
  const fraction = index - below;
  if (fraction === 0) return pointAt(below, range);
  const lower = pointAt(below, range);
  const upper = pointAt(below + 1, range);
  if (fraction !== 0.5) return fraction < 0.5 ? lower : upper;
  return Math.abs(upper) >= Math.abs(lower) ? upper : lower;
}

/**
 * The lowest and highest value a commit can give: `min`, and `max`, or the
 * highest point of the `step` grid within it. A `max` below `min` gives way to
 * `min`. Undefined where there is no bound.
 */
export function boundsOf(range: NumberRange): { low?: number; high?: number } {
  const { min, max, step } = range;
  if (max === undefined) return { low: min };
  const base = min ?? 0;
  let high = max;
  if (step !== undefined) {
    // The clean grid point first, so a `max` carrying float noise (0.1 + 0.2) gives 0.3, not 0.30000000000000004.
    let index = Math.floor(indexOf(max, base, step));
    high = pointAt(index, range);
    if (high > max) {
      // A `max` on the grid within the error bound of a point (0.3 - 0.1 on a 0.1 grid) has that clean point as its answer, so no commit carries the noise. A point further past `max` comes from a grid too fine for a double: where `max` is on the grid it is the answer, and above 1e15 the grid is only as exact as a double, so a whole quotient counts as on it. Otherwise step back, and where a double holds no lower point, take `max` itself.
      if (onGrid(max, range)) high = high - max <= Math.min(0.25, 2 * noise(max, base, step, (max - base) / step)) * step ? high : max;
      else {
        while (high > max) {
          const lower = pointAt(index - 1, range);
          if (lower >= high) {
            high = max;
            break;
          }
          index -= 1;
          high = lower;
        }
      }
    }
  }
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
  // Without a step the text's digits round, by Intl as the text is, not by the grid path: the grid's 15-digit guard rounds some values differently (17040975.57257498 shown to 5 decimals is .57257 by Intl, .57258 by the guard), and the text is what the person sees.
  let result = step === undefined ? roundToShown(value, text) : nearestPoint(value, range, step);
  // Past the largest double no grid point is finite (and a percent's text for Infinity reads back as NaN), so the value stays as it is, or is the largest number there is.
  if (!Number.isFinite(result)) result = Number.isFinite(value) ? value : value > 0 ? Number.MAX_VALUE : value < 0 ? -Number.MAX_VALUE : 0;
  if (high !== undefined && result > high) result = high;
  if (low !== undefined && result < low) result = low;
  return result + 0;
}

/**
 * Whether a step of `by` from `from` changes anything, as a native input's
 * `stepUp` and `stepDown` find it: not from the bound it moves toward, nor
 * from a value outside the range, away from it, nor where a double has no
 * next grid point. From no value, always.
 */
export function canStep(from: number | null, by: number, range: NumberRange, text: NumberTextOptions = {}): boolean {
  if (from === null) return true;
  const { low, high } = boundsOf(range);
  if (by > 0 ? high !== undefined && from >= high : low !== undefined && from <= low) return false;
  return stepNumber(from, by, range, text) !== from;
}

/**
 * The value a step of `by` from `from` gives, committed. With a `step`, the
 * next point of the grid strictly beyond `from` in the direction of `by` (one
 * more per further step of `by`), so 2.5 up is 3 and 7 down by 5 is 5. Without
 * one, the same on the unit the text shows (a percent: 0.01), or, where it
 * keeps every digit, `from + by` rounded to the decimals of the two so that
 * 1.1 - 1 is 0.1.
 * From a value outside `min` and `max`, a step toward the range lands on the
 * bound. From no value, an increase starts at `min`, or at `by` without one,
 * and a decrease starts at `by`. A step never lands on the wrong side of
 * `from`: where the grid index is past 2^53, or no double holds a next point,
 * it gives `from` back, so `canStep` is false and the buttons disable.
 */
export function stepNumber(from: number | null, by: number, range: NumberRange, text: NumberTextOptions = {}): number {
  if (from === null) return commitNumber(by > 0 && range.min !== undefined ? range.min : by, range, text);
  const { low, high } = boundsOf(range);
  if (by > 0 && low !== undefined && from < low) return low;
  if (by < 0 && high !== undefined && from > high) return high;
  const { step } = range;
  const shown = step === undefined ? shownDecimals(text) : undefined;
  // A step that leaves the doubles changes nothing, rather than reaching Infinity or NaN.
  const finite = (next: number) => (Number.isFinite(next) ? commitNumber(next, range, text) : from);
  if (step === undefined && shown === undefined) {
    return finite(roundTo(from + by, Math.max(decimalsOf(from), decimalsOf(by))));
  }
  // With no step, the grid is the unit the text shows, so a draft of 7.5% goes to 8%, not past it.
  const unit = step ?? Number('1e-' + shown!);
  const index = indexOf(from, step === undefined ? 0 : (range.min ?? 0), unit);
  const count = Math.max(1, Math.round(Math.abs(by) / unit));
  const grid = step === undefined ? { step: unit } : range;
  // Past 2^53 steps from the base a double cannot count the grid, so no index names a next point: no step.
  if (!Number.isSafeInteger(Math.floor(index))) return from;
  let target = by > 0 ? Math.floor(index) + count : Math.ceil(index) - count;
  const beyond = (next: number) => (by > 0 ? next > from : next < from);
  // The committed value is what must lie strictly beyond `from`: a commit counts the grid again by division, and can land back on `from` from a point that is beyond it. A few tries, since where no double holds the next point there is none to find, and then the value stays, never a point on the wrong side.
  let next = finite(pointAt(target, grid));
  for (let tries = 0; tries < 4 && !beyond(next); tries++) {
    target += by > 0 ? 1 : -1;
    next = finite(pointAt(target, grid));
  }
  return beyond(next) ? next : from;
}
