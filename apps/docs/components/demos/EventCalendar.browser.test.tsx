import { act } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { page, userEvent } from 'vitest/browser';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import { formatTime } from '@tounsoo/todae';
import '@tounsoo/todae/todae.css';
import '../../app/globals.css';
import { paintedContrast } from '../../../../packages/design-system/src/test/paintedContrast';
import { settle } from '../../../../packages/design-system/src/test/settle';
import { Example } from '../Example';
import EventCalendarExample from '../../examples/recipes/event-calendar/EventCalendarExample';
import { AXE_OPTIONS, describeViolations } from '../../test/axe';
import { APPEARANCE_KEY } from '../appearanceScript';
import { Providers } from '../Providers';

afterEach(cleanup);

const clock = (text: string) => formatTime(Temporal.PlainTime.from(text), { locale: 'en-US' });

function spoken(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (!(node instanceof Element) || node.getAttribute('aria-hidden') === 'true' || node.hasAttribute('hidden')) return '';
  return [...node.childNodes].map((child) => spoken(child)).join('');
}

function planning(): HTMLElement {
  return screen.getByRole('button', { name: `Planning, ${clock('10:00')} to ${clock('12:00')}` });
}

describe('the month keyboard', () => {
  it('opens the focused day with Enter and moves focus to that day', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Month' }));
    screen.getByRole('button', { name: 'Thursday, November 19, 2026' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(document.activeElement).toBe(planning());
  });

  it('opens the focused day with Space and moves focus to that day', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Month' }));
    screen.getByRole('button', { name: 'Thursday, November 19, 2026' }).focus();
    await userEvent.keyboard('{Space}');
    expect(document.activeElement).toBe(planning());
  });
});

describe('the narrow month', () => {
  it('shows a dot and a count at 375px, and the titles once the month is wider than 30rem', async () => {
    await page.viewport(375, 800);
    render(
      <Providers>
        <main>
          <EventCalendarExample locale="en-US" />
        </main>
      </Providers>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Month' }));
    const day = screen.getByRole('button', { name: 'Monday, November 16, 2026' });
    const count = day.querySelector<HTMLElement>('[class*="count"]');
    const detail = day.querySelector<HTMLElement>('[class*="detail"]');
    if (!count || !detail) throw new Error('missing narrow month content');
    expect(getComputedStyle(count).display).toBe('flex');
    expect(count.querySelector('[class*="dot"]')).toBeTruthy();
    expect(count.textContent?.replace(/\s/g, '')).toBe('4');
    expect(day.getAttribute('aria-label')).toBe('Monday, November 16, 2026');
    const narrowBar = day.querySelector<HTMLElement>('[data-bar="offsite"]');
    if (!narrowBar) throw new Error('missing narrow bar');
    const narrowBox = narrowBar.getBoundingClientRect();
    expect(narrowBox.height).toBeGreaterThan(0);
    expect(narrowBox.height).toBeLessThan(12);
    expect(getComputedStyle(narrowBar.querySelector('[class*="barLabel"]')!).position).toBe('absolute');
    const handoffMonday = day.querySelector<HTMLElement>('[data-bar="handoff"]');
    const handoffTuesday = screen.getByRole('button', { name: 'Tuesday, November 17, 2026' }).querySelector<HTMLElement>('[data-bar="handoff"]');
    expect(handoffMonday && handoffTuesday).toBeTruthy();
    expect(Math.abs(handoffMonday!.getBoundingClientRect().top - handoffTuesday!.getBoundingClientRect().top)).toBeLessThan(2);
    const described = document.getElementById(day.getAttribute('aria-describedby') ?? '');
    expect(described && spoken(described)).toBe('Offsite, November 16, 2026, Handoff, November 16, 2026 – November 17, 2026, +2 more');

    await page.viewport(800, 800);
    await expect.poll(() => getComputedStyle(count).display).toBe('none');
    expect(getComputedStyle(detail).position).not.toBe('absolute');
    expect(detail.getBoundingClientRect().width).toBeGreaterThan(20);
    await page.viewport(1280, 800);
  });
});

const SCALE = 600;

function dayLane(name: string): HTMLElement {
  const headings = screen.getAllByRole('heading', { level: 3 });
  const index = headings.findIndex((heading) => heading.textContent === name);
  let body = headings[0]?.parentElement?.nextElementSibling ?? null;
  while (body && !body.querySelector('[class*="column"]')) body = body.nextElementSibling;
  const column = body?.children[index + 1];
  if (!(column instanceof HTMLElement)) throw new Error(`no lane for ${name}`);
  return column;
}

async function openMenu(): Promise<HTMLElement> {
  let found: HTMLElement | undefined;
  await expect.poll(() => {
    found = screen.getAllByRole('menu').find((item) => item.querySelector('[role="menuitem"]'));
    return found ?? null;
  }).toBeTruthy();
  if (!found) throw new Error('no open menu');
  return found;
}

function atUnits(name: string, units: number, scale = SCALE) {
  const box = dayLane(name).getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + (units / scale) * box.height };
}

const pointer = (type: string, target: EventTarget, x: number, y: number) => {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      clientX: x,
      clientY: y,
    }),
  );
};

function dragBlock(button: HTMLElement, to: { x: number; y: number }) {
  const item = button.closest('li');
  if (!item) throw new Error('event is not in a slot');
  const itemBox = item.getBoundingClientRect();
  const box = button.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const lead = y - itemBox.top;
  pointer('pointerdown', button, x, y);
  pointer('pointermove', button, x, y + 8);
  pointer('pointermove', button, to.x, to.y + lead);
  return {
    drop: () => pointer('pointerup', button, to.x, to.y + lead),
    escape: () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      pointer('pointerup', button, to.x, to.y + lead);
    },
  };
}

describe('moving, resizing, and editing', () => {
  const reviewName = () => screen.getByRole('button', { name: /^Design review,/ }).getAttribute('aria-label');

  it('drags an event to a later slot on the same day', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    const review = screen.getByRole('button', { name: `Design review, ${clock('09:00')} to ${clock('10:30')}` });
    dragBlock(review, atUnits('Mon, Nov 16', 120)).drop();
    await expect.poll(() => reviewName()).toBe(`Design review, ${clock('10:00')} to ${clock('11:30')}`);
    expect(screen.getByRole('button', { name: /^Standup,/ }).parentElement?.style.inlineSize).toBe('100%');
  });

  it('drags an event onto the next day at an earlier time', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    const review = screen.getByRole('button', { name: `Design review, ${clock('09:00')} to ${clock('10:30')}` });
    dragBlock(review, atUnits('Tue, Nov 17', 15)).drop();
    await expect.poll(() => dayLane('Tue, Nov 17').contains(screen.getByRole('button', { name: /^Design review,/ }))).toBe(true);
    expect(reviewName()).toBe(`Design review, ${clock('08:15')} to ${clock('09:45')}`);
  });

  it('drags an event onto the next day', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    const review = screen.getByRole('button', { name: `Design review, ${clock('09:00')} to ${clock('10:30')}` });
    dragBlock(review, atUnits('Tue, Nov 17', 60)).drop();
    await expect.poll(() => dayLane('Tue, Nov 17').contains(screen.getByRole('button', { name: /^Design review,/ }))).toBe(true);
    expect(reviewName()).toBe(`Design review, ${clock('09:00')} to ${clock('10:30')}`);
  });

  it('resizes an event from its end', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    const review = screen.getByRole('button', { name: `Design review, ${clock('09:00')} to ${clock('10:30')}` });
    const handle = review.parentElement?.querySelector<HTMLElement>('[data-edge="end"]');
    if (!handle) throw new Error('missing resize handle');
    const from = handle.getBoundingClientRect();
    const to = atUnits('Mon, Nov 16', 180);
    pointer('pointerdown', handle, from.left + from.width / 2, from.top + from.height / 2);
    pointer('pointermove', handle, from.left + from.width / 2, from.top + 8);
    pointer('pointermove', handle, to.x, to.y);
    pointer('pointerup', handle, to.x, to.y);
    await expect.poll(() => reviewName()).toBe(`Design review, ${clock('09:00')} to ${clock('11:00')}`);
  });

  it('restores the event when Escape cancels a drag', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    const review = screen.getByRole('button', { name: `Design review, ${clock('09:00')} to ${clock('10:30')}` });
    const gesture = dragBlock(review, atUnits('Mon, Nov 16', 180));
    // The Escape listener mounts in an effect after the drag renders. Sending the key in the same turn never reaches it.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    gesture.escape();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(reviewName()).toBe(`Design review, ${clock('09:00')} to ${clock('10:30')}`);
  });

  it('snaps a drop that lands between slots', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    const review = screen.getByRole('button', { name: `Design review, ${clock('09:00')} to ${clock('10:30')}` });
    dragBlock(review, atUnits('Mon, Nov 16', 72)).drop();
    await expect.poll(() => reviewName()).toBe(`Design review, ${clock('09:15')} to ${clock('10:45')}`);
  });

  it('keeps one slot when a resize starts between grid points', async () => {
    const talk = {
      id: 'talk',
      title: 'Talk',
      allDay: false,
      start: Temporal.ZonedDateTime.from('2026-11-16T10:07:00-08:00[America/Los_Angeles]'),
      end: Temporal.ZonedDateTime.from('2026-11-16T12:00:00-08:00[America/Los_Angeles]'),
    };
    render(
      <Providers>
        <EventCalendarExample locale="en-US" events={[talk]} />
      </Providers>,
    );
    const button = screen.getByRole('button', { name: `Talk, ${clock('10:07')} to ${clock('12:00')}` });
    const handle = button.closest('li')?.querySelector<HTMLElement>('[data-edge="end"]');
    if (!handle) throw new Error('missing resize handle');
    const from = handle.getBoundingClientRect();
    const to = atUnits('Mon, Nov 16', 0);
    pointer('pointerdown', handle, from.left + from.width / 2, from.top + from.height / 2);
    pointer('pointermove', handle, from.left + from.width / 2, from.top + 8);
    pointer('pointermove', handle, to.x, to.y);
    pointer('pointerup', handle, to.x, to.y);
    await expect.poll(() => screen.getByRole('button', { name: /^Talk,/ }).getAttribute('aria-label')).toBe(`Talk, ${clock('10:07')} to ${clock('10:30')}`);
  });

  it('stops a resize above the start at one slot', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    const planning = screen.getByRole('button', { name: `Planning, ${clock('10:00')} to ${clock('12:00')}` });
    const handle = planning.closest('li')?.querySelector<HTMLElement>('[data-edge="end"]');
    if (!handle) throw new Error('missing resize handle');
    const from = handle.getBoundingClientRect();
    const to = atUnits('Thu, Nov 19', 0);
    pointer('pointerdown', handle, from.left + from.width / 2, from.top + from.height / 2);
    pointer('pointermove', handle, from.left + from.width / 2, from.top + 8);
    pointer('pointermove', handle, to.x, to.y);
    pointer('pointerup', handle, to.x, to.y);
    await expect.poll(() => screen.getByRole('button', { name: /^Planning,/ }).getAttribute('aria-label')).toBe(`Planning, ${clock('10:00')} to ${clock('10:15')}`);
  });

  it('stops a resize at one slot', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    const review = screen.getByRole('button', { name: `Design review, ${clock('09:00')} to ${clock('10:30')}` });
    const handle = review.closest('li')?.querySelector<HTMLElement>('[data-edge="end"]');
    if (!handle) throw new Error('missing resize handle');
    const from = handle.getBoundingClientRect();
    const to = atUnits('Mon, Nov 16', 65);
    pointer('pointerdown', handle, from.left + from.width / 2, from.top + from.height / 2);
    pointer('pointermove', handle, from.left + from.width / 2, from.top + 8);
    pointer('pointermove', handle, to.x, to.y);
    pointer('pointerup', handle, to.x, to.y);
    await expect.poll(() => reviewName()).toBe(`Design review, ${clock('09:00')} to ${clock('09:15')}`);
  });

  it('refuses a drop past a shorter day close', async () => {
    const sync = {
      id: 'sync',
      title: 'Sync',
      allDay: false,
      start: Temporal.ZonedDateTime.from('2026-03-08T01:00:00-08:00[America/Los_Angeles]'),
      end: Temporal.ZonedDateTime.from('2026-03-08T01:30:00-08:00[America/Los_Angeles]'),
    };
    render(
      <Providers>
        <EventCalendarExample locale="en-US" anchor={Temporal.PlainDate.from('2026-03-08')} opens={Temporal.PlainTime.from('01:00')} closes={Temporal.PlainTime.from('04:00')} events={[sync]} />
      </Providers>,
    );
    const name = `Sync, ${clock('01:00')} to ${clock('01:30')}`;
    const button = screen.getByRole('button', { name });
    dragBlock(button, atUnits('Sun, Mar 8', 150, 180)).drop();
    await expect.poll(() => document.querySelector('[data-dragging]')).toBeNull();
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined)));
    });
    expect(screen.getByRole('button', { name }).getAttribute('aria-label')).toBe(name);
  });

  it('moves an event from the keyboard and returns focus to it', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    const review = screen.getByRole('button', { name: `Design review, ${clock('09:00')} to ${clock('10:30')}` });
    review.focus();
    await userEvent.keyboard('{Enter}');
    const menu = await openMenu();
    const items = within(menu).getAllByRole('menuitem');
    const target = items.findIndex((item) => item.textContent === '15 minutes later');
    expect(target).toBeGreaterThan(0);
    await userEvent.keyboard('{ArrowDown}'.repeat(target));
    await userEvent.keyboard('{Enter}');
    const moved = screen.getByRole('button', { name: `Design review, ${clock('09:15')} to ${clock('10:45')}` });
    await expect.poll(() => document.activeElement).toBe(moved);
    await expect.poll(() => document.querySelector('[data-todae-announcer] [aria-live="polite"]')?.textContent).toBe(`Design review, ${clock('09:15')} to ${clock('10:45')}`);
  });

  it('edits the end in the dialog, shows the error, then saves', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    const review = screen.getByRole('button', { name: `Design review, ${clock('09:00')} to ${clock('10:30')}` });
    review.focus();
    await userEvent.keyboard('{Enter}');
    const menu = await openMenu();
    const items = within(menu).getAllByRole('menuitem');
    const target = items.findIndex((item) => item.textContent === 'Edit…');
    await userEvent.keyboard('{ArrowDown}'.repeat(target));
    await userEvent.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog', { name: 'Edit Design review' });
    const end = within(dialog).getByRole('textbox', { name: 'End' });
    await userEvent.clear(end);
    await userEvent.type(end, '8:00 AM');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('End must be after the start.')).toBeTruthy();
    await userEvent.clear(end);
    await userEvent.type(end, '11:00 AM');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await expect.poll(() => screen.queryByRole('dialog')).toBeNull();
    const saved = screen.getByRole('button', { name: `Design review, ${clock('09:00')} to ${clock('11:00')}` });
    await expect.poll(() => document.activeElement).toBe(saved);
  });
});

function longDate(iso: string, locale = 'en-US'): string {
  const day = Temporal.PlainDate.from(iso);
  return new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(day.year, day.month - 1, day.day));
}

function longRange(start: string, end: string, locale = 'en-US'): string {
  return `${longDate(start, locale)} – ${longDate(end, locale)}`;
}

function monthBar(dayName: string, id: string): HTMLElement {
  const bar = screen.getByRole('button', { name: dayName }).querySelector<HTMLElement>(`[data-bar="${id}"]`);
  if (!bar) throw new Error(`no ${id} bar on ${dayName}`);
  return bar;
}

async function openEditor(name: string | RegExp | HTMLElement) {
  const trigger = name instanceof HTMLElement ? name : screen.getByRole('button', { name });
  trigger.focus();
  await userEvent.keyboard('{Enter}');
  const menu = await openMenu();
  const items = within(menu).getAllByRole('menuitem');
  const target = items.findIndex((item) => item.textContent === 'Edit…');
  await userEvent.keyboard('{ArrowDown}'.repeat(target));
  await userEvent.keyboard('{Enter}');
  return screen.findByRole('dialog');
}

function ringRoom(el: HTMLElement): number {
  const style = getComputedStyle(el);
  const width = style.outlineStyle === 'none' ? 0 : Number.parseFloat(style.outlineWidth) || 0;
  return width + (Number.parseFloat(style.outlineOffset) || 0);
}

function expectStripInsideBoard() {
  const board = document.querySelector<HTMLElement>('[class*="board"]');
  if (!board) throw new Error('missing board');
  const bars = [...board.querySelectorAll<HTMLButtonElement>('[class*="stripSlot"] button')];
  expect(bars.length).toBeGreaterThan(0);
  const edge = board.getBoundingClientRect().left + board.clientLeft + board.clientWidth;
  for (const bar of bars) {
    bar.focus({ focusVisible: true } as FocusOptions);
    const box = bar.getBoundingClientRect();
    const name = bar.getAttribute('aria-label') ?? '';
    expect(box.right, name).toBeLessThanOrEqual(edge + 0.5);
    expect(box.right + ringRoom(bar), name).toBeLessThanOrEqual(edge + 0.5);
  }
}

describe('multi-day bars', () => {
  it('draws a week-crossing event as one bar, with a cut at the week boundary', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Month' }));
    const friday = monthBar('Friday, November 20, 2026', 'retreat');
    const saturday = monthBar('Saturday, November 21, 2026', 'retreat');
    const sunday = monthBar('Sunday, November 22, 2026', 'retreat');
    const fridayBox = friday.getBoundingClientRect();
    const saturdayBox = saturday.getBoundingClientRect();
    expect(Math.abs(fridayBox.top - saturdayBox.top)).toBeLessThan(2);
    expect(saturdayBox.left - fridayBox.right).toBeLessThan(8);
    expect(saturdayBox.left).toBeGreaterThan(fridayBox.right - 2);
    expect(friday.querySelector('[class*="barLabel"]')?.textContent).toBe('Retreat');
    expect(saturday.querySelector('[class*="barLabel"]')).toBeNull();
    expect(friday.querySelectorAll('[class*="cue"]')).toHaveLength(0);
    expect(saturday.querySelectorAll('[class*="cue"]')).toHaveLength(1);
    expect(sunday.querySelectorAll('[class*="cue"]')).toHaveLength(1);
    expect(friday.hasAttribute('data-cut-end')).toBe(false);
    expect(saturday.hasAttribute('data-cut-start')).toBe(false);
    expect(saturday.hasAttribute('data-join-start')).toBe(true);
    expect(saturday.hasAttribute('data-cut-end')).toBe(true);
    expect(sunday.hasAttribute('data-cut-start')).toBe(true);
    const saturdayCue = saturday.querySelector<HTMLElement>('[class*="cueEnd"]');
    expect(saturdayCue).toBeTruthy();
    expect(saturday.getBoundingClientRect().right - saturdayCue!.getBoundingClientRect().right).toBeLessThan(12);
    const handoffMonday = monthBar('Monday, November 16, 2026', 'handoff');
    const handoffTuesday = monthBar('Tuesday, November 17, 2026', 'handoff');
    expect(Math.abs(handoffMonday.getBoundingClientRect().top - handoffTuesday.getBoundingClientRect().top)).toBeLessThan(2);
    const interview = screen.getByRole('button', { name: 'Tuesday, November 17, 2026' }).querySelector<HTMLElement>('[class*="chip_"]');
    expect(interview).toBeTruthy();
    expect(interview!.getBoundingClientRect().top).toBeGreaterThan(handoffTuesday.getBoundingClientRect().bottom - 1);
    const fridayDay = screen.getByRole('button', { name: 'Friday, November 20, 2026' });
    const saturdayDay = screen.getByRole('button', { name: 'Saturday, November 21, 2026' });
    expect(spoken(document.getElementById(fridayDay.getAttribute('aria-describedby') ?? '')!)).toContain(`Retreat, ${longRange('2026-11-20', '2026-11-22')}`);
    expect(spoken(document.getElementById(saturdayDay.getAttribute('aria-describedby') ?? '')!)).toContain('Retreat');
    expect(fridayDay.querySelectorAll('[class*="chip_"]')).toHaveLength(1);
  });

  it('places all-day and overnight events on the week strip, and on the day', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    const retreat = screen.getByRole('button', { name: `Retreat, ${longRange('2026-11-20', '2026-11-22')}` });
    const friday = screen.getByRole('heading', { name: 'Fri, Nov 20' }).getBoundingClientRect();
    const box = retreat.getBoundingClientRect();
    expect(box.width).toBeGreaterThan(friday.width * 1.4);
    expect(box.top).toBeLessThan(dayLane('Fri, Nov 20').getBoundingClientRect().top);
    expect(retreat.hasAttribute('data-cut-end')).toBe(true);
    const cue = retreat.querySelector<HTMLElement>('[class*="cueEnd"]');
    expect(cue).toBeTruthy();
    expect(retreat.getBoundingClientRect().right - cue!.getBoundingClientRect().right).toBeLessThan(16);
    const stripButtons = [...document.querySelectorAll<HTMLButtonElement>('[class*="stripSlot"] button')];
    expect(stripButtons.map((button) => button.getAttribute('aria-label')?.split(',')[0])).toEqual(['Offsite', 'Launch watch', 'Retreat']);
    expectStripInsideBoard();
    const launch = screen.getByRole('button', { name: `Launch watch, ${longRange('2026-11-18', '2026-11-19')}, ${clock('22:00')} to ${clock('02:00')}` });
    expect(dayLane('Wed, Nov 18').contains(launch)).toBe(false);
    const handoff = screen.getAllByRole('button', { name: /^Handoff,/ });
    expect(handoff.some((button) => dayLane('Wed, Nov 18').contains(button))).toBe(false);
    expect(handoff.some((button) => dayLane('Mon, Nov 16').contains(button))).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Day' }));
    expect(screen.getByRole('heading', { name: 'Mon, Nov 16' })).toBeTruthy();
    expect(screen.getByRole('button', { name: `Offsite, ${longDate('2026-11-16')}` })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Retreat/ })).toBeNull();
  });

  it('opens a strip bar from the keyboard into its menu', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    const retreat = screen.getByRole('button', { name: `Retreat, ${longRange('2026-11-20', '2026-11-22')}` });
    retreat.focus();
  await userEvent.keyboard('{Enter}');
  const menu = await openMenu();
  expect(within(menu).getByRole('menuitem', { name: 'Edit…' })).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    await expect.poll(() => document.activeElement).toBe(retreat);
  });

  it('keeps the month and the strip inside 375px', async () => {
    await page.viewport(375, 800);
    render(
      <Providers>
        <main>
          <EventCalendarExample locale="en-US" />
        </main>
      </Providers>,
    );
    const frame = () => document.querySelector('main') ?? document.body;
    await userEvent.click(screen.getByRole('button', { name: 'Month' }));
    const monday = screen.getByRole('button', { name: 'Monday, November 16, 2026' });
    const count = monday.querySelector<HTMLElement>('[class*="count"]');
    if (!count) throw new Error('missing narrow count');
    expect(getComputedStyle(count).display).toBe('flex');
    expect(count.textContent?.replace(/\s/g, '')).toBe('4');
    const retreatBar = monthBar('Friday, November 20, 2026', 'retreat');
    const nextRetreat = monthBar('Saturday, November 21, 2026', 'retreat');
    expect(retreatBar.getBoundingClientRect().height).toBeGreaterThan(0);
    expect(retreatBar.getBoundingClientRect().height).toBeLessThan(12);
    expect(Math.abs(retreatBar.getBoundingClientRect().top - nextRetreat.getBoundingClientRect().top)).toBeLessThan(2);
    expect(retreatBar.querySelectorAll('[class*="cue"]')).toHaveLength(0);
    expect(nextRetreat.querySelectorAll('[class*="cue"]')).toHaveLength(1);
    expect(frame().scrollWidth).toBeLessThanOrEqual(frame().clientWidth + 1);
    await userEvent.click(screen.getByRole('button', { name: 'Week' }));
    const retreat = screen.getByRole('button', { name: /Retreat/ });
    expect(retreat.getBoundingClientRect().height).toBeGreaterThan(0);
    expect(retreat.scrollWidth).toBeLessThanOrEqual(retreat.clientWidth + 1);
    expect(frame().scrollWidth).toBeLessThanOrEqual(frame().clientWidth + 1);
    await page.viewport(1280, 800);
  });

  it('moves an event into the strip when it is all day, and back onto the lane', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    const standup = () => screen.getByRole('button', { name: /^Standup,/ });
    expect(standup().parentElement?.style.inlineSize).toBe('50%');
    const dialog = await openEditor(`Design review, ${clock('09:00')} to ${clock('10:30')}`);
    await userEvent.click(within(dialog).getByRole('switch', { name: 'All day' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await expect.poll(() => screen.queryByRole('dialog')).toBeNull();
    const strip = screen.getByRole('button', { name: `Design review, ${longDate('2026-11-16')}` });
    expect(dayLane('Mon, Nov 16').contains(strip)).toBe(false);
    expect(standup().parentElement?.style.inlineSize).toBe('100%');
    await expect.poll(() => document.activeElement).toBe(strip);

    const again = await openEditor(`Design review, ${longDate('2026-11-16')}`);
    await userEvent.click(within(again).getByRole('switch', { name: 'All day' }));
    expect((within(again).getByRole('textbox', { name: 'Start' }) as HTMLInputElement).value).toMatch(/9:00/);
    expect((within(again).getByRole('textbox', { name: 'End' }) as HTMLInputElement).value).toMatch(/10:30/);
    await userEvent.click(within(again).getByRole('button', { name: 'Save' }));
    await expect.poll(() => screen.queryByRole('dialog')).toBeNull();
    const lane = screen.getByRole('button', { name: `Design review, ${clock('09:00')} to ${clock('10:30')}` });
    expect(dayLane('Mon, Nov 16').contains(lane)).toBe(true);
    expect(standup().parentElement?.style.inlineSize).toBe('50%');
  });

  it('draws an edited multi-day event as one month bar, then restores the single day', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    const dialog = await openEditor(`Demo, ${clock('13:00')} to ${clock('14:00')}`);
    const endDate = within(dialog).getByRole('textbox', { name: 'End date' });
    await userEvent.clear(endDate);
    await userEvent.type(endDate, '11/22/2026');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await expect.poll(() => screen.queryByRole('dialog')).toBeNull();
    expect(dayLane('Fri, Nov 20').querySelectorAll('button').length).toBeGreaterThan(0);
    expect(dayLane('Sat, Nov 21').textContent).toContain('Demo');

    await userEvent.click(screen.getByRole('button', { name: 'Month' }));
    const friday = monthBar('Friday, November 20, 2026', 'demo');
    const saturday = monthBar('Saturday, November 21, 2026', 'demo');
    const sunday = monthBar('Sunday, November 22, 2026', 'demo');
    expect(saturday.getBoundingClientRect().left - friday.getBoundingClientRect().right).toBeLessThan(8);
    expect(sunday.hasAttribute('data-cut-start')).toBe(true);
    expect(spoken(document.getElementById(screen.getByRole('button', { name: 'Sunday, November 22, 2026' }).getAttribute('aria-describedby') ?? '')!)).toContain('Demo');

    await userEvent.click(screen.getByRole('button', { name: 'Week' }));
    const demo = [...dayLane('Fri, Nov 20').querySelectorAll('button')].find((button) => button.getAttribute('aria-label')?.startsWith('Demo,'));
    if (!demo) throw new Error('missing Demo');
    const back = await openEditor(demo);
    const restore = within(back).getByRole('textbox', { name: 'End date' });
    await userEvent.clear(restore);
    await userEvent.type(restore, '11/20/2026');
    await userEvent.click(within(back).getByRole('button', { name: 'Save' }));
    await expect.poll(() => screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Month' }));
    expect(screen.getByRole('button', { name: 'Saturday, November 21, 2026' }).querySelector('[data-bar="demo"]')).toBeNull();
    expect(spoken(document.getElementById(screen.getByRole('button', { name: 'Friday, November 20, 2026' }).getAttribute('aria-describedby') ?? '')!)).toContain('Demo');
  });

  it('keeps each strip bar and its focus ring inside the board', async () => {
    try {
      for (const [width, height] of [
        [414, 896],
        [375, 800],
        [1280, 800],
      ] as const) {
        await page.viewport(width, height);
        const view = render(
          <Providers>
            <main>
              <Example>
                <EventCalendarExample locale="en-US" />
              </Example>
            </main>
          </Providers>,
        );
        expectStripInsideBoard();
        view.unmount();
      }
    } finally {
      await page.viewport(1280, 800);
    }
  });
});

function dayNumberBox(button: HTMLElement): DOMRect {
  const text = [...button.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim());
  if (!text) throw new Error(`no day number on ${button.getAttribute('aria-label')}`);
  const range = document.createRange();
  range.selectNodeContents(text);
  return range.getBoundingClientRect();
}

function paintedMonthEvents(day: HTMLElement): HTMLElement[] {
  return [...day.querySelectorAll<HTMLElement>('[data-bar], [class*="chip_"], [class*="more_"], [class*="count_"]')].filter((event) => {
    const box = event.getBoundingClientRect();
    return box.width > 1 && box.height > 1 && getComputedStyle(event).position !== 'absolute';
  });
}

describe('month day cells', () => {
  it('keeps every event inside a bounded day, with week rows at least a calendar cell tall', async () => {
    try {
      for (const width of [1280, 1024, 768, 414, 375]) {
        await page.viewport(width, 900);
        const view = render(
          <Providers>
            <main>
              <EventCalendarExample locale="en-US" />
            </main>
          </Providers>,
        );
        await userEvent.click(screen.getByRole('button', { name: 'Month' }));
        const grid = screen.getByRole('grid');
        const gridBox = grid.getBoundingClientRect();
        const cells = [...grid.querySelectorAll<HTMLElement>('[data-todae-calendar-cell]')];
        expect(cells.length, `${width}`).toBeGreaterThan(27);
        for (const cell of cells) {
          const td = cell.closest('td');
          if (!(td instanceof HTMLElement)) throw new Error('day is not in a cell');
          const cellBox = cell.getBoundingClientRect();
          const tdBox = td.getBoundingClientRect();
          const tdStyle = getComputedStyle(td);
          const label = `${width} ${cell.getAttribute('aria-label')}`;
          expect(parseFloat(tdStyle.borderTopWidth), label).toBeGreaterThan(0);
          expect(parseFloat(tdStyle.borderInlineStartWidth), label).toBeGreaterThan(0);
          expect(tdStyle.borderTopColor, label).not.toBe('rgba(0, 0, 0, 0)');
          expect(tdBox.height - cellBox.height, label).toBeLessThan(4);
          const number = dayNumberBox(cell);
          expect(number.left - cellBox.left, label).toBeLessThan(cellBox.width / 4);
          expect(number.top - cellBox.top, label).toBeLessThan(cellBox.height / 2);
          for (const event of paintedMonthEvents(cell)) {
            const box = event.getBoundingClientRect();
            const name = `${label} ${event.getAttribute('data-bar') ?? event.textContent}`;
            expect(box.left, name).toBeGreaterThanOrEqual(cellBox.left - 1);
            expect(box.right, name).toBeLessThanOrEqual(cellBox.right + 1);
            expect(box.top, name).toBeGreaterThanOrEqual(cellBox.top - 1);
            expect(box.bottom, name).toBeLessThanOrEqual(cellBox.bottom + 1);
            expect(box.left, name).toBeGreaterThanOrEqual(gridBox.left - 0.5);
            expect(box.right, name).toBeLessThanOrEqual(gridBox.right + 0.5);
            if (event.hasAttribute('data-bar')) {
              expect(Math.abs(box.left - cellBox.left), name).toBeLessThan(3);
              expect(Math.abs(box.right - cellBox.right), name).toBeLessThan(3);
            }
          }
        }
        const rows = [...grid.querySelectorAll('tbody tr')];
        const empty = rows.filter((row) => row.querySelector('[data-bar], [class*="chip_"], [class*="count_"]') === null);
        expect(empty.length, `${width}`).toBeGreaterThan(1);
        const emptyHeight = empty[0]?.getBoundingClientRect().height ?? 0;
        for (const row of empty) expect(Math.abs(row.getBoundingClientRect().height - emptyHeight), `${width}`).toBeLessThan(2);
        for (const row of rows) expect(row.getBoundingClientRect().height, `${width}`).toBeGreaterThanOrEqual(emptyHeight - 1);
        const sample = cells.find((cell) => !cell.hasAttribute('data-outside'));
        if (!sample) throw new Error('no in-month day');
        expect(emptyHeight, `${width}`).toBeGreaterThan(dayNumberBox(sample).height * 2);
        const outside = cells.find((cell) => cell.hasAttribute('data-outside'));
        const inside = cells.find((cell) => !cell.hasAttribute('data-outside'));
        if (outside && inside) {
          expect(getComputedStyle(outside.closest('td')!).backgroundColor, `${width}`).not.toBe(getComputedStyle(inside.closest('td')!).backgroundColor);
        }
        const wednesday = screen.getByRole('button', { name: 'Wednesday, November 18, 2026' });
        const launch = wednesday.querySelector<HTMLElement>('[data-bar="launch"]');
        const early = [...wednesday.querySelectorAll<HTMLElement>('[class*="chip_"]')].find((event) => event.textContent?.includes('Early sync'));
        if (!launch || !early) throw new Error(`${width}: Wednesday is missing Launch watch or Early sync`);
        if (getComputedStyle(early).position !== 'absolute') {
          expect(early.getBoundingClientRect().top - launch.getBoundingClientRect().bottom, `${width}`).toBeLessThan(12);
        }
        wednesday.focus({ focusVisible: true } as FocusOptions);
        const focused = wednesday.getBoundingClientRect();
        const home = wednesday.closest('td')!.getBoundingClientRect();
        const focusStyle = getComputedStyle(wednesday);
        expect(focusStyle.outlineStyle, `${width}`).not.toBe('none');
        const outlineWidth = Number.parseFloat(focusStyle.outlineWidth) || 0;
        const outlineOffset = Number.parseFloat(focusStyle.outlineOffset) || 0;
        expect(outlineWidth, `${width}`).toBeGreaterThan(0);
        const outer = Math.max(0, outlineWidth + outlineOffset);
        expect(focused.top - outer, `${width}`).toBeGreaterThanOrEqual(home.top - 0.5);
        expect(focused.left - outer, `${width}`).toBeGreaterThanOrEqual(home.left - 0.5);
        expect(focused.right + outer, `${width}`).toBeLessThanOrEqual(home.right + 0.5);
        expect(focused.bottom + outer, `${width}`).toBeLessThanOrEqual(home.bottom + 0.5);
        view.unmount();
      }
    } finally {
      await page.viewport(1280, 800);
    }
  });
});

describe('the month in light and dark', () => {
  for (const appearance of ['light', 'dark'] as const) {
    it(`paints the month titles and counts clearly in ${appearance}`, async () => {
      window.localStorage.setItem(APPEARANCE_KEY, appearance);
      render(
        <Providers>
          <main>
            <EventCalendarExample locale="en-US" />
          </main>
        </Providers>,
      );
      await userEvent.click(screen.getByRole('button', { name: 'Month' }));
      await settle();
      expect(document.documentElement.getAttribute('data-appearance')).toBe(appearance);
      expect(describeViolations(await axe.run(document.body, AXE_OPTIONS))).toEqual([]);
      expect(paintedContrast().low).toEqual([]);
    });
  }

  afterEach(() => {
    window.localStorage.removeItem(APPEARANCE_KEY);
    document.documentElement.removeAttribute('data-appearance');
  });
});
