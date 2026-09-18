export const RAW_OVERRIDE_KEYS = [
  'color.blue.400',
  'color.blue.500',
  'color.blue.600',
  'color.red.400',
  'color.red.500',
  'color.red.600',
  'color.gray.50',
  'color.gray.100',
  'color.gray.200',
  'color.gray.300',
  'color.gray.400',
  'color.gray.500',
  'color.gray.600',
  'color.gray.700',
  'color.gray.800',
  'color.gray.900',
  'color.gray.950',
  'font.leading.default',
  'font.size.1',
  'font.size.2',
  'font.size.3',
  'font.size.4',
  'font.size.5',
  'font.size.6',
  'font.weight.bold',
  'font.weight.medium',
  'font.weight.regular',
  'radius.lg',
  'radius.md',
  'radius.sm',
  'space.1',
  'space.2',
  'space.3',
  'space.4',
  'space.5',
  'space.6',
  'space.7',
  'space.8',
  'space.9',
  'space.10',
  'space.11',
  'space.12',
] as const;

export const SEMANTIC_OVERRIDE_KEYS = [
  'color.bg.canvas',
  'color.bg.surface',
  'color.bg.subtle',
  'color.bg.elevated',
  'color.bg.scrim',
  'color.bg.transparent',
  'color.bg.highlight',
  'color.bg.selected',
  'color.fg.default',
  'color.fg.muted',
  'color.fg.placeholder',
  'color.border.default',
  'color.border.subtle',
  'color.accent.default',
  'color.accent.hover',
  'color.accent.active',
  'color.accent.soft',
  'color.accent.soft-strong',
  'color.on-accent',
  'color.danger.default',
  'space.control.x',
  'space.control.y',
  'space.stack.gap',
  'space.inline.gap',
  'space.chip.x',
  'space.chip.y',
  'space.field.gap',
  'space.overlay.padding',
  'space.overlay.gap',
] as const;

const BUTTON_PAINT_OVERRIDE_KEYS = (['primary', 'secondary', 'ghost'] as const).flatMap((variant) => [
  `button.${variant}.bg.default`,
  `button.${variant}.bg.hover`,
  `button.${variant}.bg.active`,
  `button.${variant}.bg.focus`,
  `button.${variant}.bg.disabled`,
  `button.${variant}.fg.default`,
  `button.${variant}.fg.hover`,
  `button.${variant}.fg.active`,
  `button.${variant}.fg.focus`,
  `button.${variant}.fg.disabled`,
  `button.${variant}.border.default`,
  `button.${variant}.border.hover`,
  `button.${variant}.border.active`,
  `button.${variant}.border.focus`,
  `button.${variant}.border.disabled`,
  `button.${variant}.ring.focus`,
] as const);

export const COMPONENT_OVERRIDE_KEYS = [
  'button.base.radius',
  'button.base.padding.x',
  'button.base.padding.y',
  'button.base.font.size',
  'button.base.font.weight',
  'button.base.gap',
  ...BUTTON_PAINT_OVERRIDE_KEYS,
  'stack.gap',
  'text.fg.default',
  'text.fg.muted',
  'text.fg.accent',
  'text.size.1',
  'text.size.2',
  'text.size.3',
  'text.size.4',
  'text.size.5',
  'text.size.6',
  'text.weight.regular',
  'text.weight.medium',
  'text.weight.bold',
  'text.leading.default',
  'field.radius',
  'field.padding.x',
  'field.padding.y',
  'field.gap',
  'field.font.size',
  'field.min-width',
  'field.bg.default',
  'field.bg.disabled',
  'field.fg.default',
  'field.fg.disabled',
  'field.fg.placeholder',
  'field.fg.adornment',
  'field.border.default',
  'field.border.hover',
  'field.border.focus',
  'field.border.disabled',
  'field.border.invalid',
  'field.ring.focus',
  'field.ring.invalid',
  'field.label.gap',
  'field.label.font.size',
  'field.label.font.weight',
  'field.label.fg',
  'chip.radius',
  'chip.padding.x',
  'chip.padding.y',
  'chip.gap',
  'chip.font.size',
  'chip.bg.default',
  'chip.bg.hover',
  'chip.bg.focus',
  'chip.bg.disabled',
  'chip.fg.default',
  'chip.fg.hover',
  'chip.fg.focus',
  'chip.fg.disabled',
  'chip.border.default',
  'chip.border.hover',
  'chip.border.focus',
  'chip.border.disabled',
  'chip.ring.focus',
  'chip.dismiss.fg.default',
  'chip.dismiss.fg.hover',
  'overlay.scrim.bg',
  'dialog.bg',
  'dialog.fg',
  'dialog.border',
  'dialog.radius',
  'dialog.padding.x',
  'dialog.padding.y',
  'dialog.gap',
  'dialog.max-width',
  'dialog.title.font.size',
  'dialog.title.font.weight',
  'sheet.bg',
  'sheet.fg',
  'sheet.border',
  'sheet.radius',
  'sheet.padding.x',
  'sheet.padding.y',
  'sheet.gap',
  'sheet.grabber.bg',
  'sheet.grabber.width',
  'sheet.grabber.height',
  'sheet.handle.hit',
  'sheet.snap.mid',
  'sheet.snap.full-inset',
  'popover.bg',
  'popover.fg',
  'popover.border',
  'popover.radius',
  'popover.padding.x',
  'popover.padding.y',
  'popover.gap',
  'popover.max-height',
  'option.radius',
  'option.padding.x',
  'option.padding.y',
  'option.font.size',
  'option.font.weight',
  'option.bg.default',
  'option.bg.hover',
  'option.bg.selected',
  'option.bg.selected-highlighted',
  'option.fg.default',
  'option.fg.selected',
  'option.check.fg',
  'option.check.border',
] as const;

export const THEME_OVERRIDE_KEYS = [
  ...RAW_OVERRIDE_KEYS,
  ...SEMANTIC_OVERRIDE_KEYS,
  ...COMPONENT_OVERRIDE_KEYS,
] as const;

export type ThemeOverrideKey = (typeof THEME_OVERRIDE_KEYS)[number];
export type ThemeOverrideType = 'color' | 'dimension' | 'fontWeight' | 'number';

export type ThemeColorValue = {
  colorSpace: 'oklch';
  components: [number, number, number];
  alpha?: number;
};

export type ThemeDimensionValue = {
  value: number;
  unit: 'rem';
};

export type ThemeOverrideValue = ThemeColorValue | ThemeDimensionValue | number;
export type ThemeOverride = { [K in ThemeOverrideKey]?: ThemeOverrideValue };

const KEYS = new Set<string>(THEME_OVERRIDE_KEYS);
const DEV = process.env.NODE_ENV !== 'production';
const HEX = /^#[0-9a-fA-F]{6}$/;
const OKLCH =
  /^oklch\(\s*(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s+(-?\d*\.?\d+)(?:\s*\/\s*(-?\d*\.?\d+))?\s*\)$/;
const REM = /^(-?\d*\.?\d+)rem$/;
const WEIGHT = /^(?:[1-9][0-9]{0,2}|1000)$/;
const NUMBER = /^-?\d*\.?\d+$/;

const COLOR_KEYS = new Set<string>([
  ...RAW_OVERRIDE_KEYS.filter((key) => key.startsWith('color.')),
  ...SEMANTIC_OVERRIDE_KEYS.filter((key) => key.startsWith('color.')),
  ...COMPONENT_OVERRIDE_KEYS.filter(
    (key) =>
      /^button\.(primary|secondary|ghost)\.(bg|fg|border)\./.test(key) ||
      /^button\.(primary|secondary|ghost)\.ring\.focus$/.test(key) ||
      /^(field|chip|dialog|sheet|overlay|popover|option)\.(bg|fg|border|ring|dismiss|grabber|scrim|check)(?:\.|$)/.test(key) ||
      key === 'field.label.fg' ||
      key.startsWith('text.fg.'),
  ),
]);

const WEIGHT_KEYS = new Set<string>([
  'font.weight.bold',
  'font.weight.medium',
  'font.weight.regular',
  'button.base.font.weight',
  'text.weight.regular',
  'text.weight.medium',
  'text.weight.bold',
  'dialog.title.font.weight',
  'field.label.font.weight',
  'option.font.weight',
]);

const NUMBER_KEYS = new Set<string>(['font.leading.default', 'text.leading.default', 'sheet.snap.mid']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

export function isThemeOverrideKey(key: string): key is ThemeOverrideKey {
  return KEYS.has(key);
}

export function themeOverrideType(key: ThemeOverrideKey): ThemeOverrideType {
  if (COLOR_KEYS.has(key)) return 'color';
  if (WEIGHT_KEYS.has(key)) return 'fontWeight';
  if (NUMBER_KEYS.has(key)) return 'number';
  return 'dimension';
}

export function isThemeColorValue(value: unknown): value is ThemeColorValue {
  if (!isRecord(value) || value.colorSpace !== 'oklch' || !Array.isArray(value.components)) {
    return false;
  }
  const extra = Object.keys(value).filter((key) => !['colorSpace', 'components', 'alpha'].includes(key));
  if (extra.length > 0) return false;
  const [l, c, h] = value.components;
  if (value.components.length !== 3 || !finite(l) || !finite(c) || !finite(h)) return false;
  if (l < 0 || l > 1 || c < 0) return false;
  if (value.alpha !== undefined && (!finite(value.alpha) || value.alpha < 0 || value.alpha > 1)) {
    return false;
  }
  return true;
}

export function isThemeDimensionValue(value: unknown): value is ThemeDimensionValue {
  if (!isRecord(value)) return false;
  const extra = Object.keys(value).filter((key) => !['value', 'unit'].includes(key));
  return extra.length === 0 && finite(value.value) && value.value >= 0 && value.unit === 'rem';
}

function isFontWeight(value: unknown): value is number {
  return finite(value) && Number.isInteger(value) && value >= 1 && value <= 1000;
}

function isUnitlessNumber(value: unknown): value is number {
  return finite(value);
}

export function isThemeOverrideValue(key: ThemeOverrideKey, value: unknown): value is ThemeOverrideValue {
  const type = themeOverrideType(key);
  if (type === 'color') return isThemeColorValue(value);
  if (type === 'dimension') return isThemeDimensionValue(value);
  if (type === 'fontWeight') return isFontWeight(value);
  return isUnitlessNumber(value);
}

export function parseThemeColor(raw: string): ThemeColorValue | null {
  const value = raw.trim();
  if (HEX.test(value)) return hexToOklch(value);
  const match = value.match(OKLCH);
  if (!match) return null;
  const color: ThemeColorValue = {
    colorSpace: 'oklch',
    components: [Number(match[1]), Number(match[2]), Number(match[3])],
  };
  if (match[4] !== undefined) color.alpha = Number(match[4]);
  return isThemeColorValue(color) ? color : null;
}

export function parseThemeValue(key: ThemeOverrideKey, raw: string): ThemeOverrideValue | null {
  const type = themeOverrideType(key);
  const value = raw.trim();
  if (type === 'color') return parseThemeColor(value);
  if (type === 'dimension') {
    const match = value.match(REM);
    if (!match) return null;
    const dimension: ThemeDimensionValue = { value: Number(match[1]), unit: 'rem' };
    return isThemeDimensionValue(dimension) ? dimension : null;
  }
  if (type === 'fontWeight') return WEIGHT.test(value) ? Number(value) : null;
  if (!NUMBER.test(value)) return null;
  const n = Number(value);
  return isUnitlessNumber(n) ? n : null;
}

export function themeColorCss(value: ThemeColorValue): string {
  const [l, c, h] = value.components;
  return value.alpha === undefined || value.alpha === 1
    ? `oklch(${l} ${c} ${h})`
    : `oklch(${l} ${c} ${h} / ${value.alpha})`;
}

export function themeValueCss(key: ThemeOverrideKey, value: ThemeOverrideValue): string {
  if (themeOverrideType(key) === 'color' && isThemeColorValue(value)) return themeColorCss(value);
  if (isThemeDimensionValue(value)) return `${value.value}${value.unit}`;
  if (typeof value === 'number') return String(value);
  return '';
}

export function cssVarName(path: ThemeOverrideKey): string {
  return `--todae-${path.replaceAll('.', '-')}`;
}

function reject(message: string): void {
  if (DEV) throw new Error(message);
}

export function themeOverrideStyle(overrides: unknown): Record<string, string> {
  if (overrides == null) return {};
  if (!isRecord(overrides)) {
    reject('ThemeProvider overrides must be an object');
    return {};
  }
  const style: Record<string, string> = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    if (!isThemeOverrideKey(key)) {
      reject(`Unknown theme override "${key}"`);
      continue;
    }
    if (!isThemeOverrideValue(key, value)) {
      reject(`Invalid theme override value for "${key}"`);
      continue;
    }
    style[cssVarName(key)] = themeValueCss(key, value);
  }
  return style;
}

function hexToOklch(hex: string): ThemeColorValue {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const b2 = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(a, b2);
  const H = (Math.atan2(b2, a) * 180) / Math.PI;
  return {
    colorSpace: 'oklch',
    components: [round(L), round(C), round(H < 0 ? H + 360 : H)],
  };
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
