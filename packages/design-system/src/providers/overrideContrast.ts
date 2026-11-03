import { apcaContrast, clamp01, compositeSrgb, oklchToSrgb, type Rgb, type Rgba } from '../color/apca.js';
import { cssVarName } from './themeOverride.js';
import { CONTRAST_PAIRS } from './themeOverrideKeys.generated.js';

// Measures with the same OKLCH and APCA math as the token build
// (src/color/apca.ts), so a runtime override is measured the way a built
// theme is.

const COLOR_RE = /* @__PURE__ */ colorPattern();

function colorPattern(): RegExp {
  const number = String.raw`(-?\d*\.?\d+(?:e-?\d+)?|none)(%?)`;
  return new RegExp(
    String.raw`^(rgba?|oklch|color)\(\s*(?:srgb\s+)?${number}[\s,]+${number}[\s,]+${number}(?:\s*[/,]\s*${number})?\s*\)$`,
  );
}

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
    const [r, g, b] = oklchToSrgb({ l: num(1, 1)!, c: num(2, 0.4)!, h: num(3, 1)! });
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
        let base: Rgb | null = null;
        if (text && back) {
          if (surface === undefined) {
            if (back[3] === 1) base = [back[0], back[1], back[2]];
          } else {
            const under = colorOf(surface);
            if (under && under[3] === 1) base = compositeSrgb(back, under);
          }
        }
        if (!text || !base) {
          skipped.push(key);
          continue;
        }
        const lc = Math.abs(apcaContrast(compositeSrgb(text, base), base));
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
