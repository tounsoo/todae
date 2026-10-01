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

  it('truncates a lone chip that fits the row but not beside the input', () => {
    expect(planChipOverflow({ W: 180, g: 8, c: [100], p: 50, m: 80, R: 1 })).toEqual({
      visible: 1,
      hidden: 0,
      lastChipWidth: 92,
    });
    expect(rowsFor([92, 80], 180, 8)).toBe(1);
  });

  it('keeps a row that fills the width exactly', () => {
    expect(planChipOverflow({ W: 188, g: 8, c: [100], p: 50, m: 80, R: 1 })).toEqual({
      visible: 1,
      hidden: 0,
    });
  });

  it('treats a fraction of a pixel of overflow as not fitting', () => {
    // Four chips plus +N sum to 472, so 471.7 overflows by 0.3px (inside the old 0.5px window).
    expect(planChipOverflow({ W: 471.7, g: 8, c: [100, 100, 100, 100, 100], p: 40, R: 1 })).toEqual({
      visible: 3,
      hidden: 2,
    });
    expect(rowsFor([100, 100, 100, 100, 40], 471.7, 8)).toBe(2);
    expect(rowsFor([100, 100, 100, 100, 40], 472, 8)).toBe(1);
  });

  it('folds when the +N line is 0.296875px over the container', () => {
    const c = [70.609375, 63.4375, 84.515625, 67.046875, 81.578125, 61.40625, 54.828125, 68.53125];
    const p = 34.03125;
    const over = planChipOverflow({ W: 267.765625, g: 8, c, p, R: 2 });
    expect(over).toEqual({ visible: 5, hidden: 3 });
    expect(rowsFor([...c.slice(0, 6), p], 267.765625, 8)).toBe(3);
    const spare = planChipOverflow({ W: 268.4375, g: 8, c, p, R: 2 });
    expect(spare).toEqual({ visible: 6, hidden: 2 });
    expect(rowsFor([...c.slice(0, 6), p], 268.4375, 8)).toBe(2);
  });

  it('never exceeds maxRows when +N and input fit', () => {
    for (let n = 0; n < 12; n++) {
      const c = Array(n).fill(40 + (n % 3) * 10);
      const plan = planChipOverflow({ W: 320, g: 8, c, p: 48, m: 72, R: 2 });
      const items = [...c.slice(0, plan.visible), ...(plan.hidden > 0 ? [48] : []), 72];
      if (48 + 8 + 72 <= 320) expect(rowsFor(items, 320, 8)).toBeLessThanOrEqual(2);
    }
  });

  it('moves a chip that does not fit at full width into the overflow', () => {
    expect(
      planChipOverflow({
        W: 300,
        g: 8,
        c: [80, 150, 80],
        p: 40,
        m: 40,
        R: 1,
        minChip: 60,
      }),
    ).toEqual({ visible: 1, hidden: 2 });
  });

  it('keeps the input reserve on the +N row and rejects a fraction of a pixel', () => {
    const folded = planChipOverflow({ W: 204, g: 8, c: [100, 100], p: 40, m: 48, R: 1 });
    expect(folded).toEqual({ visible: 1, hidden: 1 });
    expect(rowsFor([100, 40, 48], 204, 8)).toBe(1);
    const tight = planChipOverflow({ W: 203.9, g: 8, c: [100, 100], p: 40, m: 48, R: 1 });
    expect(tight.visible).toBe(1);
    expect(tight.hidden).toBe(1);
    expect(tight.lastChipWidth).toBeCloseTo(99.9, 5);
    expect(rowsFor([100, 40, 48], 203.9, 8)).toBe(2);
    expect(rowsFor([tight.lastChipWidth ?? 0, 40, 48], 203.9, 8)).toBe(1);
  });

  it('truncates only a chip wider than the row', () => {
    expect(planChipOverflow({ W: 200, g: 8, c: [400, 80], p: 40, R: 1 })).toEqual({
      visible: 1,
      hidden: 1,
      lastChipWidth: 152,
    });
    expect(planChipOverflow({ W: 200, g: 8, c: [400], p: 40, R: 1 })).toEqual({
      visible: 1,
      hidden: 0,
      lastChipWidth: 200,
    });
  });

  it('truncates the first chip when it fits alone but not beside +N', () => {
    expect(planChipOverflow({ W: 240, g: 8, c: [230, 80, 80], p: 40, R: 1 })).toEqual({
      visible: 1,
      hidden: 2,
      lastChipWidth: 192,
    });
    expect(planChipOverflow({ W: 260, g: 8, c: [230, 80], p: 40, R: 1 })).toEqual({
      visible: 1,
      hidden: 1,
      lastChipWidth: 212,
    });
    expect(planChipOverflow({ W: 280, g: 8, c: [230, 80], p: 40, R: 1 })).toEqual({
      visible: 1,
      hidden: 1,
    });
  });

  it('truncates an over-wide chip and keeps the input on the +N row', () => {
    expect(planChipOverflow({ W: 270, g: 4, c: [434.69, 20], p: 26, m: 48, R: 1 })).toEqual({
      visible: 1,
      hidden: 1,
      lastChipWidth: 188,
    });
    expect(planChipOverflow({ W: 382, g: 4, c: [434.69, 20], p: 26, m: 48, R: 1 })).toEqual({
      visible: 1,
      hidden: 1,
      lastChipWidth: 300,
    });
  });

  it('does not truncate chips that already fit', () => {
    expect(planChipOverflow({ W: 400, g: 8, c: [100, 100], p: 50, m: 80, R: 1, minChip: 60 })).toEqual({
      visible: 2,
      hidden: 0,
    });
  });

  it('does not truncate when a full-width prefix already fits', () => {
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

  it('truncates instead of hiding when the leftover is below the unused probe width', () => {
    expect(planChipOverflow({ W: 200, g: 8, c: [150, 80], p: 50, m: 80, R: 1, minChip: 100 })).toEqual({
      visible: 1,
      hidden: 1,
      lastChipWidth: 54,
    });
  });
});
