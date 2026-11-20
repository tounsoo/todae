import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { oklchToSrgb } from '../../src/color/apca.ts';

type Row = { path: string; cssValue: string; ref: string | null; context: string | null };

const catalog = JSON.parse(readFileSync(join(import.meta.dirname, '../../tokens/tokens.generated.json'), 'utf8')) as {
  tokens: Row[];
};

const rows = new Map<string, Row[]>();
for (const row of catalog.tokens) {
  const list = rows.get(row.path) ?? [];
  list.push(row);
  rows.set(row.path, list);
}

function pick(path: string, scheme: 'light' | 'dark'): Row {
  const list = rows.get(path);
  if (!list) throw new Error(`missing token ${path}`);
  return list.find((row) => row.context === scheme) ?? list.find((row) => row.context == null) ?? list[0]!;
}

function oklch(path: string, scheme: 'light' | 'dark', seen = new Set<string>()): { l: number; c: number; h: number } {
  const key = `${scheme}:${path}`;
  if (seen.has(key)) throw new Error(`cycle at ${path}`);
  seen.add(key);
  const row = pick(path, scheme);
  const literal = /^oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)/.exec(row.cssValue);
  if (literal) return { l: Number(literal[1]), c: Number(literal[2]), h: Number(literal[3]) };
  if (!row.ref) throw new Error(`${path} has no color (${row.cssValue})`);
  return oklch(row.ref, scheme, seen);
}

function linear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function wcag(fg: { l: number; c: number; h: number }, bg: { l: number; c: number; h: number }): number {
  const lum = (color: { l: number; c: number; h: number }) => {
    const [r, g, b] = oklchToSrgb(color);
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  };
  const a = lum(fg);
  const b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const STATES = ['default', 'hover', 'active', 'focus', 'disabled'] as const;

const SCALE = new Set([
  'color.danger.default',
  'color.on-accent',
  'color.status.critical.fg',
  'color.status.critical.bg',
  'color.status.critical.border',
  'focus.ring',
  'shadow.none',
]);

describe('critical button contrast', () => {
  it('paints every state from the danger and status critical scales', () => {
    for (const state of STATES) {
      for (const part of ['bg', 'fg', 'border'] as const) {
        const ref = pick(`button.critical.${part}.${state}`, 'light').ref;
        expect(ref, `button.critical.${part}.${state}`).toBeTruthy();
        expect(SCALE.has(ref!), `button.critical.${part}.${state} -> ${ref}`).toBe(true);
      }
    }
    expect(pick('button.critical.ring.focus', 'light').ref).toBe('focus.ring');
    expect(pick('button.critical.shadow', 'light').ref).toBe('shadow.none');
  });

  it('meets WCAG AA 4.5:1 for text on its own background in light and dark', () => {
    for (const scheme of ['light', 'dark'] as const) {
      for (const state of STATES) {
        const ratio = wcag(oklch(`button.critical.fg.${state}`, scheme), oklch(`button.critical.bg.${state}`, scheme));
        expect(ratio, `${scheme} ${state}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('keeps hover, press and disabled colors apart from the resting critical button', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const rest = oklch('button.critical.bg.default', scheme);
      const hover = oklch('button.critical.bg.hover', scheme);
      const disabled = oklch('button.critical.bg.disabled', scheme);
      const restText = oklch('button.critical.fg.default', scheme);
      const pressedText = oklch('button.critical.fg.active', scheme);
      expect(hover).not.toEqual(rest);
      expect(disabled).not.toEqual(rest);
      expect(pressedText).not.toEqual(restText);
      expect(oklch('button.critical.fg.focus', scheme)).toEqual(restText);
      expect(oklch('button.critical.bg.focus', scheme)).toEqual(rest);
    }
  });

  it('leaves the primary, secondary and ghost fills on their current tokens', () => {
    const fills: Record<string, string> = {
      'button.primary.bg.default': 'color.accent.default',
      'button.primary.bg.hover': 'color.accent.hover',
      'button.primary.bg.active': 'color.accent.active',
      'button.primary.fg.default': 'color.on-accent',
      'button.secondary.bg.default': 'color.bg.transparent',
      'button.secondary.bg.hover': 'color.bg.highlight',
      'button.secondary.fg.default': 'color.fg.default',
      'button.ghost.bg.default': 'color.bg.transparent',
      'button.ghost.bg.hover': 'color.bg.highlight',
      'button.ghost.fg.default': 'color.fg.default',
    };
    for (const [path, ref] of Object.entries(fills)) {
      expect(pick(path, 'light').ref, path).toBe(ref);
    }
  });
});
