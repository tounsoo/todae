import { act, cleanup, render, screen, within } from '@testing-library/react';
import { page, userEvent } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { Providers } from '../Providers';
import ConferenceSchedule from '../../examples/recipes/conference-schedule/ConferenceSchedule';

// The board's axis runs over the three days' open minutes, 9:00 to 18:00 each, so 0 to 1620.
const UNITS = 1620;

afterEach(cleanup);

function setup() {
  render(
    <Providers>
      <ConferenceSchedule locale="en-US" />
    </Providers>,
  );
}

const board = () => document.querySelector<HTMLElement>('[data-todae-lanes-board]')!;
const stage = (name: string) => screen.getByRole('region', { name });
const lane = (name: string) => stage(name).querySelector<HTMLElement>('[data-todae-lane]')!;
const trigger = (title: string) => screen.getByRole('button', { name: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},`) });
const talk = (title: string) => trigger(title).closest('li')!;
const grip = (title: string) => talk(title).querySelector<HTMLElement>('.lucide-grip-vertical')!.parentElement!;
const politeRegion = () => document.querySelector('[data-todae-announcer] > [aria-live="polite"]');
const centre = (el: Element) => {
  const box = el.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};

const pointer = (type: string, target: EventTarget, x: number, y: number) =>
  act(() => {
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y }));
  });

/** The point `units` along a stage's lane, in its middle across. */
function along(name: string, units: number) {
  const box = lane(name).getBoundingClientRect();
  return { x: box.left + (units / UNITS) * box.width, y: box.top + box.height / 2 };
}

/** Presses a talk's grip and moves the pointer to `to`, keeping where on the grip it was pressed. */
function dragTo(title: string, to: { x: number; y: number }, { placed = false } = {}) {
  const handle = grip(title);
  const start = centre(handle);
  // For a placed talk, the pointer keeps its distance from the talk's start, so aim the start at `to`.
  const lead = placed ? start.x - talk(title).getBoundingClientRect().left : 0;
  pointer('pointerdown', handle, start.x, start.y);
  pointer('pointermove', handle, start.x + 6, start.y);
  pointer('pointermove', handle, to.x + lead, to.y);
  return { drop: () => pointer('pointerup', handle, to.x + lead, to.y) };
}

describe('dragging', () => {
  // Wide enough for the queue to sit beside the board.
  beforeEach(async () => {
    await page.viewport(1280, 800);
  });

  it('places a talk from the queue at the time under the pointer and announces it', async () => {
    setup();
    // 11:15 on day 1 is 135 minutes into the axis, clear of Tokens that travel's changeover.
    dragTo('Dark mode, done right', along('Main stage', 135)).drop();
    expect(trigger('Dark mode, done right').getAttribute('aria-label')).toBe('Dark mode, done right, Mira Patel, Design, Main stage, Wed, Jun 2, 11:15 AM to 11:45 AM');
    expect(within(stage('Main stage')).getByRole('list').contains(talk('Dark mode, done right'))).toBe(true);
    await expect.poll(() => politeRegion()?.textContent).toBe('Dark mode, done right moved to Main stage, Wed, Jun 2, 11:15 AM to 11:45 AM');
  });

  it('moves a placed talk to another stage at the same time, with its warning', async () => {
    setup();
    // Motion with purpose runs 14:00 to 14:40 on day 1, 300 minutes in.
    dragTo('Motion with purpose', along('Hall B', 300), { placed: true }).drop();
    expect(within(stage('Hall B')).getByRole('list').contains(talk('Motion with purpose'))).toBe(true);
    await expect.poll(() => politeRegion()?.textContent).toBe('Motion with purpose moved to Hall B, Wed, Jun 2, 2:00 PM to 2:40 PM. Expects 400, Hall B seats 300');
    expect(talk('Motion with purpose').getAttribute('data-conflict')).toBe('warning');
  });

  it('marks the talk a speaker gives on another stage and refuses the drop', async () => {
    setup();
    // Ana Ruiz gives Hands-on theming in the workshop room from 10:30 to 12:00 on day 1.
    const drag = dragTo('Motion with purpose', along('Main stage', 120), { placed: true });
    await expect.poll(() => talk('Hands-on theming').getAttribute('data-conflict')).toBe('blocked');
    expect(lane('Main stage').textContent).toContain('Ana Ruiz is in Hands-on theming then');
    drag.drop();
    expect(trigger('Motion with purpose').getAttribute('aria-label')).toContain('Main stage, Wed, Jun 2, 2:00 PM to 2:40 PM');
    // The workshop goes back to showing no warning of its own.
    expect(talk('Hands-on theming').hasAttribute('data-conflict')).toBe(false);
  });
});

describe('the sticky stage names', () => {
  // A row only as wide as the board carries its sticky name away once the board scrolls past the
  // row's end. Each row is as wide as the axis, so every name stays at the board's start.
  for (const [width, height] of [
    [1280, 800],
    [1024, 768],
    [390, 844],
  ] as const) {
    it(`stay in view at every scroll amount at ${width}px`, async () => {
      await page.viewport(width, height);
      setup();
      const scroller = board();
      const max = scroller.scrollWidth - scroller.clientWidth;
      expect(max).toBeGreaterThan(0);
      for (const amount of [0, 120, max / 4, max / 2, max - 40, max]) {
        scroller.scrollLeft = amount;
        const start = scroller.getBoundingClientRect().left + scroller.clientLeft;
        for (const name of ['Main stage', 'Hall B', 'Workshop room']) {
          const heading = within(stage(name)).getByRole('heading', { name });
          const box = heading.parentElement!.getBoundingClientRect();
          expect(Math.abs(box.left - start), `${name} at ${amount}px`).toBeLessThan(1);
          // Nothing paints over the name: the point at its middle hits the name itself.
          const at = centre(heading);
          expect(heading.parentElement!.contains(document.elementFromPoint(at.x, at.y)), `${name} covered at ${amount}px`).toBe(true);
        }
        // The corner covers the hours that scroll under the names column.
        const corner = scroller.firstElementChild!.firstElementChild!;
        const at = centre(corner);
        expect(document.elementFromPoint(at.x, at.y)).toBe(corner);
      }
    });
  }

  it('scrolls a day to just past the names column from its button', async () => {
    await page.viewport(1280, 800);
    setup();
    // The header row's axis holds a cell for each day.
    const day = board().firstElementChild!.children[1]!.children[1] as HTMLElement;
    expect(day.textContent).toContain('Thu, Jun 3');
    await userEvent.click(screen.getByRole('button', { name: 'Thu, Jun 3' }));
    const names = stage('Main stage').firstElementChild!.getBoundingClientRect();
    await expect.poll(() => Math.round(day.getBoundingClientRect().left - names.right)).toBe(0);
  });
});

describe('the dialog', () => {
  beforeEach(async () => {
    await page.viewport(1280, 800);
  });

  it('moves a talk to the stage it picks and hands focus back to the talk in its new place', async () => {
    setup();
    trigger('Motion with purpose').focus();
    await userEvent.keyboard('{Enter}');
    const menu = await screen.findByRole('menu');
    await expect.poll(() => document.activeElement).toBe(within(menu).getAllByRole('menuitem')[0]);
    await userEvent.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog', { name: 'Move Motion with purpose' });
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: 'Stage' }), 'Hall B');
    expect(within(dialog).getByText('Expects 400, Hall B seats 300.')).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Move' }));
    expect(within(stage('Hall B')).getByRole('list').contains(talk('Motion with purpose'))).toBe(true);
    await expect.poll(() => document.activeElement).toBe(trigger('Motion with purpose'));
  });

  it('puts a blocked place on the start field and keeps the dialog open', async () => {
    setup();
    trigger('Motion with purpose').focus();
    await userEvent.keyboard('{Enter}');
    const menu = await screen.findByRole('menu');
    await expect.poll(() => document.activeElement).toBe(within(menu).getAllByRole('menuitem')[0]);
    await userEvent.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog', { name: 'Move Motion with purpose' });
    // The workshop room isn't recorded, and Motion with purpose is.
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: 'Stage' }), 'Workshop room');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Move' }));
    expect(screen.getByRole('dialog', { name: 'Move Motion with purpose' })).toBe(dialog);
    expect(await within(dialog).findByText("Workshop room isn't recorded.")).toBeVisible();
    expect(within(stage('Main stage')).getByRole('list').contains(talk('Motion with purpose'))).toBe(true);
  });
});
