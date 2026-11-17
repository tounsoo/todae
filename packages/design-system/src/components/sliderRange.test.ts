import { describe, expect, it } from 'vitest';
import {
  moveThumb,
  nearestThumb,
  normalizeRange,
  rangePercents,
  readScale,
  snap,
  valueFromPointer,
  type SliderRangeValue,
} from './sliderRange.js';

const scale = readScale({ min: 0, max: 100, step: 1 });

describe('readScale', () => {
  it('uses the HTML defaults when a bound is missing or an empty string', () => {
    expect(readScale()).toEqual({ min: 0, max: 100, step: 1 });
    expect(readScale({ min: '', max: '', step: '' })).toEqual({ min: 0, max: 100, step: 1 });
  });

  it('keeps step any and parses numeric strings', () => {
    expect(readScale({ min: '10', max: '40', step: 'any' })).toEqual({ min: 10, max: 40, step: 'any' });
    expect(readScale({ step: '2.5' }).step).toBe(2.5);
  });

  it('replaces a non-finite bound with its default and a step that is not a positive finite number with 1', () => {
    expect(readScale({ min: Number.NaN, max: Number.POSITIVE_INFINITY })).toEqual({ min: 0, max: 100, step: 1 });
    expect(readScale({ step: 0 }).step).toBe(1);
    expect(readScale({ step: -2 }).step).toBe(1);
    expect(readScale({ step: 'nope' }).step).toBe(1);
    expect(readScale({ step: Number.POSITIVE_INFINITY }).step).toBe(1);
  });

  it('collapses max to min when min is greater', () => {
    expect(readScale({ min: 8, max: 3 })).toEqual({ min: 8, max: 8, step: 1 });
    expect(readScale({ min: '50', max: '10' })).toMatchObject({ min: 50, max: 50 });
  });
});

describe('snap', () => {
  it('rounds to the nearest step and clamps to the scale', () => {
    expect(snap(20.4, scale)).toBe(20);
    expect(snap(20.5, scale)).toBe(21);
    expect(snap(-4, scale)).toBe(0);
    expect(snap(140, scale)).toBe(100);
  });

  it('clamps without rounding when the step is any', () => {
    const any = readScale({ step: 'any' });
    expect(snap(20.4, any)).toBe(20.4);
    expect(snap(-1, any)).toBe(0);
    expect(snap(101, any)).toBe(100);
  });

  it('stays on a decimal step and does not pass a max that is off the step', () => {
    const tenths = readScale({ min: 0, max: 1, step: 0.1 });
    expect(snap(0.3, tenths)).toBe(0.3);
    expect(snap(0.25, tenths)).toBe(0.3);
    const stepped = readScale({ min: 0, max: 10, step: 3 });
    expect(snap(10, stepped)).toBe(9);
    expect(snap(8, stepped)).toBe(9);
  });

  it('keeps a step whose text is a scientific number with a fraction', () => {
    const fine = readScale({ min: 0, max: 1, step: 1.5e-7 });
    expect(snap(1.5e-7, fine)).toBeCloseTo(1.5e-7);
    expect(snap(3e-7, fine)).toBeCloseTo(3e-7);
    expect(snap(2.5e-7, fine)).toBeCloseTo(3e-7);
  });

  it('places a non-finite value on the snapped midpoint', () => {
    expect(snap(Number.NaN, scale)).toBe(50);
  });
});

describe('normalizeRange', () => {
  it('returns the same array when both numbers are already on the scale and in order', () => {
    const pair: SliderRangeValue = [20, 80];
    expect(normalizeRange(pair, scale)).toBe(pair);
  });

  it('snaps both ends and stops a crossed pair on the start', () => {
    expect(normalizeRange([20.4, 80.2], scale)).toEqual([20, 80]);
    expect(normalizeRange([80, 20], scale)).toEqual([80, 80]);
    expect(normalizeRange([40, 40], scale)).toEqual([40, 40]);
  });
});

describe('moveThumb', () => {
  const pair: SliderRangeValue = [20, 80];

  it('returns the same array when the snapped move does not change a number', () => {
    expect(moveThumb(pair, 'start', 20, scale)).toBe(pair);
    expect(moveThumb(pair, 'start', 20.2, scale)).toBe(pair);
    expect(moveThumb(pair, 'end', 80.4, scale)).toBe(pair);
  });

  it('stops a thumb on the other thumb and leaves that number unchanged', () => {
    expect(moveThumb(pair, 'start', 90, scale)).toEqual([80, 80]);
    expect(moveThumb(pair, 'end', 10, scale)).toEqual([20, 20]);
    expect(moveThumb([40, 40], 'start', 70, scale)).toEqual([40, 40]);
  });

  it('moves one thumb, copies the other number, and allows the two to meet', () => {
    expect(moveThumb(pair, 'start', 30.2, scale)).toEqual([30, 80]);
    expect(moveThumb(pair, 'end', 70.4, scale)).toEqual([20, 70]);
    expect(moveThumb(pair, 'start', 80, scale)).toEqual([80, 80]);
    expect(moveThumb([40, 40], 'end', 55, scale)).toEqual([40, 55]);
  });
});

describe('nearestThumb', () => {
  it('picks the closer thumb', () => {
    expect(nearestThumb([20, 80], 30)).toBe('start');
    expect(nearestThumb([20, 80], 70)).toBe('end');
  });

  it('on a tie picks the start thumb only on the minimum side of the shared value', () => {
    expect(nearestThumb([20, 80], 50)).toBe('end');
    expect(nearestThumb([40, 40], 39)).toBe('start');
    expect(nearestThumb([40, 40], 40)).toBe('end');
    expect(nearestThumb([40, 40], 41)).toBe('end');
  });
});

describe('valueFromPointer', () => {
  const rect = { left: 10, width: 100 };

  it('maps the inline-start edge to min and the inline-end edge to max', () => {
    expect(valueFromPointer(10, rect, 'ltr', scale)).toBe(0);
    expect(valueFromPointer(110, rect, 'ltr', scale)).toBe(100);
    expect(valueFromPointer(35, rect, 'ltr', scale)).toBe(25);
    expect(valueFromPointer(110, rect, 'rtl', scale)).toBe(0);
    expect(valueFromPointer(10, rect, 'rtl', scale)).toBe(100);
    expect(valueFromPointer(85, rect, 'rtl', scale)).toBe(25);
  });

  it('clamps a pointer outside the track and a zero width to min', () => {
    expect(valueFromPointer(0, rect, 'ltr', scale)).toBe(0);
    expect(valueFromPointer(200, rect, 'ltr', scale)).toBe(100);
    expect(valueFromPointer(40, { left: 0, width: 0 }, 'ltr', scale)).toBe(0);
  });
});

describe('rangePercents', () => {
  it('reports each thumb as a percentage of the whole scale', () => {
    expect(rangePercents([25, 75], scale)).toEqual({ start: 25, end: 75 });
    expect(rangePercents([0, 100], scale)).toEqual({ start: 0, end: 100 });
    expect(rangePercents([10, 10], readScale({ min: 10, max: 10 }))).toEqual({ start: 0, end: 0 });
  });
});
