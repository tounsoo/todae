import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ThemeColorValue, ThemeOverride } from '@tounsoo/todae';
import { apcaContrast, compositeSrgb, oklchToSrgb, type Rgb, type Rgba } from '../../../../packages/design-system/src/color/apca';
import { PRESETS } from './presets';

const STEP = 0.005;
const MODES = ['light', 'dark'] as const;

type Mode = (typeof MODES)[number];
type Oklch = { l: number; c: number; h: number; alpha: number };
type Row = { path: string; context: string | null; ref: string | null; cssVar: string; cssValue: string };
/** One measured pair: a translucent `bg` is composited over `over`, an opaque one is measured as is. */
type Pair = { fg: string; bg: string; min: number; over?: string };

type Fix = { path: string; from: number; to: number; lc: number };

const DENSITY = new Set(['compact', 'spacious']);
const APPEARANCE = new Set(['light', 'dark']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function declaredPairs(declarer: unknown, name: string): Pair[] {
  const extensions = isRecord(declarer) ? declarer.$extensions : undefined;
  if (!isRecord(extensions) || !isRecord(extensions['dev.todae']) || !Array.isArray(extensions['dev.todae'].contrast)) {
    throw new Error(`resolver.json ${name} has no contrast list`);
  }
  return extensions['dev.todae'].contrast.flatMap((entry: unknown) => {
    if (!isRecord(entry) || typeof entry.fg !== 'string' || typeof entry.bg !== 'string' || typeof entry.min !== 'number') {
      throw new Error(`resolver.json ${name} contrast entry is missing fg, bg, or min`);
    }
    const { fg, bg, min } = entry;
    if (entry.over === undefined) return [{ fg, bg, min }];
    if (!Array.isArray(entry.over) || !entry.over.every((surface) => typeof surface === 'string')) {
      throw new Error(`resolver.json ${name} contrast entry ${fg} on ${bg} has a bad over list`);
    }
    return (entry.over as string[]).map((over) => ({ fg, bg, min, over }));
  });
}

const SURFACES = ['popover.bg', 'color.bg.canvas', 'color.bg.surface', 'color.bg.subtle', 'color.bg.elevated'];

/**
 * Pairs a preset sets that Todae's contract does not list, measured as the
 * contract's would be. A calendar range's text sits on a translucent tint,
 * like a selected option's, inside a picker popover or on the page.
 */
export const PLAYGROUND_PAIRS: readonly Pair[] = SURFACES.map((over) => ({ fg: 'calendar.day.fg.range', bg: 'calendar.day.bg.range', min: 60, over }));

/** The pairs the token build checks, the contract set's and the appearance modifier's, one per surface under a translucent background, then the Playground's own. */
function contractPairs(resolver: unknown): Pair[] {
  if (!isRecord(resolver) || !isRecord(resolver.sets) || !isRecord(resolver.modifiers)) throw new Error('resolver.json has no sets or modifiers');
  return [
    ...declaredPairs(resolver.sets.contract, 'contract set'),
    ...declaredPairs(resolver.modifiers.appearance, 'appearance modifier'),
    ...PLAYGROUND_PAIRS,
  ];
}

function tokenRows(catalog: unknown): Row[] {
  if (!isRecord(catalog) || !Array.isArray(catalog.tokens)) throw new Error('tokens.generated.json has no tokens array');
  return catalog.tokens.map((entry) => {
    if (!isRecord(entry) || typeof entry.path !== 'string' || typeof entry.cssVar !== 'string' || typeof entry.cssValue !== 'string') {
      throw new Error('tokens.generated.json has a row without path, cssVar or cssValue');
    }
    if (entry.context !== null && typeof entry.context !== 'string') throw new Error(`token ${entry.path} has a bad context`);
    if (entry.ref !== null && typeof entry.ref !== 'string') throw new Error(`token ${entry.path} has a bad ref`);
    return { path: entry.path, context: entry.context, ref: entry.ref, cssVar: entry.cssVar, cssValue: entry.cssValue };
  });
}

function parseOklch(css: string): Oklch | null {
  const match = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)$/.exec(css);
  if (!match) return null;
  return { l: Number(match[1]), c: Number(match[2]), h: Number(match[3]), alpha: match[4] ? Number(match[4]) : 1 };
}

function overrideColor(value: ThemeOverride[keyof ThemeOverride] | undefined): Oklch | null {
  if (!value || Array.isArray(value) || typeof value !== 'object' || !('colorSpace' in value) || value.colorSpace !== 'oklch') {
    return null;
  }
  const [l, c, h] = value.components;
  return { l, c, h, alpha: value.alpha ?? 1 };
}

function sharedRow(row: Row, path: string): boolean {
  if (row.path !== path || (row.context !== null && DENSITY.has(row.context))) return false;
  return row.context === null || !APPEARANCE.has(row.context);
}

function rowFor(path: string, mode: Mode, rows: readonly Row[]): Row {
  const row = rows.find((item) => item.path === path && item.context === mode) ?? rows.find((item) => sharedRow(item, path));
  if (!row) throw new Error(`no ${path}`);
  return row;
}

// A tint such as color.bg.selected: its ref's channels with an alpha of its own, a number or an opacity token.
const RELATIVE_ALPHA = /^oklch\(from var\(--[\w-]+\) l c h \/ (?:var\((--[\w-]+)\)|([\d.]+))\)$/;

function resolveNumber(cssVar: string, mode: Mode, overrides: ThemeOverride, rows: readonly Row[]): number {
  const row = rows.find((item) => item.cssVar === cssVar);
  if (!row) throw new Error(`no ${cssVar}`);
  const overridden = overrides[row.path as keyof ThemeOverride];
  if (typeof overridden === 'number') return overridden;
  const value = Number(rowFor(row.path, mode, rows).cssValue);
  if (Number.isNaN(value)) throw new Error(`unparsed ${row.path}`);
  return value;
}

function resolveColor(path: string, mode: Mode, overrides: ThemeOverride, rows: readonly Row[], depth = 0): Oklch {
  if (depth > 30) throw new Error(`loop ${path}`);
  const overridden = overrideColor(overrides[path as keyof ThemeOverride]);
  if (overridden) return overridden;
  const row = rowFor(path, mode, rows);
  if (row.ref) {
    const color = resolveColor(row.ref, mode, overrides, rows, depth + 1);
    if (/^var\(--[\w-]+\)$/.test(row.cssValue)) return color;
    const relative = RELATIVE_ALPHA.exec(row.cssValue);
    if (!relative) throw new Error(`unparsed ${path} ${row.cssValue}`);
    return { ...color, alpha: relative[1] ? resolveNumber(relative[1], mode, overrides, rows) : Number(relative[2]) };
  }
  const color = parseOklch(row.cssValue);
  if (!color) throw new Error(`unparsed ${path} ${row.cssValue}`);
  return color;
}

function toTheme(color: Oklch): ThemeColorValue {
  const value: ThemeColorValue = { colorSpace: 'oklch', components: [color.l, color.c, color.h] };
  if (color.alpha !== 1) value.alpha = color.alpha;
  return value;
}

function rgba(color: Oklch): Rgba {
  return [...oklchToSrgb(color), color.alpha];
}

function pairLc(pair: Pair, mode: Mode, overrides: ThemeOverride, rows: readonly Row[]): number {
  // As the token build does: a translucent background over its listed surface, and every other one opaque.
  const back = resolveColor(pair.bg, mode, overrides, rows);
  let bg: Rgb;
  if (pair.over === undefined) {
    if (back.alpha !== 1) throw new Error(`"${pair.bg}" must be opaque, or list the surfaces it sits on in "over"`);
    bg = oklchToSrgb(back);
  } else {
    const surface = resolveColor(pair.over, mode, overrides, rows);
    if (surface.alpha !== 1) throw new Error(`surface "${pair.over}" under "${pair.bg}" must be opaque`);
    bg = compositeSrgb(rgba(back), oklchToSrgb(surface));
  }
  const fg = compositeSrgb(rgba(resolveColor(pair.fg, mode, overrides, rows)), bg);
  return Math.abs(apcaContrast(fg, bg));
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}

function formatLightness(value: number): string {
  return String(round3(value));
}

function nearestFix(side: 'fg' | 'bg', pair: Pair, mode: Mode, overrides: ThemeOverride, rows: readonly Row[]): Fix | null {
  const path = pair[side];
  const current = resolveColor(path, mode, overrides, rows);
  const from = current.l;
  for (let step = 1; step <= 200; step++) {
    for (const raw of [from - step * STEP, from + step * STEP]) {
      const to = round3(raw);
      if (to < 0 || to > 1 || to === round3(from)) continue;
      const next: ThemeOverride = { ...overrides, [path]: toTheme({ ...current, l: to }) };
      const lc = pairLc(pair, mode, next, rows);
      if (lc >= pair.min) return { path, from, to, lc };
    }
  }
  return null;
}

function failureLine(preset: string, mode: Mode, pair: Pair, lc: number, overrides: ThemeOverride, rows: readonly Row[]): string {
  const head = `${preset} ${mode}: "${pair.fg}" on "${pair.bg}"${pair.over ? ` over "${pair.over}"` : ''} is Lc ${lc.toFixed(1)}, below ${pair.min}`;
  const fixes = (['fg', 'bg'] as const)
    .map((side) => nearestFix(side, pair, mode, overrides, rows))
    .filter((fix): fix is Fix => fix !== null)
    .sort((a, b) => Math.abs(a.to - a.from) - Math.abs(b.to - b.from));
  const fix = fixes[0];
  if (!fix) return head;
  return `${head}\n    fix: set preset override "${fix.path}" lightness from ${formatLightness(fix.from)} to ${formatLightness(fix.to)} (Lc ${fix.lc.toFixed(1)})`;
}

/** Every preset pair below its contract minimum, in light and dark, with the nearest lightness that passes. */
export function contrastFailures(): { count: number; lines: string[] } {
  const dir = join(import.meta.dirname, '../../../../packages/design-system/tokens');
  const pairs = contractPairs(JSON.parse(readFileSync(join(dir, 'resolver.json'), 'utf8')) as unknown);
  const rows = tokenRows(JSON.parse(readFileSync(join(dir, 'tokens.generated.json'), 'utf8')) as unknown);
  const lines: string[] = [];
  let count = 0;
  for (const preset of PRESETS) {
    for (const mode of MODES) {
      const overrides = preset[mode];
      for (const pair of pairs) {
        count += 1;
        const lc = pairLc(pair, mode, overrides, rows);
        if (lc >= pair.min) continue;
        lines.push(failureLine(preset.id, mode, pair, lc, overrides, rows));
      }
    }
  }
  return { count, lines };
}
