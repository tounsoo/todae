import { THEME_OVERRIDE_KEYS, themeOverrideStyle } from '@tounsoo/todae';
import { describe, expect, it } from 'vitest';
import { PRESETS } from './presets';

const KEYS = new Set<string>(THEME_OVERRIDE_KEYS);

describe('playground presets', () => {
  it('have unique ids and start from plain Todae', () => {
    expect(new Set(PRESETS.map((preset) => preset.id)).size).toBe(PRESETS.length);
    expect(PRESETS[0]).toEqual({ id: 'todae', name: 'Todae', light: {}, dark: {} });
  });

  it.each(PRESETS.flatMap((preset) => (['light', 'dark'] as const).map((mode) => [preset.id, mode, preset[mode]] as const)))(
    '%s %s only sets valid Todae overrides',
    (_id, _mode, overrides) => {
      for (const key of Object.keys(overrides)) expect(KEYS.has(key), key).toBe(true);
      // Throws in development on an unknown key or a value of the wrong type.
      expect(() => themeOverrideStyle(overrides)).not.toThrow();
    },
  );

  it('give every hue accent a readable label color in both appearances', () => {
    for (const preset of PRESETS) {
      const light = preset.light['color.accent.default'];
      if (!light) continue;
      expect(preset.light['color.on-accent'], preset.id).toBeDefined();
      expect(preset.dark['color.accent.default'], preset.id).toBeDefined();
      expect(preset.dark['color.on-accent'], preset.id).toBeDefined();
    }
  });
});
