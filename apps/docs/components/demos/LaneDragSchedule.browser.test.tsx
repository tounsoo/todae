import { cleanup, render, screen } from '@testing-library/react';
import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { Providers } from '../Providers';
import ScheduleExample from '../../examples/utilities/use-lane-drag/ScheduleExample';

// Narrower than the day, so the board scrolls sideways.
beforeEach(async () => {
  await page.viewport(640, 800);
});

afterEach(cleanup);

const STAGES = ['Main hall', 'Room A', 'Room B'];

function setup(dir: 'ltr' | 'rtl') {
  render(
    <Providers>
      <div dir={dir}>
        <ScheduleExample />
      </div>
    </Providers>,
  );
  const stage = (name: string) => screen.getByRole('region', { name });
  const board = stage(STAGES[0]!).parentElement!;
  const hours = board.firstElementChild as HTMLElement;
  return { board, hours, stage };
}

// The board's scroll positions to check: the start, the middle and the end. RTL scrolls to negative values.
function offsets(board: HTMLElement, dir: 'ltr' | 'rtl') {
  const max = board.scrollWidth - board.clientWidth;
  const sign = dir === 'rtl' ? -1 : 1;
  return [0, Math.round(max / 2), max].map((offset) => sign * offset);
}

// The x of a box's inline-start edge.
const start = (rect: DOMRect, dir: 'ltr' | 'rtl') => (dir === 'rtl' ? rect.right : rect.left);

describe.each(['ltr', 'rtl'] as const)('schedule board, %s', (dir) => {
  it('keeps every stage name and the hours corner at the board’s start at any scroll', () => {
    const { board, hours, stage } = setup(dir);
    expect(board.scrollWidth).toBeGreaterThan(board.clientWidth * 2);
    for (const offset of offsets(board, dir)) {
      board.scrollLeft = offset;
      const edge = start(board.getBoundingClientRect(), dir);
      for (const name of STAGES) {
        const label = stage(name).firstElementChild!;
        expect(start(label.getBoundingClientRect(), dir), `${name} at ${offset}`).toBeCloseTo(edge, 0);
        expect(label.textContent).toBe(name);
      }
      // The corner is the hours row's own ::before, so a hit just inside the board's start lands on the row, not on an hour.
      const row = hours.getBoundingClientRect();
      const x = dir === 'rtl' ? edge - 8 : edge + 8;
      expect(document.elementFromPoint(x, row.top + row.height / 2), `corner at ${offset}`).toBe(hours);
    }
  });

  it('starts each hour at its line on the lanes', () => {
    const { hours, stage } = setup(dir);
    const ticks = Array.from(hours.lastElementChild!.children);
    expect(ticks.map((tick) => tick.textContent)).toEqual(['9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00']);
    for (const name of STAGES) {
      const lane = stage(name).lastElementChild!.getBoundingClientRect();
      const laneStart = start(lane, dir);
      const step = (dir === 'rtl' ? -1 : 1) * (lane.width / 8);
      ticks.forEach((tick, hour) => {
        expect(start(tick.getBoundingClientRect(), dir), `${name}, hour ${hour}`).toBeCloseTo(laneStart + hour * step, 0);
      });
    }
  });
});
