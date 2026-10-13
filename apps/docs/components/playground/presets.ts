import type { ThemeColorValue, ThemeDimensionValue, ThemeOverride } from '@omsoo.design/todae';

/** A playground starting point: one override set per appearance, since Todae's accent flips between light and dark. */
export type ThemePreset = {
  id: string;
  /** A proper name, shown untranslated. */
  name: string;
  light: ThemeOverride;
  dark: ThemeOverride;
};

/** The web fonts the presets name. The playground loads them; a company loads its own. */
export const PRESET_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;700;800&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=JetBrains+Mono:wght@400;500;700&family=Nunito:wght@400;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap';

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

/** The gray ramp tinted toward `hue`, with chroma highest in the middle steps. */
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

/** Corner radii, from small to large. */
function radii(sm: number, md: number, lg: number): ThemeOverride {
  return { 'radius.sm': rem(sm), 'radius.md': rem(md), 'radius.lg': rem(lg) };
}

/** Pill-shaped buttons, chips and badges. */
const PILLS: ThemeOverride = { 'button.base.radius': rem(99), 'chip.radius': rem(99), 'badge.radius': rem(99) };

/** The same overrides in both appearances, plus each appearance's own. */
function preset(id: string, name: string, shared: ThemeOverride, light: ThemeOverride, dark: ThemeOverride): ThemePreset {
  return { id, name, light: { ...shared, ...light }, dark: { ...shared, ...dark } };
}

export const PRESETS: readonly ThemePreset[] = [
  preset('todae', 'Todae', {}, {}, {}),
  preset(
    'editorial',
    'Editorial',
    {
      ...grays(75, 0.024),
      ...radii(0.0625, 0.125, 0.25),
      'button.base.radius': rem(0),
      'font.family.sans': ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
      'font.weight.medium': 600,
      'font.weight.bold': 700,
    },
    accent(0.4, 0.1, 35, oklch(0.97, 0.015, 75), -0.05),
    accent(0.84, 0.07, 65, oklch(0.18, 0.02, 65), 0.05),
  ),
  preset(
    'forest',
    'Forest',
    {
      ...grays(160, 0.018),
      ...radii(0.5, 0.875, 1.25),
      ...PILLS,
      'font.family.sans': ['Nunito', 'ui-rounded', 'system-ui', 'sans-serif'],
      'font.weight.medium': 700,
      'font.weight.bold': 800,
    },
    accent(0.47, 0.1, 160, oklch(0.98, 0.01, 160), -0.05),
    accent(0.8, 0.12, 160, oklch(0.18, 0.03, 160), 0.05),
  ),
  preset(
    'grape',
    'Grape',
    {
      ...grays(300, 0.024),
      ...radii(0.25, 0.5, 0.75),
      'border.width': rem(0.125),
      'font.family.sans': ['Space Grotesk', 'system-ui', 'sans-serif'],
      'font.weight.medium': 600,
      'font.weight.bold': 700,
    },
    accent(0.5, 0.2, 300, oklch(0.98, 0.01, 300), -0.05),
    accent(0.82, 0.11, 300, oklch(0.18, 0.03, 300), 0.04),
  ),
  preset(
    'terminal',
    'Terminal',
    {
      ...grays(150, 0.03),
      ...radii(0, 0, 0),
      'radius.full': rem(0),
      'button.base.radius': rem(0),
      'font.family.sans': ['JetBrains Mono', 'ui-monospace', 'monospace'],
      'font.family.mono': ['JetBrains Mono', 'ui-monospace', 'monospace'],
      'font.weight.medium': 500,
      'font.weight.bold': 700,
    },
    accent(0.45, 0.13, 150, oklch(0.98, 0.02, 150), -0.05),
    accent(0.84, 0.19, 150, oklch(0.16, 0.03, 150), 0.04),
  ),
  preset(
    'brutal',
    'Brutal',
    {
      ...grays(0, 0),
      ...radii(0, 0, 0),
      'radius.full': rem(0),
      'button.base.radius': rem(0),
      'border.width': rem(0.1875),
      'font.family.sans': ['Archivo', 'system-ui', 'sans-serif'],
      'font.weight.medium': 700,
      'font.weight.bold': 800,
      'button.base.font.weight': 800,
    },
    {},
    {},
  ),
];
