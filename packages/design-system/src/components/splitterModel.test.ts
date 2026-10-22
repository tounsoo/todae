import { describe, expect, it } from 'vitest';
import {
  ceilingSize,
  clampSize,
  floorSize,
  keyAction,
  pointerSize,
  snapSize,
  stepSize,
  toggledSize,
  type Bounds,
} from './splitterModel.js';

const open: Bounds = { min: 100, max: 400, collapsible: false };
const collapsible: Bounds = { min: 100, max: 400, collapsible: true };

describe('clampSize', () => {
  it.each([
    [250, 250],
    [20, 100],
    [900, 400],
    [0, 100],
    [Number.NaN, 100],
  ])('keeps %s inside an open range as %s', (size, expected) => {
    expect(clampSize(size, open)).toBe(expected);
  });

  it('keeps 0 for a collapsible panel and still raises a small size to min', () => {
    expect(clampSize(0, collapsible)).toBe(0);
    expect(clampSize(-5, collapsible)).toBe(0);
    expect(clampSize(40, collapsible)).toBe(100);
  });

  it('never goes below min when the container is narrower than min', () => {
    expect(clampSize(300, { min: 100, max: 60, collapsible: false })).toBe(100);
    expect(ceilingSize({ min: 100, max: 60, collapsible: false })).toBe(100);
  });
});

describe('snapSize', () => {
  it('snaps a collapsible panel to 0 below half of min and holds at min above it', () => {
    expect(snapSize(49, collapsible)).toBe(0);
    expect(snapSize(50, collapsible)).toBe(100);
    expect(snapSize(99, collapsible)).toBe(100);
    expect(snapSize(250, collapsible)).toBe(250);
    expect(snapSize(-30, collapsible)).toBe(0);
  });

  it('only clamps a panel that is not collapsible', () => {
    expect(snapSize(10, open)).toBe(100);
    expect(snapSize(1000, open)).toBe(400);
  });
});

describe('floorSize and ceilingSize', () => {
  it('give the ends of the range, 0 at the low end when collapsible', () => {
    expect(floorSize(open)).toBe(100);
    expect(floorSize(collapsible)).toBe(0);
    expect(ceilingSize(open)).toBe(400);
  });
});

describe('stepSize', () => {
  it('moves by step inside the range and stops at its ends', () => {
    expect(stepSize('grow', 200, open, 16)).toBe(216);
    expect(stepSize('shrink', 200, open, 16)).toBe(184);
    expect(stepSize('grow', 395, open, 16)).toBe(400);
    expect(stepSize('shrink', 105, open, 16)).toBe(100);
  });

  it('collapses from min and leaves 0 for min when collapsible', () => {
    expect(stepSize('shrink', 100, collapsible, 16)).toBe(0);
    expect(stepSize('shrink', 110, collapsible, 16)).toBe(0);
    expect(stepSize('grow', 0, collapsible, 16)).toBe(100);
    expect(stepSize('shrink', 0, collapsible, 16)).toBe(0);
  });
});

describe('toggledSize', () => {
  it('collapses an open panel to 0', () => {
    expect(toggledSize(250, 250, collapsible, 16)).toBe(0);
  });

  it('restores the size before, kept inside the range', () => {
    expect(toggledSize(0, 260, collapsible, 16)).toBe(260);
    expect(toggledSize(0, 900, collapsible, 16)).toBe(400);
  });

  it('opens to min, or at least one step, when there is no size to go back to', () => {
    expect(toggledSize(0, 0, collapsible, 16)).toBe(100);
    expect(toggledSize(0, 0, { min: 0, max: 400, collapsible: true }, 16)).toBe(16);
  });
});

describe('keyAction', () => {
  it('moves a horizontal splitter by physical arrow, shrinking toward a start panel', () => {
    expect(keyAction('ArrowRight', 'horizontal', 'start', false)).toBe('grow');
    expect(keyAction('ArrowLeft', 'horizontal', 'start', false)).toBe('shrink');
  });

  it('flips for a panel at the end', () => {
    expect(keyAction('ArrowRight', 'horizontal', 'end', false)).toBe('shrink');
    expect(keyAction('ArrowLeft', 'horizontal', 'end', false)).toBe('grow');
  });

  it('flips again in right-to-left text, where the start panel is on the right', () => {
    expect(keyAction('ArrowLeft', 'horizontal', 'start', true)).toBe('grow');
    expect(keyAction('ArrowRight', 'horizontal', 'start', true)).toBe('shrink');
    expect(keyAction('ArrowRight', 'horizontal', 'end', true)).toBe('grow');
    expect(keyAction('ArrowLeft', 'horizontal', 'end', true)).toBe('shrink');
  });

  it('uses Up and Down for a vertical splitter, whatever the text direction', () => {
    for (const rtl of [false, true]) {
      expect(keyAction('ArrowDown', 'vertical', 'start', rtl)).toBe('grow');
      expect(keyAction('ArrowUp', 'vertical', 'start', rtl)).toBe('shrink');
      expect(keyAction('ArrowDown', 'vertical', 'end', rtl)).toBe('shrink');
      expect(keyAction('ArrowUp', 'vertical', 'end', rtl)).toBe('grow');
    }
  });

  it('ignores the arrows of the other axis', () => {
    expect(keyAction('ArrowUp', 'horizontal', 'start', false)).toBeNull();
    expect(keyAction('ArrowDown', 'horizontal', 'start', false)).toBeNull();
    expect(keyAction('ArrowLeft', 'vertical', 'start', false)).toBeNull();
    expect(keyAction('ArrowRight', 'vertical', 'start', false)).toBeNull();
  });

  it('reads Home, End and Enter the same on every layout', () => {
    for (const orientation of ['horizontal', 'vertical'] as const) {
      for (const primary of ['start', 'end'] as const) {
        expect(keyAction('Home', orientation, primary, false)).toBe('min');
        expect(keyAction('End', orientation, primary, true)).toBe('max');
        expect(keyAction('Enter', orientation, primary, false)).toBe('toggle');
        expect(keyAction('a', orientation, primary, false)).toBeNull();
      }
    }
  });
});

describe('pointerSize', () => {
  it('measures from the panel edge and keeps the press offset', () => {
    // A start panel from x=100: the handle is pressed 3px into its line, 240px along.
    expect(pointerSize(343, 100, 1, 3)).toBe(240);
    expect(pointerSize(443, 100, 1, 3)).toBe(340);
    // An end panel from x=1000, growing toward smaller x.
    expect(pointerSize(757, 1000, -1, 3)).toBe(240);
  });
});
