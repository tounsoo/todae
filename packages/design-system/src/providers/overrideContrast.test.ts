import { describe, expect, it } from 'vitest';
import { apcaContrast as builtApca, composite as builtComposite, oklchToSrgb as builtOklch } from '../../scripts/build-tokens.js';
import { apcaContrast, composite, oklchToSrgb, parseComputedColor } from './overrideContrast.js';

describe('override contrast math', () => {
  it('measures exactly as the token build does', () => {
    for (const l of [0, 0.145, 0.5, 0.82, 1]) {
      for (const [c, h] of [
        [0, 0],
        [0.12, 25],
        [0.2, 250],
      ] as const) {
        expect(oklchToSrgb(l, c, h)).toEqual(builtOklch({ l, c, h }));
      }
    }
    const samples = [0, 0.2, 0.45, 0.6, 0.9, 1].map((v): [number, number, number] => [v, v * 0.9, v * 0.8]);
    for (const text of samples) for (const back of samples) expect(apcaContrast(text, back)).toBe(builtApca(text, back));
    for (const alpha of [0, 0.2, 0.45, 1]) {
      for (const back of samples) {
        const top = { l: 0.6, c: 0.12, h: 250, alpha };
        expect(composite([...builtOklch(top), alpha], back)).toEqual(builtComposite(top, back));
      }
    }
  });

  it('reads the color syntaxes browsers compute', () => {
    expect(parseComputedColor('rgb(255, 0, 51)')).toEqual([1, 0, 0.2, 1]);
    expect(parseComputedColor('rgba(0, 0, 0, 0.5)')).toEqual([0, 0, 0, 0.5]);
    expect(parseComputedColor('color(srgb 1 0.5 0 / 0.25)')).toEqual([1, 0.5, 0, 0.25]);
    expect(parseComputedColor('oklch(1 0 0)')).toEqual([...builtOklch({ l: 1, c: 0, h: 0 }), 1]);
    expect(parseComputedColor('oklch(0.6 0.012 255 / 0.2)')).toEqual([...builtOklch({ l: 0.6, c: 0.012, h: 255 }), 0.2]);
    expect(parseComputedColor('oklch(0.5 none 0)')).toEqual([...builtOklch({ l: 0.5, c: 0, h: 0 }), 1]);
    // Out-of-gamut channels clip, as a screen does, instead of turning into NaN.
    expect(parseComputedColor('color(srgb 1.32 -0.45 -0.31)')).toEqual([1, 0, 0, 1]);
    expect(parseComputedColor('lab(50 20 30)')).toBeNull();
    expect(parseComputedColor('color(display-p3 1 0 0)')).toBeNull();
    expect(parseComputedColor('var(--todae-x)')).toBeNull();
  });
});
