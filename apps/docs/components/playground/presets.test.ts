import { THEME_OVERRIDE_KEYS, themeOverrideStyle, type ThemeColorValue, type ThemeOverride } from '@tounsoo/todae';
import { describe, expect, it } from 'vitest';
import { apcaContrast, oklchToSrgb } from '../../../../packages/design-system/scripts/build-tokens';
import core from '../../../../packages/design-system/tokens/core.json';
import { PRESETS } from './presets';

const KEYS = new Set<string>(THEME_OVERRIDE_KEYS);
const MODES = ['light', 'dark'] as const;

// Todae's canvas in each appearance (gray 50 and gray 950), for presets that keep it.
const CANVAS: Record<(typeof MODES)[number], ThemeColorValue> = {
  light: { colorSpace: 'oklch', components: [0.985, 0.004, 255] },
  dark: { colorSpace: 'oklch', components: [0.145, 0.007, 255] },
};

function lc(fg: ThemeColorValue, bg: ThemeColorValue): number {
  const rgb = ({ components: [l, c, h] }: ThemeColorValue) => oklchToSrgb({ l, c, h });
  return Math.abs(apcaContrast(rgb(fg), rgb(bg)));
}

const color = (overrides: ThemeOverride, key: keyof ThemeOverride) => overrides[key] as ThemeColorValue | undefined;

// Todae's core gray, for a step a preset leaves alone.
const gray = (overrides: ThemeOverride, step: string): ThemeColorValue =>
  color(overrides, `color.gray.${step}` as keyof ThemeOverride) ??
  ((core.color.gray as unknown as Record<string, { $value: ThemeColorValue }>)[step]!.$value);

const PRESET_MODES = PRESETS.flatMap((preset) => MODES.map((mode) => [preset.id, mode, preset[mode]] as const));

describe('playground presets', () => {
  it('have unique ids and start from plain Todae', () => {
    expect(new Set(PRESETS.map((preset) => preset.id)).size).toBe(PRESETS.length);
    expect(PRESETS[0]).toEqual({ id: 'graphite', name: 'Graphite', light: {}, dark: {} });
  });

  it.each(PRESET_MODES)(
    '%s %s only sets valid Todae overrides',
    (_id, _mode, overrides) => {
      for (const key of Object.keys(overrides)) expect(KEYS.has(key), key).toBe(true);
      // Throws in development on an unknown key or a value of the wrong type.
      expect(() => themeOverrideStyle(overrides)).not.toThrow();
    },
  );

  // The same floors Todae's resolver enforces on its own palette: on-accent on
  // each accent state at Lc 60, and the accent on the canvas at Lc 45.
  it.each(PRESET_MODES)(
    '%s %s keeps Todae’s accent contrast',
    (_id, mode, overrides) => {
      const onAccent = color(overrides, 'color.on-accent');
      const states = (['color.accent.default', 'color.accent.hover', 'color.accent.active'] as const).map((key) =>
        color(overrides, key),
      );
      if (states.every((state) => state === undefined)) return;
      expect(onAccent).toBeDefined();
      for (const state of states) {
        expect(state).toBeDefined();
        expect(lc(onAccent!, state!)).toBeGreaterThanOrEqual(60);
      }
      const canvas =
        color(overrides, 'color.bg.canvas') ?? color(overrides, mode === 'light' ? 'color.gray.50' : 'color.gray.950') ?? CANVAS[mode];
      expect(lc(states[0]!, canvas)).toBeGreaterThanOrEqual(45);
    },
  );

  it.each(PRESET_MODES)('%s %s gives each disabled state it sets a look of its own', (_id, _mode, overrides) => {
    for (const [key, value] of Object.entries(overrides)) {
      if (!key.endsWith('.disabled')) continue;
      expect(value, key).not.toEqual(overrides[key.replace(/disabled$/, 'default') as keyof ThemeOverride]);
    }
  });

  // Disabled and placeholder text must stay fainter than muted text, in every
  // component and inside fields.
  it.each(PRESET_MODES)('%s %s keeps faint text apart from muted text', (_id, mode, overrides) => {
    const muted = color(overrides, 'color.fg.muted') ?? gray(overrides, mode === 'light' ? '600' : '300');
    const faint = color(overrides, 'color.fg.placeholder') ?? gray(overrides, mode === 'light' ? '500' : '400');
    expect(faint).not.toEqual(muted);
    const field = ['field.fg.placeholder', 'field.fg.adornment', 'field.fg.disabled'].map(
      (key) => color(overrides, key as keyof ThemeOverride) ?? faint,
    );
    for (const value of field) {
      expect(value).toEqual(field[0]);
      expect(value).not.toEqual(muted);
    }
  });
});
