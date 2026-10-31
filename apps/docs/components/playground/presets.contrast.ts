import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ThemeColorValue, ThemeOverride } from '@tounsoo/todae';
import { apcaContrast, composite, oklchToSrgb } from '../../../../packages/design-system/scripts/build-tokens';
import { PRESETS } from './presets';

export const PRESET_PAIRS = [
  'progress.fill|progress.track',
  'meter.fill.optimum|progress.track',
  'meter.fill.suboptimum|progress.track',
  'meter.fill.critical|progress.track',
  'selection.thumb.bg|selection.bg.checked',
  'selection.indicator.fg|selection.bg.checked',
  'button.primary.fg.default|button.primary.bg.default',
  'button.primary.fg.hover|button.primary.bg.hover',
  'button.primary.fg.active|button.primary.bg.active',
  'button.primary.fg.focus|button.primary.bg.focus',
] as const;

const STEP = 0.005;
const MODES = ['light', 'dark'] as const;

type Mode = (typeof MODES)[number];
type Oklch = { l: number; c: number; h: number; alpha: number };
type Row = { path: string; context: string | null; ref: string | null; cssValue: string };
type Pair = { fg: string; bg: string; min: number };

export type ContrastHit = { key: string; line: string };

type Fix = { path: string; from: number; to: number; lc: number };

const DENSITY = new Set(['compact', 'spacious']);
const APPEARANCE = new Set(['light', 'dark']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function contractPairs(resolver: unknown): Pair[] {
  if (!isRecord(resolver) || !isRecord(resolver.sets) || !isRecord(resolver.sets.contract)) {
    throw new Error('resolver.json contract set is missing');
  }
  const extensions = resolver.sets.contract.$extensions;
  if (!isRecord(extensions) || !isRecord(extensions['dev.todae']) || !Array.isArray(extensions['dev.todae'].contrast)) {
    throw new Error('resolver.json contract set has no contrast list');
  }
  const byKey = new Map<string, Pair>();
  for (const entry of extensions['dev.todae'].contrast) {
    if (!isRecord(entry) || typeof entry.fg !== 'string' || typeof entry.bg !== 'string' || typeof entry.min !== 'number') {
      throw new Error('resolver.json contrast entry is missing fg, bg, or min');
    }
    byKey.set(`${entry.fg}|${entry.bg}`, { fg: entry.fg, bg: entry.bg, min: entry.min });
  }
  return PRESET_PAIRS.map((key) => {
    const pair = byKey.get(key);
    if (!pair) throw new Error(`resolver.json contract contrast is missing ${key}`);
    return pair;
  });
}

function tokenRows(catalog: unknown): Row[] {
  if (!isRecord(catalog) || !Array.isArray(catalog.tokens)) throw new Error('tokens.generated.json has no tokens array');
  return catalog.tokens.map((entry) => {
    if (!isRecord(entry) || typeof entry.path !== 'string' || typeof entry.cssValue !== 'string') {
      throw new Error('tokens.generated.json has a row without path or cssValue');
    }
    if (entry.context !== null && typeof entry.context !== 'string') throw new Error(`token ${entry.path} has a bad context`);
    if (entry.ref !== null && typeof entry.ref !== 'string') throw new Error(`token ${entry.path} has a bad ref`);
    return { path: entry.path, context: entry.context, ref: entry.ref, cssValue: entry.cssValue };
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

function resolveColor(path: string, mode: Mode, overrides: ThemeOverride, rows: readonly Row[], depth = 0): Oklch {
  if (depth > 30) throw new Error(`loop ${path}`);
  const overridden = overrideColor(overrides[path as keyof ThemeOverride]);
  if (overridden) return overridden;
  const row = rows.find((item) => item.path === path && item.context === mode) ?? rows.find((item) => sharedRow(item, path));
  if (!row) throw new Error(`no ${path}`);
  if (row.ref) return resolveColor(row.ref, mode, overrides, rows, depth + 1);
  const color = parseOklch(row.cssValue);
  if (!color) throw new Error(`unparsed ${path} ${row.cssValue}`);
  return color;
}

function toTheme(color: Oklch): ThemeColorValue {
  const value: ThemeColorValue = { colorSpace: 'oklch', components: [color.l, color.c, color.h] };
  if (color.alpha !== 1) value.alpha = color.alpha;
  return value;
}

function pairLc(pair: Pair, mode: Mode, overrides: ThemeOverride, rows: readonly Row[]): number {
  const canvas = oklchToSrgb(resolveColor('color.bg.canvas', mode, overrides, rows));
  const bg = composite(resolveColor(pair.bg, mode, overrides, rows), canvas);
  const fg = composite(resolveColor(pair.fg, mode, overrides, rows), bg);
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
  const head = `${preset} ${mode}: "${pair.fg}" on "${pair.bg}" is Lc ${lc.toFixed(1)}, below ${pair.min}`;
  const fixes = (['fg', 'bg'] as const)
    .map((side) => nearestFix(side, pair, mode, overrides, rows))
    .filter((fix): fix is Fix => fix !== null)
    .sort((a, b) => Math.abs(a.to - a.from) - Math.abs(b.to - b.from));
  const fix = fixes[0];
  if (!fix) return head;
  return `${head}\n    fix: set preset override "${fix.path}" lightness from ${formatLightness(fix.from)} to ${formatLightness(fix.to)} (Lc ${fix.lc.toFixed(1)})`;
}

export function contrastHits(): { count: number; hits: ContrastHit[] } {
  const dir = join(import.meta.dirname, '../../../../packages/design-system/tokens');
  const pairs = contractPairs(JSON.parse(readFileSync(join(dir, 'resolver.json'), 'utf8')) as unknown);
  const rows = tokenRows(JSON.parse(readFileSync(join(dir, 'tokens.generated.json'), 'utf8')) as unknown);
  const hits: ContrastHit[] = [];
  let count = 0;
  for (const preset of PRESETS) {
    for (const mode of MODES) {
      const overrides = preset[mode];
      for (const pair of pairs) {
        count += 1;
        const lc = pairLc(pair, mode, overrides, rows);
        if (lc >= pair.min) continue;
        const key = `${preset.id} ${mode} ${pair.fg} ${pair.bg}`;
        hits.push({ key, line: failureLine(preset.id, mode, pair, lc, overrides, rows) });
      }
    }
  }
  return { count, hits };
}

export function ratchet(
  found: readonly string[],
  list: readonly string[],
  base?: ReadonlySet<string> | 'missing',
): { unlisted: string[]; stale: string[]; added: string[] } {
  const allowed = new Set(list);
  const failing = new Set(found);
  const unlisted = found.filter((key) => !allowed.has(key));
  const stale = list.filter((key) => !failing.has(key));
  const added: string[] = [];
  if (base && base !== 'missing') {
    for (const key of list) if (!base.has(key)) added.push(key);
  }
  return { unlisted, stale, added };
}

export function problemLines(hits: readonly ContrastHit[], list: readonly string[], base?: ReadonlySet<string> | 'missing'): string[] {
  const { unlisted, stale, added } = ratchet(
    hits.map((hit) => hit.key),
    list,
    base,
  );
  const byKey = new Map(hits.map((hit) => [hit.key, hit.line]));
  return [
    ...unlisted.map((key) => {
      const line = byKey.get(key);
      if (line === undefined) throw new Error(`missing contrast line for ${key}`);
      return line;
    }),
    ...stale.map((key) => `${key}: remove it, the list only shrinks`),
    ...added.map((key) => `grandfather list can only shrink; ${key} is new`),
  ];
}
