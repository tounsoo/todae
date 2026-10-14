import type { ThemeColorValue, ThemeDimensionValue, ThemeOverride, ThemeShadowLayer } from '@omsoo.design/todae';

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
  ['0', 1],
  ['50', 0.985],
  ['100', 0.955],
  ['200', 0.9],
  ['300', 0.82],
  ['400', 0.78],
  ['500', 0.6],
  ['600', 0.48],
  ['700', 0.36],
  ['800', 0.28],
  ['850', 0.235],
  ['900', 0.19],
  ['950', 0.145],
] as const;

/** The gray ramp tinted toward `hue`, with chroma highest in the middle steps. */
function grays(hue: number, chroma: number): ThemeOverride {
  const out: ThemeOverride = {};
  for (const [step, l] of RAMP) {
    const middle = 1 - Math.abs(l - 0.55) / 0.55;
    // White stays neutral: any chroma at L 1 is outside sRGB.
    out[`color.gray.${step}` as keyof ThemeOverride] = oklch(l, l >= 1 ? 0 : Number((chroma * (0.5 + 0.5 * middle)).toFixed(4)), hue);
  }
  return out;
}

/** The accent's three states and the color drawn on it. */
function accent(base: ThemeColorValue, hover: ThemeColorValue, active: ThemeColorValue, onAccent: ThemeColorValue): ThemeOverride {
  return { 'color.accent.default': base, 'color.accent.hover': hover, 'color.accent.active': active, 'color.on-accent': onAccent };
}

/** Corner radii, from small to large. */
function radii(sm: number, md: number, lg: number): ThemeOverride {
  return { 'radius.sm': rem(sm), 'radius.md': rem(md), 'radius.lg': rem(lg) };
}

const px = (value: number) => ({ value, unit: 'px' }) as const;

/** One shadow layer: x, y, blur and spread in px, then its color. */
function shadow(x: number, y: number, blur: number, spread: number, color: ThemeColorValue): ThemeShadowLayer {
  return { offsetX: px(x), offsetY: px(y), blur: px(blur), spread: px(spread), color };
}

const alpha = (color: ThemeColorValue, a: number): ThemeColorValue => ({ ...color, alpha: a });

/** Pill-shaped buttons, chips and badges. */
const PILLS: ThemeOverride = { 'button.base.radius': rem(99), 'chip.radius': rem(99), 'badge.radius': rem(99) };

/** A fill moved toward the text color: darker in light mode, lighter in dark. */
function shade(color: ThemeColorValue, step: number): ThemeColorValue {
  const [l, c, h] = color.components;
  return oklch(Math.round((l > 0.5 ? l - step : l + step) * 1000) / 1000, c, h);
}

/**
 * Filled fields and secondary buttons: in every state but focus and invalid,
 * the border is the fill's own color, so the shape stays the same size. Hover
 * and press deepen the fill.
 */
function filled(field: ThemeColorValue, button: ThemeColorValue): ThemeOverride {
  const out: ThemeOverride = {
    'field.bg.default': field,
    'field.bg.disabled': field,
    'field.border.default': field,
    'field.border.hover': shade(field, 0.06),
    'field.border.disabled': field,
  };
  const fills = { default: button, hover: shade(button, 0.03), active: shade(button, 0.06), focus: button, disabled: button };
  for (const [state, fill] of Object.entries(fills)) {
    out[`button.secondary.bg.${state}` as keyof ThemeOverride] = fill;
    if (state !== 'focus') out[`button.secondary.border.${state}` as keyof ThemeOverride] = fill;
  }
  return out;
}

/** The same overrides in both appearances, plus each appearance's own. */
function preset(id: string, name: string, shared: ThemeOverride, light: ThemeOverride, dark: ThemeOverride): ThemePreset {
  return { id, name, light: { ...shared, ...light }, dark: { ...shared, ...dark } };
}

/** Acid's light primary button: chartreuse with ink type and an ink edge. */
function chartreuseButton(ink: ThemeColorValue): ThemeOverride {
  const out: ThemeOverride = {};
  const fills = { default: oklch(0.9, 0.2, 122), hover: oklch(0.93, 0.19, 122), active: oklch(0.85, 0.2, 122), focus: oklch(0.9, 0.2, 122) };
  for (const [state, fill] of Object.entries(fills)) {
    out[`button.primary.bg.${state}` as keyof ThemeOverride] = fill;
    out[`button.primary.fg.${state}` as keyof ThemeOverride] = ink;
    out[`button.primary.border.${state}` as keyof ThemeOverride] = ink;
  }
  return out;
}

/** Acid's hard, unblurred shadows in the border's color; ghost buttons stay flat. */
function hardShadows(color: ThemeColorValue): ThemeOverride {
  return { 'card.shadow': shadow(6, 6, 0, 0, color), 'button.primary.shadow': shadow(3, 3, 0, 0, color), 'button.secondary.shadow': shadow(3, 3, 0, 0, color) };
}

/** Uppercase, widely spaced buttons, tabs, labels and table headers; spacing in rem. */
function capsLabels(value: number): ThemeOverride {
  const spacing = rem(value);
  return {
    'button.base.font.letter-spacing': spacing,
    'tabs.font.letter-spacing': spacing,
    'field.label.font.letter-spacing': spacing,
    'table.header.font.letter-spacing': spacing,
    'button.base.font.text-transform': 'uppercase',
    'tabs.font.text-transform': 'uppercase',
    'field.label.font.text-transform': 'uppercase',
    'table.header.font.text-transform': 'uppercase',
  };
}

const MONO = ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'];

export const PRESETS: readonly ThemePreset[] = [
  // Todae as it ships.
  preset('graphite', 'Graphite', {}, {}, {}),
  preset(
    'porcelain',
    'Porcelain',
    { ...grays(200, 0.008), ...radii(0.625, 0.875, 1.5), ...PILLS },
    {
      'color.bg.canvas': oklch(0.965, 0.004, 200),
      'card.border': oklch(1, 0, 0),
      'card.shadow': [shadow(0, 1, 2, 0, alpha(oklch(0.2, 0.01, 255), 0.05)), shadow(0, 10, 30, 0, alpha(oklch(0.2, 0.01, 255), 0.07))],
      ...filled(oklch(0.935, 0.005, 200), oklch(0.925, 0.006, 200)),
      ...accent(oklch(0.5, 0.09, 165), oklch(0.56, 0.09, 165), oklch(0.44, 0.09, 165), oklch(0.99, 0, 0)),
    },
    {
      'color.bg.canvas': oklch(0.13, 0.006, 200),
      'card.border': oklch(0.19, 0.004, 200),
      'card.shadow': [shadow(0, 1, 0, 0, alpha(oklch(1, 0, 0), 0.05)), shadow(0, 12, 32, 0, alpha(oklch(0, 0, 0), 0.45))],
      ...filled(oklch(0.24, 0.006, 200), oklch(0.26, 0.006, 200)),
      ...accent(oklch(0.8, 0.077, 165), oklch(0.85, 0.077, 165), oklch(0.75, 0.077, 165), oklch(0.17, 0.03, 165)),
    },
  ),
  preset(
    'acid',
    'Acid',
    {
      ...grays(120, 0.01),
      ...radii(0, 0, 0),
      'radius.full': rem(0),
      'border.width': rem(0.125),
      'font.family.sans': MONO,
      'font.weight.medium': 600,
      'font.weight.bold': 800,
      'button.base.font.weight': 800,
      ...capsLabels(0.04),
    },
    {
      // Chartreuse can't carry a checkbox or a tab line on a light canvas, so
      // the accent stays ink and only the primary button turns chartreuse.
      ...accent(oklch(0.15, 0.028, 110), oklch(0.26, 0.028, 110), oklch(0.1, 0.028, 110), oklch(0.9, 0.2, 122)),
      ...chartreuseButton(oklch(0.15, 0.028, 110)),
      ...hardShadows(oklch(0.15, 0.028, 110)),
      'color.bg.canvas': oklch(0.96, 0.02, 110),
      'color.border.default': oklch(0.15, 0.028, 110),
      'color.border.subtle': oklch(0.2, 0.024, 110),
      'focus.ring.color': oklch(0.6, 0.25, 330),
    },
    {
      ...accent(oklch(0.9, 0.2, 122), oklch(0.93, 0.19, 122), oklch(0.85, 0.2, 122), oklch(0.15, 0.02, 120)),
      'color.border.default': oklch(0.92, 0.014, 120),
      ...hardShadows(oklch(0.92, 0.014, 120)),
      'color.border.subtle': oklch(0.9, 0.012, 120),
      'focus.ring.color': oklch(0.72, 0.22, 330),
    },
  ),
  preset(
    'bloom',
    'Bloom',
    { ...grays(330, 0.03), ...radii(0.75, 1, 1.75), ...PILLS, 'font.weight.medium': 600, 'font.weight.bold': 800 },
    {
      'color.bg.canvas': oklch(0.965, 0.02, 340),
      'card.border': oklch(1, 0, 0),
      'card.shadow': shadow(0, 12, 40, 0, alpha(oklch(0.6, 0.24, 350), 0.18)),
      ...accent(oklch(0.6, 0.25, 350), oklch(0.66, 0.24, 350), oklch(0.54, 0.25, 350), oklch(0.99, 0, 0)),
      'focus.ring.color': oklch(0.6, 0.25, 350),
    },
    {
      'color.bg.canvas': oklch(0.15, 0.04, 320),
      'color.bg.surface': oklch(0.2, 0.024, 320),
      'card.border': oklch(0.2, 0.024, 320),
      'card.shadow': shadow(0, 12, 48, 0, alpha(oklch(0.7, 0.22, 350), 0.22)),
      ...accent(oklch(0.82, 0.14, 350), oklch(0.86, 0.12, 350), oklch(0.79, 0.15, 350), oklch(0.15, 0.05, 340)),
      'focus.ring.color': oklch(0.82, 0.14, 350),
    },
  ),
];
