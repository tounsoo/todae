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
// The header row and the stage rows.
const rows = () => stage('Main stage').parentElement!;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const trigger = (title: string) => screen.getByRole('button', { name: new RegExp(`^${escape(title)},`) });
const talk = (title: string) => trigger(title).closest('li')!;
const onStage = (title: string, name: string) => within(stage(name)).getByRole('list').contains(talk(title));
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

/** Scrolls the board so the point `units` along the axis sits 200px from where the names column ends. */
function reveal(units: number) {
  board().scrollLeft = (units / UNITS) * lane('Main stage').getBoundingClientRect().width - 200;
}

/** The point `units` along a stage's lane, in its middle across. */
function along(name: string, units: number) {
  const box = lane(name).getBoundingClientRect();
  return { x: box.left + (units / UNITS) * box.width, y: box.top + box.height / 2 };
}

/** Presses a talk's grip and moves the pointer so the talk would start at `to`. */
function dragTo(title: string, to: { x: number; y: number }) {
  const handle = grip(title);
  const start = centre(handle);
  // A placed talk keeps the pointer's distance from its start; one from the queue starts at the pointer.
  const placed = talk(title).hasAttribute('data-todae-lane-start');
  const lead = placed ? start.x - talk(title).getBoundingClientRect().left : 0;
  pointer('pointerdown', handle, start.x, start.y);
  pointer('pointermove', handle, start.x + 6, start.y);
  pointer('pointermove', handle, to.x + lead, to.y);
  return { drop: () => pointer('pointerup', handle, to.x + lead, to.y) };
}

/** Opens a talk's menu from the keyboard and walks to an item with the arrow keys. */
async function open(title: string, item: string) {
  trigger(title).focus();
  await userEvent.keyboard('{Enter}');
  const menu = await screen.findByRole('menu');
  const items = within(menu).getAllByRole('menuitem');
  const target = items.findIndex((element) => element.textContent === item);
  expect(target, `no ${item}`).toBeGreaterThanOrEqual(0);
  await expect.poll(() => document.activeElement).toBe(items[0]);
  if (target > 0) await userEvent.keyboard('{ArrowDown}'.repeat(target));
  expect(document.activeElement).toBe(items[target]);
}

// Wide enough for the queue to sit beside the board.
beforeEach(async () => {
  await page.viewport(1280, 800);
});

describe('dragging', () => {
  it('places a talk from the queue at the time under the pointer and announces it', async () => {
    setup();
    reveal(100);
    // 11:15 on day 1 is 135 minutes into the axis, clear of Tokens that travel's changeover.
    dragTo('Dark mode, done right', along('Main stage', 135)).drop();
    expect(trigger('Dark mode, done right').getAttribute('aria-label')).toBe('Dark mode, done right, Mira Patel, Design, Main stage, Wed, Jun 2, 11:15 AM to 11:45 AM');
    expect(onStage('Dark mode, done right', 'Main stage')).toBe(true);
    await expect.poll(() => politeRegion()?.textContent).toBe('Dark mode, done right moved to Main stage, Wed, Jun 2, 11:15 AM to 11:45 AM');
  });

  it('moves a placed talk to another stage at the same time, with its warning', async () => {
    setup();
    // Motion with purpose runs 14:00 to 14:40 on day 1, 300 minutes in.
    reveal(280);
    dragTo('Motion with purpose', along('Hall B', 300)).drop();
    expect(onStage('Motion with purpose', 'Hall B')).toBe(true);
    await expect.poll(() => politeRegion()?.textContent).toBe('Motion with purpose moved to Hall B, Wed, Jun 2, 2:00 PM to 2:40 PM. Expects 400, Hall B seats 300');
    expect(talk('Motion with purpose').getAttribute('data-conflict')).toBe('warning');
  });

  it('marks the talk a speaker gives on another stage, refuses the drop and puts the mark back', async () => {
    setup();
    reveal(895);
    // Kenji Sato is on Panel: shipping 1.0 on Main stage from 15:00 to 16:00 on day 2, 900 to 960,
    // and Hall B is free then, so the speaker is the one thing in the way.
    const own = talk('Panel: shipping 1.0').getAttribute('data-conflict');
    expect(own).toBeNull();
    const drag = dragTo('Migrating to 1.0', along('Hall B', 915));
    await expect.poll(() => talk('Panel: shipping 1.0').getAttribute('data-conflict')).toBe('blocked');
    expect(lane('Hall B').textContent).toContain('Kenji Sato is in Panel: shipping 1.0 then');
    drag.drop();
    expect(within(screen.getByRole('list', { name: 'Unscheduled' })).getByRole('button', { name: /^Migrating to 1\.0,/ })).toBeTruthy();
    expect(talk('Panel: shipping 1.0').getAttribute('data-conflict')).toBe(own);
  });
});

describe('the menu', () => {
  it('hands focus to the talk on its new stage and back from the queue', async () => {
    setup();
    await open('Motion with purpose', 'Move to Hall B');
    await userEvent.keyboard('{Enter}');
    expect(onStage('Motion with purpose', 'Hall B')).toBe(true);
    await expect.poll(() => document.activeElement).toBe(trigger('Motion with purpose'));

    await open('Motion with purpose', 'Back to unscheduled');
    await userEvent.keyboard('{Enter}');
    expect(within(screen.getByRole('list', { name: 'Unscheduled' })).getByRole('button', { name: /^Motion with purpose,/ })).toBeTruthy();
    await expect.poll(() => document.activeElement).toBe(trigger('Motion with purpose'));
    await expect.poll(() => politeRegion()?.textContent).toBe('Motion with purpose moved to unscheduled');
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
    for (const zoom of ['One day', 'Whole event']) {
      it(`stay in view at every scroll amount at ${width}px, ${zoom}`, async () => {
        await page.viewport(width, height);
        setup();
        await userEvent.click(screen.getByRole('button', { name: zoom }));
        const scroller = board();
        const max = scroller.scrollWidth - scroller.clientWidth;
        expect(max).toBeGreaterThan(0);
        for (const amount of [0, 120, max / 4, max / 2, max - 40, max]) {
          scroller.scrollLeft = amount;
          const start = scroller.getBoundingClientRect().left + scroller.clientLeft;
          for (const name of ['Main stage', 'Hall B', 'Workshop room']) {
            const heading = within(stage(name)).getByRole('heading', { name });
            const box = heading.parentElement!.getBoundingClientRect();
            // At rest the names sit inside the area's room for focus rings; scrolled, they stick at its edge.
            expect(box.left - start, `${name} at ${amount}px`).toBeGreaterThan(-0.5);
            expect(box.left - start, `${name} at ${amount}px`).toBeLessThan(6);
            // Nothing paints over the name: the point at its middle hits the name itself.
            const at = centre(heading);
            expect(heading.parentElement!.contains(document.elementFromPoint(at.x, at.y)), `${name} covered at ${amount}px`).toBe(true);
          }
          // The corner covers the hours that scroll under the names column.
          const corner = rows().firstElementChild!.firstElementChild!;
          const at = centre(corner);
          expect(document.elementFromPoint(at.x, at.y)).toBe(corner);
        }
      });
    }
  }

  it('scrolls a day to just past the names column, with room for a focus ring, from its button', async () => {
    setup();
    // The header row's axis holds a cell for each day.
    const day = rows().firstElementChild!.children[1]!.children[1] as HTMLElement;
    expect(day.textContent).toContain('Thu, Jun 3');
    await userEvent.click(screen.getByRole('button', { name: 'Thu, Jun 3' }));
    const names = stage('Main stage').firstElementChild!.getBoundingClientRect();
    // The board's scroll-padding leaves a focus ring's room past the names.
    await expect.poll(() => day.getBoundingClientRect().left - names.right).toBeLessThan(6);
    expect(day.getBoundingClientRect().left - names.right).toBeCloseTo(4, 0);
  });

  it('keeps the time just past the names column when the zoom changes', async () => {
    setup();
    reveal(400);
    // The time on the axis at the first point the names column leaves visible.
    const shown = () => {
      const box = lane('Main stage').getBoundingClientRect();
      const x = stage('Main stage').firstElementChild!.getBoundingClientRect().right + 1;
      return ((x - box.left) / box.width) * UNITS;
    };
    const before = shown();
    expect(before).toBeGreaterThan(300);
    await userEvent.click(screen.getByRole('button', { name: 'Whole event' }));
    expect(Math.abs(shown() - before)).toBeLessThan(2);
  });
});

describe('the talks', () => {
  // A talk too short for its grip becomes its menu button, so no zoom leaves a button cut off.
  for (const zoom of ['One day', 'Whole event']) {
    it(`show every menu button whole, ${zoom}`, async () => {
      setup();
      await userEvent.click(screen.getByRole('button', { name: zoom }));
      for (const name of ['Main stage', 'Hall B', 'Workshop room']) {
        for (const button of within(stage(name)).getAllByRole('button')) {
          const block = button.closest('li')!;
          block.scrollIntoView({ block: 'nearest', inline: 'center' });
          const box = button.getBoundingClientRect();
          const outer = block.getBoundingClientRect();
          const label = button.getAttribute('aria-label');
          expect(box.width, label!).toBeGreaterThan(0);
          expect(box.left, label!).toBeGreaterThanOrEqual(outer.left - 0.5);
          expect(box.right, label!).toBeLessThanOrEqual(outer.right + 0.5);
          const at = centre(button);
          expect(button.contains(document.elementFromPoint(at.x, at.y)), `${label} covered`).toBe(true);
        }
      }
    });
  }
});

describe('the dialog', () => {
  async function openDialog(title: string) {
    await open(title, 'Change time or stage…');
    await userEvent.keyboard('{Enter}');
    return screen.findByRole('dialog', { name: `Move ${title}` });
  }

  it('takes focus when it opens, and gives it back to a queued talk on Cancel', async () => {
    setup();
    await open('Dark mode, done right', 'Schedule…');
    await userEvent.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog', { name: 'Schedule Dark mode, done right' });
    await expect.poll(() => dialog.contains(document.activeElement)).toBe(true);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(within(screen.getByRole('list', { name: 'Unscheduled' })).getByRole('button', { name: /^Dark mode, done right,/ })).toBeTruthy();
    await expect.poll(() => document.activeElement).toBe(trigger('Dark mode, done right'));
  });

  it('schedules a queued talk at the first free time it opens on', async () => {
    setup();
    await open('Dark mode, done right', 'Schedule…');
    await userEvent.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog', { name: 'Schedule Dark mode, done right' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Schedule' }));
    expect(trigger('Dark mode, done right').getAttribute('aria-label')).toBe('Dark mode, done right, Mira Patel, Design, Main stage, Wed, Jun 2, 11:15 AM to 11:45 AM');
    await expect.poll(() => document.activeElement).toBe(trigger('Dark mode, done right'));
  });

  it('moves a talk to the stage it picks and hands focus to the talk in its new place', async () => {
    setup();
    const dialog = await openDialog('Motion with purpose');
    await expect.poll(() => dialog.contains(document.activeElement)).toBe(true);
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: 'Stage' }), 'Hall B');
    expect(within(dialog).getByText('Expects 400, Hall B seats 300.')).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Move' }));
    expect(onStage('Motion with purpose', 'Hall B')).toBe(true);
    await expect.poll(() => document.activeElement).toBe(trigger('Motion with purpose'));
  });

  it('puts a blocked place on the start field, clears it on a change, and gives focus back on Escape', async () => {
    setup();
    // Move another talk first, so focus must go back to the talk the dialog edits, not the last one moved.
    await open('Writing UI copy', 'Move to Hall B');
    await userEvent.keyboard('{Enter}');
    const dialog = await openDialog('Motion with purpose');
    // The workshop room isn't recorded, and Motion with purpose is.
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: 'Stage' }), 'Workshop room');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Move' }));
    expect(await within(dialog).findByText("Workshop room isn't recorded.")).toBeVisible();
    expect(onStage('Motion with purpose', 'Main stage')).toBe(true);
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: 'Stage' }), 'Main stage');
    expect(within(dialog).queryByText("Workshop room isn't recorded.")).toBeNull();
    await userEvent.keyboard('{Escape}');
    await expect.poll(() => document.activeElement).toBe(trigger('Motion with purpose'));
  });
});
