import { cleanup, render, screen, within } from '@testing-library/react';
import { page } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { Providers } from '../Providers';
import ScheduleExample from '../../examples/utilities/use-lane-drag/ScheduleExample';

afterEach(cleanup);

type Dir = 'ltr' | 'rtl';
const STAGES = ['Main hall', 'Room A', 'Room B'];
const NAME_COLUMN = 112; // --schedule-name, 7rem at 16px

function setup(dir: Dir) {
  const { container } = render(
    <Providers>
      <div dir={dir}>
        <ScheduleExample />
      </div>
    </Providers>,
  );
  const board = container.querySelector<HTMLElement>('[data-todae-lanes-board]')!;
  const hours = board.querySelector<HTMLElement>(':scope > [aria-hidden="true"]')!;
  const stage = (name: string) => screen.getByRole('region', { name });
  // The stage's name cell, the sticky first column.
  const label = (name: string) => within(stage(name)).getByText(name).closest<HTMLElement>('section > *')!;
  const lane = (name: string) => stage(name).querySelector<HTMLElement>('[data-todae-lane]')!;
  return { board, hours, label, lane };
}

// The board's scroll positions to check: the start, the middle and the end. RTL scrolls to negative values.
function offsets(board: HTMLElement, dir: Dir) {
  const max = board.scrollWidth - board.clientWidth;
  const sign = dir === 'rtl' ? -1 : 1;
  return [...new Set([0, Math.round(max / 2), max])].map((offset) => sign * offset);
}

// The x of a box's inline-start edge, and a point `by` pixels further along the inline axis.
const start = (rect: DOMRect, dir: Dir) => (dir === 'rtl' ? rect.right : rect.left);
const along = (x: number, by: number, dir: Dir) => (dir === 'rtl' ? x - by : x + by);

describe.each(['ltr', 'rtl'] as const)('schedule board, %s', (dir) => {
  // 640 scrolls the board sideways; 2400 is wider than the day, so the lanes stretch and nothing scrolls.
  it.each([640, 2400])('keeps names, the hours corner and the hours in place at %ipx', async (width) => {
    await page.viewport(width, 800);
    const { board, hours, label, lane } = setup(dir);
    if (width === 640) expect(board.scrollWidth).toBeGreaterThan(board.clientWidth * 2);
    const ticks = Array.from(hours.querySelector(':scope > div')!.children);
    expect(ticks.map((tick) => tick.textContent)).toEqual(['9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00']);

    for (const offset of offsets(board, dir)) {
      board.scrollLeft = offset;
      const edge = start(board.getBoundingClientRect(), dir);
      for (const name of STAGES) {
        expect(start(label(name).getBoundingClientRect(), dir), `${name} at ${offset}`).toBeCloseTo(edge, 0);
        // Each hour starts at its line on every lane.
        const rect = lane(name).getBoundingClientRect();
        ticks.forEach((tick, hour) => {
          const line = along(start(rect, dir), (hour * rect.width) / 8, dir);
          expect(start(tick.getBoundingClientRect(), dir), `${name}, hour ${hour} at ${offset}`).toBeCloseTo(line, 0);
        });
      }
      // The corner is the hours row's own ::before, so a hit just inside the board's start lands on the row, not on an hour.
      const row = hours.getBoundingClientRect();
      expect(document.elementFromPoint(along(edge, 8, dir), row.top + row.height / 2), `corner at ${offset}`).toBe(hours);
    }
  });

  it('paints the names and the corner over what scrolls under them', async () => {
    await page.viewport(640, 800);
    const { board, hours, label } = setup(dir);
    const corner = getComputedStyle(hours, '::before');
    const cell = getComputedStyle(label('Main hall'));
    expect(corner.position).toBe('sticky');
    expect(cell.position).toBe('sticky');
    expect(corner.backgroundColor).toBe(cell.backgroundColor);
    expect(cell.backgroundColor).not.toMatch(/^rgba\(.*, 0\)$|transparent/);
    // Scrolled by the name column, the opening keynote at 9:00 sits under the Main hall name, which stays on top.
    board.scrollLeft = dir === 'rtl' ? -NAME_COLUMN : NAME_COLUMN;
    const name = label('Main hall').getBoundingClientRect();
    const hit = document.elementFromPoint(name.left + name.width / 2, name.top + name.height / 2);
    expect(label('Main hall').contains(hit)).toBe(true);
  });

  it('scrolls a focused talk clear of the names', async () => {
    await page.viewport(640, 800);
    const { board, label } = setup(dir);
    const menu = screen.getByRole('button', { name: 'Move Tokens that travel' });
    // Put the menu button just inside the board's start, where the names cover it.
    board.scrollLeft = 0;
    const edge = start(board.getBoundingClientRect(), dir);
    const from = start(menu.getBoundingClientRect(), dir);
    board.scrollLeft = (dir === 'rtl' ? -1 : 1) * Math.round(Math.abs(from - edge) - 20);
    menu.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const names = start(label('Room A').getBoundingClientRect(), dir);
    expect(Math.abs(start(menu.getBoundingClientRect(), dir) - names)).toBeGreaterThanOrEqual(NAME_COLUMN - 0.5);
  });
});
