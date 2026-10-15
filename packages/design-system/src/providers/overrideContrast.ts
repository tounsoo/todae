import { cssVarName } from './themeOverride';
import { CONTRAST_PAIRS } from './themeOverrideKeys.generated';

// The same APCA-W3 0.0.98G-4g math as the token build (scripts/build-tokens.ts),
// so a runtime override is measured the way a built theme is. A test keeps the
// two in step.

/** Gamma-encoded sRGB in [0, 1], with alpha. */
export type Rgba = [r: number, g: number, b: number, alpha: number];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function encodeSrgb(linear: number): number {
  const v = clamp01(linear);
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
}

/** OKLCH to gamma-encoded sRGB, clipped to the sRGB gamut. */
export function oklchToSrgb(l: number, c: number, h: number): [number, number, number] {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    encodeSrgb(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    encodeSrgb(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    encodeSrgb(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ];
}

function screenLuminance([r, g, b]: readonly number[]): number {
  const y = 0.2126729 * r! ** 2.4 + 0.7151522 * g! ** 2.4 + 0.072175 * b! ** 2.4;
  return y > 0.022 ? y : y + (0.022 - y) ** 1.414;
}

/** APCA Lc of `text` on `background`, both gamma-encoded sRGB. */
export function apcaContrast(text: readonly number[], background: readonly number[]): number {
  const yt = screenLuminance(text);
  const yb = screenLuminance(background);
  if (Math.abs(yb - yt) < 0.0005) return 0;
  if (yb > yt) {
    const sapc = (yb ** 0.56 - yt ** 0.57) * 1.14;
    return sapc < 0.1 ? 0 : (sapc - 0.027) * 100;
  }
  const sapc = (yb ** 0.65 - yt ** 0.62) * 1.14;
  return sapc > -0.1 ? 0 : (sapc + 0.027) * 100;
}

/** Paints `top` with its alpha over an opaque `bottom`, as browsers composite. */
export function composite(top: Rgba, bottom: readonly number[]): [number, number, number] {
  return [0, 1, 2].map((i) => top[i]! * top[3] + bottom[i]! * (1 - top[3])) as [number, number, number];
}

const NUMBER = String.raw`(-?\d*\.?\d+(?:e-?\d+)?|none)(%?)`;
const COLOR_RE = new RegExp(
  String.raw`^(rgba?|oklch|color)\(\s*(?:srgb\s+)?${NUMBER}[\s,]+${NUMBER}[\s,]+${NUMBER}(?:\s*[/,]\s*${NUMBER})?\s*\)$`,
);

/**
 * Parses a computed color: `rgb()`/`rgba()`, `oklch()` or `color(srgb …)`,
 * which is how browsers serialize Todae's colors. Returns null for any other
 * color space, which the check then skips.
 */
export function parseComputedColor(value: string): Rgba | null {
  const match = COLOR_RE.exec(value.trim());
  if (!match) return null;
  const fn = match[1]!;
  if (fn === 'color' && !value.includes('srgb')) return null;
  const num = (i: number, scale: number) => {
    const raw = match[i * 2];
    if (raw === undefined) return undefined;
    if (raw === 'none') return 0;
    const n = Number(raw);
    return match[i * 2 + 1] === '%' ? (n / 100) * scale : n;
  };
  const alpha = num(4, 1) ?? 1;
  if (fn === 'oklch') {
    const [r, g, b] = oklchToSrgb(num(1, 1)!, num(2, 0.4)!, num(3, 1)!);
    return [r, g, b, alpha];
  }
  const scale = fn === 'color' ? 1 : 255;
  // An out-of-gamut color(srgb …) can have channels past 0–1; a screen clips them.
  return [clamp01(num(1, scale)! / scale), clamp01(num(2, scale)! / scale), clamp01(num(3, scale)! / scale), alpha];
}

export type ContrastFailure = { fg: string; bg: string; over?: string; min: number; lc: number };

export type ContrastMeasure = {
  failures: ContrastFailure[];
  /** Pairs not measured: a color this check can't read, or a translucent background with no surface under it. */
  skipped: string[];
};

const pairKey = ({ fg, bg, over }: { fg: string; bg: string; over?: string }) => `${fg} on ${bg}${over ? ` over ${over}` : ''}`;

/**
 * Measures Todae's declared contrast pairs where `element` sits, from the
 * colors the browser computes there, so aliases, relative colors and
 * overrides all resolve as they render. A token not defined there, or a color
 * in a space this check can't read, skips its pair.
 */
export function measureContrast(element: HTMLElement): ContrastMeasure {
  const probe = element.ownerDocument.createElement('span');
  probe.hidden = true;
  // Forced colors would replace the probe's color with the system's.
  probe.style.forcedColorAdjust = 'none';
  element.append(probe);
  const defined = getComputedStyle(element);
  const colors = new Map<string, Rgba | null>();
  const colorOf = (path: string): Rgba | null => {
    if (colors.has(path)) return colors.get(path)!;
    const name = cssVarName(path);
    let color: Rgba | null = null;
    // An undefined custom property would leave the probe with the inherited text color.
    if (defined.getPropertyValue(name).trim() !== '') {
      probe.style.color = `var(${name})`;
      color = parseComputedColor(getComputedStyle(probe).color);
    }
    colors.set(path, color);
    return color;
  };
  const failures: ContrastFailure[] = [];
  const skipped: string[] = [];
  try {
    for (const { fg, bg, min, over } of CONTRAST_PAIRS) {
      const text = colorOf(fg);
      const back = colorOf(bg);
      for (const surface of over ?? [undefined]) {
        const key = pairKey({ fg, bg, over: surface });
        let base: [number, number, number] | null = null;
        if (text && back) {
          if (surface === undefined) {
            if (back[3] === 1) base = [back[0], back[1], back[2]];
          } else {
            const under = colorOf(surface);
            if (under && under[3] === 1) base = composite(back, under);
          }
        }
        if (!text || !base) {
          skipped.push(key);
          continue;
        }
        const lc = Math.abs(apcaContrast(composite(text, base), base));
        if (lc < min) failures.push(surface === undefined ? { fg, bg, min, lc } : { fg, bg, over: surface, min, lc });
      }
    }
  } finally {
    probe.remove();
  }
  return { failures, skipped };
}

/**
 * The pairs that fail on `element` with its overrides but pass on the same
 * element without them: a pair that already fails without them, from the page
 * around it, a class or the caller's style, isn't blamed on the overrides.
 * `names` are the custom properties the overrides set on `element`'s inline
 * style; `underneath` holds the caller's own value for any of those names,
 * which an override replaced.
 */
export function overrideContrastFailures(element: HTMLElement, names: readonly string[], underneath: Readonly<Record<string, string>>): ContrastFailure[] {
  // Measure with the overrides first: that style flush is the one newly mounted
  // elements take as their first style, so nothing transitions from the defaults.
  const failures = measureContrast(element).failures;
  if (failures.length === 0) return failures;
  // Restore through CSSOM, as React writes: a style attribute round trip can
  // drop shorthand longhands, and a strict CSP blocks setAttribute('style').
  const saved = names.map((name) => [name, element.style.getPropertyValue(name), element.style.getPropertyPriority(name)] as const);
  let before: Set<string>;
  try {
    for (const name of names) {
      // Remove first: the browser ignores a value it rejects, which would
      // leave the override in place.
      element.style.removeProperty(name);
      const value = underneath[name];
      if (value !== undefined) element.style.setProperty(name, value);
    }
    before = new Set(measureContrast(element).failures.map(pairKey));
  } finally {
    for (const [name, value, priority] of saved) {
      element.style.removeProperty(name);
      if (value !== '') element.style.setProperty(name, value, priority);
    }
    // Flush again now, so a transition the baseline started ends where it began.
    void getComputedStyle(element).color;
  }
  return failures.filter((failure) => !before.has(pairKey(failure)));
}

/** A key for a set of failures, the same while the same pairs fail. */
export function failureKey(failures: readonly ContrastFailure[]): string {
  return failures.map(pairKey).sort().join('|');
}

/** The message naming the pairs the overrides push below Todae's minimum. */
export function overrideContrastMessage(failures: ContrastFailure[], appearance: string): string {
  const lines = failures.map(({ fg, bg, over, min, lc }) => `${pairKey({ fg, bg, over })} is Lc ${lc.toFixed(1)}, below ${min}`);
  return (
    `ThemeProvider overrides push ${failures.length} of Todae's APCA contrast pairs below their minimum in ${appearance}:\n  ${lines.join('\n  ')}\n` +
    'Overrides are only checked here, in development.'
  );
}
