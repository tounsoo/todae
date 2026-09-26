import { describe, expect, it } from 'vitest';
import { planChipOverflow, rowsFor } from './chipOverflow';

describe('planChipOverflow', () => {
  it('shows every chip when maxRows is unset', () => {
    expect(planChipOverflow({ W: 100, g: 8, c: [40, 40, 40], p: 30, m: 80 })).toEqual({
      visible: 3,
      hidden: 0,
    });
  });

  it('keeps all chips when they fit on one row', () => {
    expect(planChipOverflow({ W: 400, g: 8, c: [100, 100], p: 50, m: 80, R: 1 })).toEqual({
      visible: 2,
      hidden: 0,
    });
  });

  it('folds newest chips so +N and the input stay on row 1', () => {
    const plan = planChipOverflow({
      W: 400,
      g: 8,
      c: [100, 100, 100, 100],
      p: 50,
      m: 80,
      R: 1,
    });
    expect(plan.hidden).toBeGreaterThan(0);
    const items = [...Array(plan.visible).fill(100), ...(plan.hidden > 0 ? [50] : []), 80];
    expect(rowsFor(items, 400, 8)).toBeLessThanOrEqual(1);
  });

  it('does not let the input spawn row 3 when maxRows is 2', () => {
    const c = Array(8).fill(100);
    const plan = planChipOverflow({ W: 400, g: 8, c, p: 50, m: 80, R: 2 });
    const items = [...c.slice(0, plan.visible), ...(plan.hidden > 0 ? [50] : []), 80];
    expect(rowsFor(items, 400, 8)).toBeLessThanOrEqual(2);
  });

  it('hides every chip when the container is too narrow', () => {
    expect(planChipOverflow({ W: 90, g: 8, c: [100, 100], p: 50, m: 80, R: 1 })).toEqual({
      visible: 0,
      hidden: 2,
    });
  });

  it('counts gap so items that fit only without gap overflow', () => {
    expect(planChipOverflow({ W: 180, g: 8, c: [100], p: 50, m: 80, R: 1 })).toEqual({
      visible: 0,
      hidden: 1,
    });
  });

  it('treats sums within 0.5px as fitting', () => {
    expect(planChipOverflow({ W: 188, g: 8, c: [100], p: 50, m: 80, R: 1 })).toEqual({
      visible: 1,
      hidden: 0,
    });
  });

  it('never exceeds maxRows when +N and input fit', () => {
    for (let n = 0; n < 12; n++) {
      const c = Array(n).fill(40 + (n % 3) * 10);
      const plan = planChipOverflow({ W: 320, g: 8, c, p: 48, m: 72, R: 2 });
      const items = [...c.slice(0, plan.visible), ...(plan.hidden > 0 ? [48] : []), 72];
      if (48 + 8 + 72 <= 320) expect(rowsFor(items, 320, 8)).toBeLessThanOrEqual(2);
    }
  });

  it('soaks the last visible chip when leftover is between minChip and cLast', () => {
    const plan = planChipOverflow({
      W: 300,
      g: 8,
      c: [80, 150, 80],
      p: 40,
      m: 40,
      R: 1,
      minChip: 60,
    });
    expect(plan).toEqual({ visible: 2, hidden: 1, lastChipWidth: 116 });
    expect(rowsFor([80, 116, 40, 40], 300, 8)).toBe(1);
  });

  it('does not soak when hidden is 0', () => {
    expect(planChipOverflow({ W: 400, g: 8, c: [100, 100], p: 50, m: 80, R: 1, minChip: 60 })).toEqual({
      visible: 2,
      hidden: 0,
    });
  });

  it('does not soak when natural fit already works', () => {
    expect(planChipOverflow({ W: 400, g: 8, c: [100, 100, 100, 100], p: 50, m: 80, R: 1, minChip: 60 })).toEqual({
      visible: 2,
      hidden: 2,
    });
  });

  it('hides more when minChip is unset', () => {
    expect(planChipOverflow({ W: 300, g: 8, c: [80, 150, 80], p: 40, m: 40, R: 1 })).toEqual({
      visible: 1,
      hidden: 2,
    });
  });

  it('plans a chip row without an input width', () => {
    expect(planChipOverflow({ W: 400, g: 8, c: [100, 100, 100, 100], p: 50, R: 1 })).toEqual({
      visible: 3,
      hidden: 1,
    });
    const two = planChipOverflow({ W: 400, g: 8, c: [100, 100, 100], p: 40, R: 2 });
    const items = [...Array(two.visible).fill(100), ...(two.hidden > 0 ? [40] : [])];
    expect(rowsFor(items, 400, 8)).toBeLessThanOrEqual(2);
    expect(two.lastChipWidth).not.toBeNaN();
  });

  it('hides more when leftover is below minChip', () => {
    expect(planChipOverflow({ W: 200, g: 8, c: [150, 80], p: 50, m: 80, R: 1, minChip: 100 })).toEqual({
      visible: 0,
      hidden: 2,
    });
  });
});
