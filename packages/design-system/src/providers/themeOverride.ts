import {
  COMPONENT_OVERRIDE_KEYS,
  RAW_OVERRIDE_KEYS,
  SEMANTIC_OVERRIDE_KEYS,
  THEME_OVERRIDE_TYPES,
} from './themeOverrideKeys.generated';

export { COMPONENT_OVERRIDE_KEYS, RAW_OVERRIDE_KEYS, SEMANTIC_OVERRIDE_KEYS };

export const THEME_OVERRIDE_KEYS = [
  ...RAW_OVERRIDE_KEYS,
  ...SEMANTIC_OVERRIDE_KEYS,
  ...COMPONENT_OVERRIDE_KEYS,
] as const;

export type ThemeOverrideKey = (typeof THEME_OVERRIDE_KEYS)[number];

/** Every DTCG `$type` the token builder emits, so company keys may use types Todae's own tokens don't. */
export const THEME_OVERRIDE_TYPE_NAMES = [
  'color',
  'dimension',
  'fontWeight',
  'number',
  'duration',
  'cubicBezier',
  'fontFamily',
  'shadow',
  'textTransform',
] as const;
export type ThemeOverrideType = (typeof THEME_OVERRIDE_TYPE_NAMES)[number];
type GeneratedTypesAreKnown = (typeof THEME_OVERRIDE_TYPES)[ThemeOverrideKey] extends ThemeOverrideType ? true : never;
const generatedTypesAreKnown: GeneratedTypesAreKnown = true;
void generatedTypesAreKnown;

export type ThemeColorValue = {
  colorSpace: 'oklch';
  components: [number, number, number];
  alpha?: number;
};

export type ThemeDimensionValue = {
  value: number;
  unit: 'rem';
};

export type ThemeDurationValue = {
  value: number;
  unit: 'ms' | 's';
};

export type ThemeCubicBezierValue = readonly [number, number, number, number];

/** One family name, or a fallback list. Generic families such as `sans-serif` are left unquoted. */
export type ThemeFontFamilyValue = string | readonly string[];

export type ThemeShadowLayer = {
  color: ThemeColorValue;
  offsetX: ThemeLengthValue;
  offsetY: ThemeLengthValue;
  blur: ThemeLengthValue;
  spread: ThemeLengthValue;
  inset?: boolean;
};

export type ThemeLengthValue = {
  value: number;
  unit: 'px' | 'rem';
};

export type ThemeShadowValue = ThemeShadowLayer | readonly ThemeShadowLayer[];

/** Letter case. Todae's own `$type`: DTCG has none for it yet. */
export type ThemeTextTransformValue = 'none' | 'uppercase' | 'lowercase' | 'capitalize';
const TEXT_TRANSFORMS: readonly string[] = ['none', 'uppercase', 'lowercase', 'capitalize'] satisfies ThemeTextTransformValue[];

export type ThemeOverrideValue =
  | ThemeColorValue
  | ThemeDimensionValue
  | number
  | ThemeDurationValue
  | ThemeCubicBezierValue
  | ThemeFontFamilyValue
  | ThemeShadowValue
  | ThemeTextTransformValue;
export type ThemeOverride = { [K in ThemeOverrideKey]?: ThemeOverrideValue };

/** Types of extra override keys, such as `THEME_OVERRIDE_TYPES` from a company's `todae-tokens build`. */
export type ThemeOverrideTypes<Key extends string = string> = Readonly<Record<Key, ThemeOverrideType>>;

const KEYS = new Set<string>(THEME_OVERRIDE_KEYS);
const DEV = process.env.NODE_ENV !== 'production';
const HEX = /^#[0-9a-fA-F]{6}$/;
const PATH = /^[a-z][a-z0-9]*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/;
const OKLCH =
  /^oklch\(\s*(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s+(-?\d*\.?\d+)(?:\s*\/\s*(-?\d*\.?\d+))?\s*\)$/;
const REM = /^(-?\d*\.?\d+)rem$/;
const WEIGHT = /^(?:[1-9][0-9]{0,2}|1000)$/;
const NUMBER = /^-?\d*\.?\d+$/;

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
  return THEME_OVERRIDE_TYPES[key];
}

const OVERRIDE_TYPES = new Set<string>(THEME_OVERRIDE_TYPE_NAMES);
const GENERIC_FONT_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
]);
// Same character set as the token builder: names can't close a quote or the declaration.
const FONT_FAMILY = /^[A-Za-z0-9][A-Za-z0-9 _-]*$/;
const DURATION = /^(\d*\.?\d+)(ms|s)$/;
const LENGTH = /^(-?\d*\.?\d+)(px|rem)$/;

// Todae's own keys keep their catalog type whatever overrideTypes says.
function typeOf(key: string, extra: ThemeOverrideTypes | undefined): ThemeOverrideType | undefined {
  if (isThemeOverrideKey(key)) return THEME_OVERRIDE_TYPES[key];
  if (!extra || !Object.hasOwn(extra, key)) return undefined;
  const type = extra[key];
  return typeof type === 'string' && OVERRIDE_TYPES.has(type) ? type : undefined;
}

// Letter spacing may tighten; every other dimension, such as a radius or a gap, is a size.
function isSigned(key: string): boolean {
  return key.split('.').includes('letter-spacing');
}

function isValueOfType(type: ThemeOverrideType, value: unknown, key: string): value is ThemeOverrideValue {
  if (type === 'color') return isThemeColorValue(value);
  if (type === 'dimension') return isThemeDimensionValue(value) || (isSigned(key) && isRemValue(value));
  if (type === 'fontWeight') return isFontWeight(value);
  if (type === 'duration') return isThemeDurationValue(value);
  if (type === 'cubicBezier') return isThemeCubicBezierValue(value);
  if (type === 'fontFamily') return isThemeFontFamilyValue(value);
  if (type === 'shadow') return isThemeShadowValue(value);
  if (type === 'textTransform') return isThemeTextTransformValue(value);
  return isUnitlessNumber(value);
}

function valueCss(type: ThemeOverrideType, value: ThemeOverrideValue): string {
  if (type === 'color' && isThemeColorValue(value)) return themeColorCss(value);
  if (type === 'dimension' && isRemValue(value)) return `${value.value}${value.unit}`;
  if (type === 'duration' && isThemeDurationValue(value)) return `${value.value}${value.unit}`;
  if (type === 'cubicBezier' && isThemeCubicBezierValue(value)) return `cubic-bezier(${value.join(', ')})`;
  if (type === 'fontFamily' && isThemeFontFamilyValue(value)) {
    const names: readonly string[] = typeof value === 'string' ? [value] : value;
    return names.map((name) => (GENERIC_FONT_FAMILIES.has(name) ? name : `"${name}"`)).join(', ');
  }
  if (type === 'shadow' && isThemeShadowValue(value)) {
    const layers: readonly ThemeShadowLayer[] = Array.isArray(value) ? value : [value as ThemeShadowLayer];
    return layers
      .map((layer) => {
        const lengths = [layer.offsetX, layer.offsetY, layer.blur, layer.spread].map((l) => `${l.value}${l.unit}`);
        return `${layer.inset ? 'inset ' : ''}${lengths.join(' ')} ${themeColorCss(layer.color)}`;
      })
      .join(', ');
  }
  if (type === 'textTransform' && isThemeTextTransformValue(value)) return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function onlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

export function isThemeDurationValue(value: unknown): value is ThemeDurationValue {
  return (
    isRecord(value) &&
    onlyKeys(value, ['value', 'unit']) &&
    finite(value.value) &&
    value.value >= 0 &&
    (value.unit === 'ms' || value.unit === 's')
  );
}

export function isThemeTextTransformValue(value: unknown): value is ThemeTextTransformValue {
  return typeof value === 'string' && TEXT_TRANSFORMS.includes(value);
}

export function isThemeCubicBezierValue(value: unknown): value is ThemeCubicBezierValue {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(finite)) return false;
  const [x1, , x2] = value as number[];
  return x1! >= 0 && x1! <= 1 && x2! >= 0 && x2! <= 1;
}

export function isThemeFontFamilyValue(value: unknown): value is ThemeFontFamilyValue {
  const names = typeof value === 'string' ? [value] : value;
  return (
    Array.isArray(names) &&
    names.length > 0 &&
    names.every((name) => typeof name === 'string' && FONT_FAMILY.test(name))
  );
}

function isLength(value: unknown): value is ThemeLengthValue {
  return (
    isRecord(value) &&
    onlyKeys(value, ['value', 'unit']) &&
    finite(value.value) &&
    (value.unit === 'px' || value.unit === 'rem')
  );
}

function isShadowLayer(value: unknown): value is ThemeShadowLayer {
  if (!isRecord(value) || !onlyKeys(value, ['color', 'offsetX', 'offsetY', 'blur', 'spread', 'inset'])) return false;
  if (value.inset !== undefined && typeof value.inset !== 'boolean') return false;
  if (!isThemeColorValue(value.color)) return false;
  if (![value.offsetX, value.offsetY, value.blur, value.spread].every(isLength)) return false;
  return (value.blur as ThemeLengthValue).value >= 0;
}

export function isThemeShadowValue(value: unknown): value is ThemeShadowValue {
  if (Array.isArray(value)) return value.length > 0 && value.every(isShadowLayer);
  return isShadowLayer(value);
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
  return isRemValue(value) && value.value >= 0;
}

function isRemValue(value: unknown): value is ThemeDimensionValue {
  return isRecord(value) && onlyKeys(value, ['value', 'unit']) && finite(value.value) && value.unit === 'rem';
}

function isFontWeight(value: unknown): value is number {
  return finite(value) && Number.isInteger(value) && value >= 1 && value <= 1000;
}

function isUnitlessNumber(value: unknown): value is number {
  return finite(value);
}

export function isThemeOverrideValue(key: ThemeOverrideKey, value: unknown): value is ThemeOverrideValue {
  return isValueOfType(themeOverrideType(key), value, key);
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
    return isValueOfType(type, dimension, key) ? dimension : null;
  }
  if (type === 'fontWeight') return WEIGHT.test(value) ? Number(value) : null;
  if (type === 'duration') {
    const match = value.match(DURATION);
    return match ? { value: Number(match[1]), unit: match[2] as ThemeDurationValue['unit'] } : null;
  }
  if (type === 'cubicBezier') {
    const inner = value.match(/^cubic-bezier\((.*)\)$/)?.[1] ?? value;
    const parts = inner.split(',').map((part) => part.trim());
    if (!parts.every((part) => NUMBER.test(part))) return null;
    const curve = parts.map(Number);
    return isThemeCubicBezierValue(curve) ? curve : null;
  }
  if (type === 'fontFamily') {
    const names = value.split(',').map((name) => name.trim().replace(/^(["'])(.*)\1$/, '$2'));
    return isThemeFontFamilyValue(names) ? names : null;
  }
  if (type === 'shadow') return parseShadow(value);
  if (type === 'textTransform') return isThemeTextTransformValue(value) ? value : null;
  if (!NUMBER.test(value)) return null;
  const n = Number(value);
  return isUnitlessNumber(n) ? n : null;
}

// `[inset] <x> <y> <blur> <spread> <color>` layers, comma-separated. Colors are
// hex or oklch(), neither of which contains a comma.
function parseShadow(raw: string): ThemeShadowValue | null {
  const layers: ThemeShadowLayer[] = [];
  for (const part of raw.split(',')) {
    const match = part.trim().match(/^(inset\s+)?(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.+)$/);
    if (!match) return null;
    const lengths = match.slice(2, 6).map((length) => {
      const m = length!.match(LENGTH);
      return m ? { value: Number(m[1]), unit: m[2] as ThemeLengthValue['unit'] } : null;
    });
    const color = parseThemeColor(match[6]!);
    if (!color || lengths.some((length) => length === null)) return null;
    const [offsetX, offsetY, blur, spread] = lengths as ThemeLengthValue[];
    const layer: ThemeShadowLayer = { color, offsetX: offsetX!, offsetY: offsetY!, blur: blur!, spread: spread! };
    if (match[1]) layer.inset = true;
    layers.push(layer);
  }
  if (!isThemeShadowValue(layers)) return null;
  return layers.length === 1 ? layers[0]! : layers;
}

export function themeColorCss(value: ThemeColorValue): string {
  const [l, c, h] = value.components;
  return value.alpha === undefined || value.alpha === 1
    ? `oklch(${l} ${c} ${h})`
    : `oklch(${l} ${c} ${h} / ${value.alpha})`;
}

export function themeValueCss(key: ThemeOverrideKey, value: ThemeOverrideValue): string {
  return valueCss(themeOverrideType(key), value);
}

export function cssVarName(path: string): string {
  return `--todae-${path.replaceAll('.', '-')}`;
}

function reject(message: string): void {
  if (DEV) throw new Error(message);
}

export function themeOverrideStyle(overrides: unknown, overrideTypes?: ThemeOverrideTypes): Record<string, string> {
  if (overrides == null) return {};
  if (!isRecord(overrides)) {
    reject('ThemeProvider overrides must be an object');
    return {};
  }
  const style: Record<string, string> = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    const type = typeOf(key, overrideTypes);
    if (!type || !PATH.test(key)) {
      reject(`Unknown theme override "${key}"`);
      continue;
    }
    if (!isValueOfType(type, value, key)) {
      reject(`Invalid theme override value for "${key}"`);
      continue;
    }
    style[cssVarName(key)] = valueCss(type, value);
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
