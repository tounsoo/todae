import { THEME_OVERRIDE_KEYS, themeOverrideStyle, type ThemeColorValue, type ThemeOverride } from '@omsoo.design/todae';
import { describe, expect, it } from 'vitest';
import { apcaContrast, oklchToSrgb } from '../../../../packages/design-system/scripts/build-tokens';
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

describe('playground presets', () => {
  it('have unique ids and start from plain Todae', () => {
    expect(new Set(PRESETS.map((preset) => preset.id)).size).toBe(PRESETS.length);
    expect(PRESETS[0]).toEqual({ id: 'graphite', name: 'Graphite', light: {}, dark: {} });
  });

  it.each(PRESETS.flatMap((preset) => MODES.map((mode) => [preset.id, mode, preset[mode]] as const)))(
    '%s %s only sets valid Todae overrides',
    (_id, _mode, overrides) => {
      for (const key of Object.keys(overrides)) expect(KEYS.has(key), key).toBe(true);
      // Throws in development on an unknown key or a value of the wrong type.
      expect(() => themeOverrideStyle(overrides)).not.toThrow();
    },
  );

  // The same floors Todae's resolver enforces on its own palette: on-accent on
  // each accent state at Lc 60, and the accent on the canvas at Lc 45.
  it.each(PRESETS.flatMap((preset) => MODES.map((mode) => [preset.id, mode, preset[mode]] as const)))(
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
});
