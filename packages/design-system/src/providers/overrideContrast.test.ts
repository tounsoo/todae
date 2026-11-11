import { describe, expect, it } from 'vitest';
import { oklchToSrgb } from '../color/apca.js';
import { parseComputedColor } from './overrideContrast.js';

describe('override contrast colors', () => {
  it('reads the color syntaxes browsers compute', () => {
    expect(parseComputedColor('rgb(255, 0, 51)')).toEqual([1, 0, 0.2, 1]);
    expect(parseComputedColor('rgba(0, 0, 0, 0.5)')).toEqual([0, 0, 0, 0.5]);
    expect(parseComputedColor('color(srgb 1 0.5 0 / 0.25)')).toEqual([1, 0.5, 0, 0.25]);
    expect(parseComputedColor('oklch(1 0 0)')).toEqual([...oklchToSrgb({ l: 1, c: 0, h: 0 }), 1]);
    expect(parseComputedColor('oklch(0.6 0.012 255 / 0.2)')).toEqual([...oklchToSrgb({ l: 0.6, c: 0.012, h: 255 }), 0.2]);
    expect(parseComputedColor('oklch(0.5 none 0)')).toEqual([...oklchToSrgb({ l: 0.5, c: 0, h: 0 }), 1]);
    // Out-of-gamut channels clip, as a screen does, instead of turning into NaN.
    expect(parseComputedColor('color(srgb 1.32 -0.45 -0.31)')).toEqual([1, 0, 0, 1]);
    expect(parseComputedColor('lab(50 20 30)')).toBeNull();
    expect(parseComputedColor('color(display-p3 1 0 0)')).toBeNull();
    expect(parseComputedColor('var(--todae-x)')).toBeNull();
  });
});
