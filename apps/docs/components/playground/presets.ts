import type { ThemeColorValue, ThemeDimensionValue, ThemeOverride, ThemeShadowLayer } from '@tounsoo/todae';

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
function shadow(x: number, y: number, blur: number, spread: number, color: ThemeColorValue, inset = false): ThemeShadowLayer {
  return { offsetX: px(x), offsetY: px(y), blur: px(blur), spread: px(spread), color, ...(inset ? { inset } : {}) };
}

const alpha = (color: ThemeColorValue, a: number): ThemeColorValue => ({ ...color, alpha: a });

/** Pill-shaped buttons, chips and badges. */
const PILLS: ThemeOverride = { 'button.base.radius': rem(99), 'chip.radius': rem(99), 'badge.radius': rem(99) };

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

/** Riso's second ink, printed off-register behind cards and the filled buttons. */
function offsetInk(ink: ThemeColorValue): ThemeOverride {
  return { 'card.shadow': shadow(5, 5, 0, 0, ink), 'button.primary.shadow': shadow(3, 3, 0, 0, ink), 'button.secondary.shadow': shadow(3, 3, 0, 0, ink) };
}

/** Y2K Chrome's glossy buttons: a highlight along the top edge over a soft tinted drop. */
function gloss(highlight: ThemeColorValue, drop: ThemeColorValue): ThemeOverride {
  const layers = [shadow(0, 1, 0, 0, highlight, true), shadow(0, 2, 6, 0, drop)];
  return { 'button.primary.shadow': layers, 'button.secondary.shadow': layers };
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

type Tone = 'info' | 'success' | 'warning' | 'critical';

function anvilAppearance(c: {
  ink: ThemeColorValue;
  muted: ThemeColorValue;
  canvas: ThemeColorValue;
  raised: ThemeColorValue;
  fill: ThemeColorValue;
  fillHover: ThemeColorValue;
  rule: ThemeColorValue;
  control: ThemeColorValue;
  track: ThemeColorValue;
  thumb: ThemeColorValue;
  accent: [ThemeColorValue, ThemeColorValue, ThemeColorValue, ThemeColorValue];
  tint: ThemeColorValue;
  tintStrong: ThemeColorValue;
  danger: ThemeColorValue;
  tint1: number;
  wash: ThemeColorValue;
  /** Focus ring. Anvil's blue, 2px, independent of a later accent edit. */
  focus: ThemeColorValue;
  segmentShadow: ThemeColorValue;
  dismissHover: ThemeColorValue;
  shadow: ThemeColorValue;
  status: Record<Tone, [bg: ThemeColorValue, border: ThemeColorValue, fg: ThemeColorValue]>;
  alert: Record<Tone, [bg: ThemeColorValue, border: ThemeColorValue]>;
}): ThemeOverride {
  const out: ThemeOverride = {
    ...accent(...c.accent),
    'color.bg.canvas': c.canvas,
    'color.bg.elevated': c.raised,
    'color.fg.default': c.ink,
    'color.fg.muted': c.muted,
    'color.danger.default': c.danger,
    'focus.ring.color': c.focus,
    'color.border.subtle': c.rule,
    'button.secondary.bg.default': alpha(c.ink, c.tint1),
    'button.secondary.bg.focus': alpha(c.ink, c.tint1),
    'button.secondary.bg.hover': alpha(c.ink, c.tint1 + 0.04),
    'button.secondary.bg.active': alpha(c.ink, c.tint1 + 0.1),
    'button.secondary.border.default': alpha(c.ink, 0),
    'button.secondary.border.hover': alpha(c.ink, 0),
    'button.secondary.border.active': alpha(c.ink, 0),
    'button.secondary.border.focus': alpha(c.ink, 0),
    'button.primary.bg.disabled': c.raised,
    'button.primary.border.disabled': c.raised,
    'button.primary.fg.disabled': c.muted,
    'button.secondary.bg.disabled': c.raised,
    'button.secondary.border.disabled': c.raised,
    'button.secondary.fg.disabled': c.muted,
    'field.border.default': c.control,
    'field.border.hover': c.control,
    'field.bg.disabled': c.raised,
    'selection.border.default': c.ink,
    'selection.track.bg': c.track,
    'selection.thumb.bg': c.thumb,
    'tabs.fg.default': c.ink,
    'tabs.indicator.color': c.ink,
    'chip.bg.default': c.fill,
    'chip.bg.focus': c.fill,
    'chip.bg.hover': c.fillHover,
    'chip.border.default': c.rule,
    'chip.border.hover': c.rule,
    'chip.dismiss.fg.default': c.ink,
    'chip.dismiss.fg.hover': c.ink,
    'chip.dismiss.bg.hover': c.dismissHover,
    'badge.neutral.bg': c.fill,
    'badge.neutral.border': c.rule,
    'tooltip.bg': c.ink,
    'tooltip.border': c.ink,
    'tooltip.fg': c.canvas,
    'tooltip.radius': rem(0.375),
    'tooltip.shadow': shadow(0, 2, 8, 0, c.shadow),
    'popover.shadow': shadow(0, 2, 8, 0, c.shadow),
    'toast.shadow': shadow(0, 8, 24, 0, c.shadow),
    'option.bg.selected': c.tint,
    'option.bg.selected-highlighted': c.tintStrong,
    'option.fg.selected': c.accent[0],
    'calendar.day.bg.range': c.tint,
    'calendar.day.fg.range': c.accent[0],
    'steps.marker.border.current': c.accent[0],
    'steps.marker.border.pending': c.control,
    // Toggle groups are Anvil's segmented control. Segments that match Button
    // inherit it. These are the fills that do not.
    'togglegroup.bg': c.fill,
    'togglegroup.border': c.rule,
    'togglegroup.item.bg.default': alpha(c.wash, 0),
    'togglegroup.item.bg.hover': alpha(c.wash, 0.08),
    'togglegroup.item.bg.active': alpha(c.wash, 0.16),
    'togglegroup.item.bg.pressed': c.canvas,
    'togglegroup.item.fg.pressed': c.ink,
    'togglegroup.item.border.pressed': alpha(c.wash, 0),
    'togglegroup.item.shadow.pressed': shadow(0, 2, 8, 0, c.segmentShadow),
    'progress.track': c.fill,
    'progress.radius': rem(0.375),
  };
  for (const tone of ['info', 'success', 'warning', 'critical'] as const) {
    const [bg, border, fg] = c.status[tone];
    const [alertBg, alertBorder] = c.alert[tone];
    out[`color.status.${tone}.bg` as keyof ThemeOverride] = bg;
    out[`color.status.${tone}.border` as keyof ThemeOverride] = border;
    out[`color.status.${tone}.fg` as keyof ThemeOverride] = fg;
    out[`alert.${tone}.bg` as keyof ThemeOverride] = alertBg;
    out[`alert.${tone}.border` as keyof ThemeOverride] = alertBorder;
    out[`alert.${tone}.fg` as keyof ThemeOverride] = c.ink;
  }
  return out;
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
      ...accent(oklch(0.5, 0.09, 165), oklch(0.56, 0.09, 165), oklch(0.44, 0.09, 165), oklch(0.99, 0, 0)),
    },
    {
      'color.bg.canvas': oklch(0.13, 0.006, 200),
      'card.border': oklch(0.19, 0.004, 200),
      'card.shadow': [shadow(0, 1, 0, 0, alpha(oklch(1, 0, 0), 0.05)), shadow(0, 12, 32, 0, alpha(oklch(0, 0, 0), 0.45))],
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
      // the accent stays ink. Progress aliases that accent and the subtle border,
      // which are both ink here, so the bar sets its own fill and track.
      ...accent(oklch(0.15, 0.028, 110), oklch(0.26, 0.028, 110), oklch(0.1, 0.028, 110), oklch(0.9, 0.2, 122)),
      ...chartreuseButton(oklch(0.15, 0.028, 110)),
      ...hardShadows(oklch(0.15, 0.028, 110)),
      'color.bg.canvas': oklch(0.96, 0.02, 110),
      'color.border.default': oklch(0.15, 0.028, 110),
      'color.border.subtle': oklch(0.2, 0.024, 110),
      'progress.fill': oklch(0.9, 0.2, 122),
      'progress.track': oklch(0.68, 0.024, 110),
      'focus.ring.color': oklch(0.6, 0.25, 330),
    },
    {
      ...accent(oklch(0.9, 0.2, 122), oklch(0.93, 0.19, 122), oklch(0.85, 0.2, 122), oklch(0.15, 0.02, 120)),
      'color.border.default': oklch(0.92, 0.014, 120),
      ...hardShadows(oklch(0.92, 0.014, 120)),
      'color.border.subtle': oklch(0.9, 0.012, 120),
      'progress.track': oklch(0.35, 0.012, 120),
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
  preset(
    'riso',
    'Riso',
    { ...radii(0.125, 0.25, 0.375), 'border.width': rem(0.125), 'font.weight.medium': 600, 'font.weight.bold': 800 },
    {
      // Uncoated paper, fluorescent pink ink and a teal second color.
      ...grays(80, 0.02),
      'color.bg.canvas': oklch(0.95, 0.02, 85),
      ...accent(oklch(0.62, 0.24, 0), oklch(0.67, 0.23, 0), oklch(0.57, 0.24, 0), oklch(0.99, 0.01, 0)),
      ...offsetInk(alpha(oklch(0.62, 0.12, 190), 0.85)),
      'focus.ring.color': oklch(0.55, 0.12, 200),
    },
    {
      // The same inks printed on navy stock.
      ...grays(260, 0.03),
      'color.bg.canvas': oklch(0.17, 0.035, 260),
      ...accent(oklch(0.8, 0.15, 0), oklch(0.84, 0.13, 0), oklch(0.78, 0.16, 0), oklch(0.13, 0.03, 0)),
      ...offsetInk(alpha(oklch(0.7, 0.12, 190), 0.85)),
      'focus.ring.color': oklch(0.75, 0.12, 190),
    },
  ),
  preset(
    'y2k-chrome',
    'Y2K Chrome',
    { ...radii(0.75, 1, 1.5), ...PILLS, 'font.weight.medium': 600, 'font.weight.bold': 800 },
    {
      // Lilac and silver, with an iridescent card edge.
      ...grays(300, 0.03),
      'color.bg.canvas': oklch(0.95, 0.02, 300),
      'card.border': oklch(0.85, 0.05, 300),
      'card.shadow': shadow(0, 12, 32, 0, alpha(oklch(0.5, 0.1, 300), 0.15)),
      ...accent(oklch(0.56, 0.18, 305), oklch(0.61, 0.17, 305), oklch(0.51, 0.18, 305), oklch(0.99, 0, 0)),
      ...gloss(alpha(oklch(1, 0, 0), 0.6), alpha(oklch(0.4, 0.1, 300), 0.25)),
      'focus.ring.color': oklch(0.56, 0.18, 305),
    },
    {
      ...grays(290, 0.035),
      'color.bg.canvas': oklch(0.15, 0.03, 290),
      'card.border': oklch(0.45, 0.08, 300),
      'card.shadow': shadow(0, 12, 40, 0, alpha(oklch(0, 0, 0), 0.5)),
      ...accent(oklch(0.82, 0.12, 305), oklch(0.86, 0.1, 305), oklch(0.78, 0.13, 305), oklch(0.17, 0.04, 300)),
      ...gloss(alpha(oklch(1, 0, 0), 0.35), alpha(oklch(0, 0, 0), 0.4)),
      'focus.ring.color': oklch(0.82, 0.12, 305),
    },
  ),
  preset(
    'anvil',
    'Anvil',
    {
      ...grays(0, 0),
      ...radii(0.1875, 0.375, 0.75),
      'chip.radius': rem(99),
      'badge.radius': rem(99),
      // Sizes from Anvil's component CSS. Buttons, fields and tabs are 16px.
      // Chips are 14px. A button is 40px on the page's 1.6 line height:
      // (40 - 16*1.6 - 2) / 2 = 6.2px of vertical padding. 48px tabs, 26px
      // chips whose round dismiss button fills the end, 18px badges, and 16px
      // card and popover padding.
      'button.base.font.size': rem(1),
      'field.font.size': rem(1),
      'chip.font.size': rem(0.875),
      'button.base.padding.x': rem(1),
      'button.base.padding.y': rem(0.3875),
      'field.padding.y': rem(0.4375),
      'tabs.padding.y': rem(0.875),
      'card.padding': rem(1),
      'popover.padding.x': rem(1),
      'popover.padding.y': rem(1),
      'field.picker.padding.x': rem(0.5),
      'field.picker.padding.y': rem(0.5),
      'option.radius': rem(0.375),
      'option.padding.x': rem(1),
      'option.leading': 1.2857,
      'option.list.gap': rem(0.25),
      'menu.item.radius': rem(0.375),
      'menu.item.padding.x': rem(0.5),
      'menu.item.leading': 1.2857,
      'dialog.padding.x': rem(1.5),
      'dialog.padding.y': rem(1.5),
      'calendar.day.size': rem(2.125),
      'chip.min-height': rem(1.625),
      'chip.padding.y': rem(0),
      'chip.gap': rem(0.25),
      'chip.leading': 1,
      'chip.font.weight': 600,
      'chip.icon.size': rem(1),
      'chip.dismiss.size': rem(1.5),
      'chip.dismiss.inset': rem(0),
      'badge.padding.x': rem(0.375),
      'badge.padding.y': rem(0.125),
      'badge.leading': 1,
      'alert.font.size': rem(1),
      'alert.leading': 1.5,
      'disclosure.summary.font.weight': 700,
      'breadcrumbs.current.font.weight': 700,
      'breadcrumbs.gap': rem(0.25),
      'avatar.font.weight': 700,
      'selection.font.size': rem(1),
      'font.family.sans': ['Nunito Sans', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      'font.weight.medium': 600,
      'font.weight.bold': 700,
      'alert.border-width': rem(0.125),
      'alert.padding.x': rem(1),
      'alert.padding.y': rem(1),
      'alert.title.font.weight': 700,
      'tabs.font.size': rem(1),
      // Track: 1px border, 4px padding, 6px radius, 8px gap.
      // Segment radius is 3px, not the button's 6px. Horizontal padding is the
      // button's 16px. The segment is 30px on the page's 1.6 line and a 1px
      // border: (30 - 16*1.6 - 2) / 2 = 1.2px. The track is that segment plus
      // the 4px padding and 1px border on each side.
      'togglegroup.border-width': rem(0.0625),
      'togglegroup.padding': rem(0.25),
      'togglegroup.radius': rem(0.375),
      'togglegroup.gap': rem(0.5),
      'togglegroup.item.radius': rem(0.1875),
      'togglegroup.item.pressed-ring-width': rem(0),
      'togglegroup.item.padding.y': rem(0.075),
    },
    anvilAppearance({
      ink: oklch(0.107, 0, 0),
      muted: oklch(0.545, 0, 0),
      canvas: oklch(1, 0, 0),
      raised: oklch(0.982, 0, 0),
      fill: oklch(0.949, 0, 0),
      fillHover: oklch(0.922, 0, 0),
      rule: oklch(0.925, 0, 0),
      control: oklch(0.637, 0, 0),
      track: oklch(0.82, 0, 0),
      thumb: oklch(1, 0, 0),
      accent: [oklch(0.532, 0.198, 258), oklch(0.438, 0.15, 261), oklch(0.336, 0.118, 257), oklch(1, 0, 0)],
      tint: oklch(0.954, 0.022, 254),
      tintStrong: oklch(0.908, 0.046, 253),
      danger: oklch(0.561, 0.215, 32),
      tint1: 0.06,
      wash: oklch(0.637, 0, 0),
      focus: oklch(0.532, 0.198, 258),
      segmentShadow: alpha(oklch(0.218, 0, 0), 0.08),
      dismissHover: alpha(oklch(0, 0, 0), 0.29),
      shadow: alpha(oklch(0.218, 0, 0), 0.08),
      status: {
        info: [oklch(0.908, 0.046, 253), oklch(0.827, 0.088, 253), oklch(0.248, 0.082, 255)],
        success: [oklch(0.922, 0.07, 169), oklch(0.857, 0.13, 166), oklch(0.26, 0.055, 163)],
        warning: [oklch(0.981, 0.031, 95), oklch(0.916, 0.13, 94), oklch(0.281, 0.058, 80)],
        critical: [oklch(0.951, 0.025, 30), oklch(0.821, 0.1, 30), oklch(0.261, 0.092, 35)],
      },
      alert: {
        info: [oklch(0.99, 0.005, 258), oklch(0.532, 0.198, 258)],
        success: [oklch(0.989, 0.01, 174), oklch(0.524, 0.119, 159)],
        warning: [oklch(0.996, 0.008, 99), oklch(0.672, 0.142, 74)],
        critical: [oklch(0.991, 0.004, 34), oklch(0.561, 0.215, 32)],
      },
    }),
    {
      // Anvil's dark surfaces sit higher than Todae's: #1a1a1a, #292929, #404040.
      'color.gray.950': oklch(0.218, 0, 0),
      'color.gray.900': oklch(0.218, 0, 0),
      'color.gray.850': oklch(0.281, 0, 0),
      'color.gray.800': oklch(0.371, 0, 0),
      'color.gray.700': oklch(0.446, 0, 0),
      ...anvilAppearance({
        ink: oklch(1, 0, 0),
        muted: oklch(0.82, 0, 0),
        canvas: oklch(0.218, 0, 0),
        raised: oklch(0.281, 0, 0),
        fill: oklch(0.371, 0, 0),
        fillHover: oklch(0.446, 0, 0),
        rule: oklch(0.371, 0, 0),
        control: oklch(0.446, 0, 0),
        track: oklch(0.545, 0, 0),
        thumb: oklch(0.218, 0, 0),
        // Anvil's #1a1a1a text on the blue reaches Lc 58, under Todae's 60, so
        // text on the accent is Anvil's darkest neutral instead.
        accent: [oklch(0.749, 0.132, 254), oklch(0.827, 0.088, 253), oklch(0.908, 0.046, 253), oklch(0.13, 0, 0)],
        tint: alpha(oklch(0.749, 0.132, 254), 0.2),
        tintStrong: alpha(oklch(0.749, 0.132, 254), 0.3),
        danger: oklch(0.686, 0.205, 33),
        tint1: 0.08,
        wash: oklch(1, 0, 0),
        focus: oklch(0.749, 0.132, 254),
        segmentShadow: alpha(oklch(1, 0, 0), 0.08),
        dismissHover: alpha(oklch(1, 0, 0), 0.39),
        shadow: alpha(oklch(0, 0, 0), 0.4),
        status: {
          info: [oklch(0.248, 0.082, 255), oklch(0.336, 0.118, 257), oklch(0.99, 0.005, 258)],
          success: [oklch(0.356, 0.077, 161), oklch(0.356, 0.077, 161), oklch(0.989, 0.01, 174)],
          warning: [oklch(0.281, 0.058, 80), oklch(0.443, 0.093, 76), oklch(0.996, 0.008, 99)],
          critical: [oklch(0.261, 0.092, 35), oklch(0.359, 0.134, 33), oklch(0.991, 0.004, 34)],
        },
        alert: {
          info: [oklch(0.145, 0.038, 247), oklch(0.827, 0.088, 253)],
          success: [oklch(0.151, 0.027, 172), oklch(0.857, 0.13, 166)],
          warning: [oklch(0.183, 0.037, 88), oklch(0.952, 0.082, 96)],
          critical: [oklch(0.105, 0.027, 51), oklch(0.821, 0.1, 30)],
        },
      }),
    },
  ),
];
