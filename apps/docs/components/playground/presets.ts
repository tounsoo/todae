import type { ThemeColorValue, ThemeDimensionValue, ThemeOverride } from '@tounsoo/todae';

/** A playground starting point: one override set per appearance, since Todae's accent flips between light and dark. */
export type ThemePreset = {
  id: string;
  /** A proper name, shown untranslated. */
  name: string;
  light: ThemeOverride;
  dark: ThemeOverride;
};

const oklch = (l: number, c: number, h: number): ThemeColorValue => ({ colorSpace: 'oklch', components: [l, c, h] });
const rem = (value: number): ThemeDimensionValue => ({ value, unit: 'rem' });

// Todae's gray ramp lightness, step by step. A preset keeps the lightness and
// changes the hue and chroma, so every semantic color that reads the ramp,
// in both appearances, follows along.
const RAMP = [
  ['50', 0.98],
  ['100', 0.93],
  ['200', 0.87],
  ['300', 0.78],
  ['400', 0.68],
  ['500', 0.55],
  ['600', 0.45],
  ['700', 0.36],
  ['800', 0.28],
  ['900', 0.22],
  ['950', 0.16],
] as const;

/** The gray ramp tinted toward `hue`. Chroma peaks in the middle steps, like Todae's own. */
function grays(hue: number, chroma: number): ThemeOverride {
  const out: ThemeOverride = {};
  for (const [step, l] of RAMP) {
    const middle = 1 - Math.abs(l - 0.55) / 0.55;
    out[`color.gray.${step}` as keyof ThemeOverride] = oklch(l, Number((chroma * (0.4 + 0.6 * middle)).toFixed(3)), hue);
  }
  return out;
}

/** A hue accent. `step` is how far hover and active move away from the default, toward more contrast. */
function accent(l: number, c: number, h: number, onAccent: ThemeColorValue, step: number): ThemeOverride {
  return {
    'color.accent.default': oklch(l, c, h),
    'color.accent.hover': oklch(Number((l + step).toFixed(3)), c, h),
    'color.accent.active': oklch(Number((l + step * 2).toFixed(3)), c, h),
    'color.on-accent': onAccent,
  };
}

/** The same overrides in both appearances, plus each appearance's own. */
function preset(id: string, name: string, shared: ThemeOverride, light: ThemeOverride, dark: ThemeOverride): ThemePreset {
  return { id, name, light: { ...shared, ...light }, dark: { ...shared, ...dark } };
}

export const PRESETS: readonly ThemePreset[] = [
  preset('todae', 'Todae', {}, {}, {}),
  preset(
    'paper',
    'Paper',
    { ...grays(75, 0.022), 'radius.sm': rem(0.125), 'radius.md': rem(0.25), 'radius.lg': rem(0.5) },
    {},
    {},
  ),
  preset(
    'forest',
    'Forest',
    { ...grays(165, 0.016), 'radius.sm': rem(0.375), 'radius.md': rem(0.625), 'radius.lg': rem(1) },
    accent(0.47, 0.1, 160, oklch(0.98, 0.01, 160), -0.05),
    accent(0.8, 0.12, 160, oklch(0.18, 0.03, 160), 0.05),
  ),
  preset(
    'ember',
    'Ember',
    { ...grays(50, 0.02), 'button.base.radius': rem(99), 'chip.radius': rem(99), 'badge.radius': rem(99) },
    accent(0.55, 0.16, 38, oklch(0.99, 0.006, 38), -0.05),
    accent(0.76, 0.14, 45, oklch(0.18, 0.03, 45), 0.05),
  ),
  preset(
    'grape',
    'Grape',
    { ...grays(300, 0.02), 'radius.sm': rem(0.375), 'radius.md': rem(0.75), 'radius.lg': rem(1.25) },
    accent(0.5, 0.18, 300, oklch(0.98, 0.01, 300), -0.05),
    accent(0.8, 0.11, 300, oklch(0.18, 0.03, 300), 0.05),
  ),
  preset(
    'mono',
    'Mono',
    { ...grays(0, 0), 'radius.sm': rem(0), 'radius.md': rem(0), 'radius.lg': rem(0), 'radius.full': rem(0) },
    {},
    {},
  ),
];
