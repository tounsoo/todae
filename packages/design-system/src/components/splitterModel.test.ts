import { describe, expect, it } from 'vitest';
import {
  clampSize,
  dragSize,
  floorSize,
  growSign,
  keyAction,
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

  it('lets the room win when the container is narrower than min', () => {
    const narrow: Bounds = { min: 100, max: 60, collapsible: false };
    expect(clampSize(300, narrow)).toBe(60);
    expect(clampSize(20, narrow)).toBe(60);
    expect(floorSize(narrow)).toBe(60);
    expect(clampSize(40, { ...narrow, collapsible: true })).toBe(60);
    expect(clampSize(0, { ...narrow, collapsible: true })).toBe(0);
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

describe('floorSize', () => {
  it('is 0 when collapsible, else min, and never above max', () => {
    expect(floorSize(open)).toBe(100);
    expect(floorSize(collapsible)).toBe(0);
    expect(floorSize({ min: 100, max: 60, collapsible: false })).toBe(60);
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
    expect(toggledSize(250, 250, 100, 16)).toBe(0);
  });

  it('restores the size the product held, as it is', () => {
    expect(toggledSize(0, 260, 100, 16)).toBe(260);
    expect(toggledSize(0, 900, 100, 16)).toBe(900);
    expect(toggledSize(0, 60, 100, 16)).toBe(60);
  });

  it('opens to min, or at least one step, when there is no size to go back to', () => {
    expect(toggledSize(0, 0, 100, 16)).toBe(100);
    expect(toggledSize(0, 0, 0, 16)).toBe(16);
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

describe('growSign', () => {
  it('grows a first panel toward larger coordinates and a last one toward smaller', () => {
    expect(growSign('horizontal', 'start', false)).toBe(1);
    expect(growSign('horizontal', 'end', false)).toBe(-1);
    expect(growSign('vertical', 'start', false)).toBe(1);
    expect(growSign('vertical', 'end', false)).toBe(-1);
  });

  it('flips a horizontal layout in right-to-left text, and a vertical one not', () => {
    expect(growSign('horizontal', 'start', true)).toBe(-1);
    expect(growSign('horizontal', 'end', true)).toBe(1);
    expect(growSign('vertical', 'start', true)).toBe(1);
  });

  it('is the direction of the arrow that grows the panel', () => {
    for (const orientation of ['horizontal', 'vertical'] as const) {
      for (const primary of ['start', 'end'] as const) {
        for (const rtl of [false, true]) {
          const [toward, away] = orientation === 'horizontal' ? ['ArrowRight', 'ArrowLeft'] : ['ArrowDown', 'ArrowUp'];
          const sign = growSign(orientation, primary, rtl);
          expect(keyAction(sign === 1 ? toward! : away!, orientation, primary, rtl)).toBe('grow');
          expect(keyAction(sign === 1 ? away! : toward!, orientation, primary, rtl)).toBe('shrink');
        }
      }
    }
  });
});

describe('dragSize', () => {
  it('adds the distance the pointer moved, in the direction that grows the panel', () => {
    expect(dragSize(343, 100, 240, 1)).toBe(483);
    expect(dragSize(60, 100, 240, 1)).toBe(200);
    expect(dragSize(60, 100, 240, -1)).toBe(280);
  });

  it('does not depend on where the layout sits, only on how far the pointer went', () => {
    expect(dragSize(150, 100, 240, 1)).toBe(dragSize(1150, 1100, 240, 1));
  });
});
