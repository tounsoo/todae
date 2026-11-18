import { act } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { cdp, page, userEvent } from 'vitest/browser';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDate, formatTime } from '@tounsoo/todae';
import '@tounsoo/todae/todae.css';
import '../../app/globals.css';
import { paintedContrast } from '../../../../packages/design-system/src/test/paintedContrast';
import { settle } from '../../../../packages/design-system/src/test/settle';
import { Example } from '../Example';
import { EventCalendarExample } from '../../examples/recipes/event-calendar/EventCalendarExample';
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

const pointer = (type: string, target: EventTarget, x: number, y: number, pointerType: 'mouse' | 'touch' = 'mouse') => {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      pointerType,
      isPrimary: true,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      clientX: x,
      clientY: y,
    }),
  );
};

function dragLane(name: string | HTMLElement, from: number, to: number, scale = SCALE, pointerType: 'mouse' | 'touch' = 'mouse') {
  const lane = typeof name === 'string' ? dayLane(name) : name;
  const box = lane.getBoundingClientRect();
  const yAt = (units: number) => box.top + (units / scale) * box.height;
  const x = box.left + box.width / 2;
  const fromY = yAt(from);
  const toY = yAt(to);
  pointer('pointerdown', lane, x, fromY, pointerType);
  pointer('pointermove', lane, x, fromY + (toY >= fromY ? 8 : -8), pointerType);
  pointer('pointermove', lane, x, toY, pointerType);
  return {
    lane,
    drop: () => pointer('pointerup', lane, x, toY, pointerType),
    escape: () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      pointer('pointerup', lane, x, toY, pointerType);
    },
  };
}

async function frameBox() {
  const read = await cdp().send('Runtime.evaluate', {
    expression:
      '(() => { const frame = document.querySelector(\'[data-vitest="true"]\'); const box = frame.getBoundingClientRect(); return { left: box.left, top: box.top, width: box.width, height: box.height }; })()',
    returnByValue: true,
  });
  return read.result.value as { left: number; top: number; width: number; height: number };
}

async function fingerDrag(from: { x: number; y: number }, to: { x: number; y: number }) {
  const session = cdp();
  const box = await frameBox();
  const point = (x: number, y: number) => ({
    x: box.left + x * (box.width / window.innerWidth),
    y: box.top + y * (box.height / window.innerHeight),
    id: 0,
  });
  const step = to.y === from.y ? { x: from.x + (to.x >= from.x ? 12 : -12), y: from.y } : { x: from.x, y: from.y + (to.y >= from.y ? 12 : -12) };
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(from.x, from.y)] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(step.x, step.y)] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(to.x, to.y)] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

function clickLane(name: string, units: number, scale = SCALE, pointerType: 'mouse' | 'touch' = 'mouse') {
  const lane = dayLane(name);
  const box = lane.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + (units / scale) * box.height;
  pointer('pointerdown', lane, x, y, pointerType);
  pointer('pointerup', lane, x, y, pointerType);
  return lane;
}

function expectCreatePreview(lane: HTMLElement, start: number, end: number, scale = SCALE) {
  const preview = lane.querySelector<HTMLElement>('[data-create]');
  expect(preview).toBeTruthy();
  if (!preview) throw new Error('missing create preview');
  expect(preview.getAttribute('aria-hidden')).toBe('true');
  expect(preview.closest('button')).toBeNull();
  expect(getComputedStyle(preview).pointerEvents).toBe('none');
  expect(getComputedStyle(preview).borderTopStyle).toBe('dashed');
  const laneBox = lane.getBoundingClientRect();
  const box = preview.getBoundingClientRect();
  expect(Math.abs(box.top - (laneBox.top + (start / scale) * laneBox.height))).toBeLessThan(2);
  expect(Math.abs(box.height - ((end - start) / scale) * laneBox.height)).toBeLessThan(2);
  expect(lane.contains(preview)).toBe(true);
  return preview;
}

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
        <EventCalendarExample locale="en-US" timeZone="America/Los_Angeles" events={[talk]} />
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
        <EventCalendarExample locale="en-US" timeZone="America/Los_Angeles" anchor={Temporal.PlainDate.from('2026-03-08')} opens={Temporal.PlainTime.from('01:00')} closes={Temporal.PlainTime.from('04:00')} events={[sync]} />
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
    expect(saturdayBox.left).toBeGreaterThan(fridayBox.right - 6);
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
            const joinStart = event.hasAttribute('data-join-start');
            const joinEnd = event.hasAttribute('data-join-end');
            const overlap = 4;
            expect(box.left, name).toBeGreaterThanOrEqual(cellBox.left - (joinStart ? overlap : 1));
            expect(box.right, name).toBeLessThanOrEqual(cellBox.right + (joinEnd ? overlap : 1));
            expect(box.top, name).toBeGreaterThanOrEqual(cellBox.top - 1);
            expect(box.bottom, name).toBeLessThanOrEqual(cellBox.bottom + 1);
            expect(box.left, name).toBeGreaterThanOrEqual(gridBox.left - 0.5);
            expect(box.right, name).toBeLessThanOrEqual(gridBox.right + 0.5);
            if (event.hasAttribute('data-bar')) {
              if (!joinStart) expect(Math.abs(box.left - cellBox.left), name).toBeLessThan(3);
              if (!joinEnd) expect(Math.abs(box.right - cellBox.right), name).toBeLessThan(3);
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

function contrastRatio(foreground: string, background: string): number {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ink = canvas.getContext('2d', { willReadFrequently: true });
  if (!ink) throw new Error('no canvas');
  const sample = (color: string) => {
    const paint = (start: string) => {
      ink.fillStyle = start;
      ink.fillStyle = color;
      ink.fillRect(0, 0, 1, 1);
      return ink.getImageData(0, 0, 1, 1).data;
    };
    const [r, g, b] = paint('#000');
    const [r2, g2, b2] = paint('#fff');
    if (r !== r2 || g !== g2 || b !== b2) throw new Error(`canvas can't read ${color}`);
    return [r! / 255, g! / 255, b! / 255];
  };
  const channel = (value: number) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = (rgb: number[]) => 0.2126 * channel(rgb[0]!) + 0.7152 * channel(rgb[1]!) + 0.0722 * channel(rgb[2]!);
  const lighter = Math.max(luminance(sample(foreground)), luminance(sample(background)));
  const darker = Math.min(luminance(sample(foreground)), luminance(sample(background)));
  return (lighter + 0.05) / (darker + 0.05);
}

describe('month bar polish', () => {
  afterEach(() => {
    window.localStorage.removeItem(APPEARANCE_KEY);
    document.documentElement.removeAttribute('data-appearance');
  });

  it('keeps a multi-day bar at least 3:1 against its cell and its text at least 4.5:1', async () => {
    for (const appearance of ['light', 'dark'] as const) {
      window.localStorage.setItem(APPEARANCE_KEY, appearance);
      const view = render(
        <Providers>
          <main>
            <EventCalendarExample locale="en-US" />
          </main>
        </Providers>,
      );
      await userEvent.click(screen.getByRole('button', { name: 'Month' }));
      await settle();
      const friday = screen.getByRole('button', { name: 'Friday, November 20, 2026' });
      const bar = friday.querySelector<HTMLElement>('[data-bar="retreat"]');
      const label = bar?.querySelector<HTMLElement>('[class*="barLabel"]');
      if (!bar || !label) throw new Error(`${appearance}: Retreat is missing`);
      const barStyle = getComputedStyle(bar);
      const cellStyle = getComputedStyle(friday.closest('td')!);
      expect(contrastRatio(barStyle.backgroundColor, cellStyle.backgroundColor), `${appearance} fill`).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(barStyle.borderTopColor, cellStyle.backgroundColor), `${appearance} border`).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(getComputedStyle(label).color, barStyle.backgroundColor), `${appearance} text`).toBeGreaterThanOrEqual(4.5);
      view.unmount();
    }
  });

  it('circles today on the number and leaves the cell border alone', async () => {
    const clock = vi.spyOn(Temporal.Now, 'plainDateISO').mockReturnValue(Temporal.PlainDate.from('2026-11-18'));
    try {
    for (const appearance of ['light', 'dark'] as const) {
      window.localStorage.setItem(APPEARANCE_KEY, appearance);
      const view = render(
        <Providers>
          <main>
            <EventCalendarExample locale="en-US" />
          </main>
        </Providers>,
      );
      await userEvent.click(screen.getByRole('button', { name: 'Month' }));
      await settle();
      const today = screen.getByRole('button', { name: 'Wednesday, November 18, 2026' });
      const other = screen.getByRole('button', { name: 'Thursday, November 19, 2026' });
      const todayCell = getComputedStyle(today.closest('td')!);
      const otherCell = getComputedStyle(other.closest('td')!);
      expect(todayCell.borderTopColor, appearance).toBe(otherCell.borderTopColor);
      expect(parseFloat(todayCell.borderTopWidth), appearance).toBeGreaterThan(0);
      expect(getComputedStyle(today).borderTopColor, appearance).toBe(getComputedStyle(other).borderTopColor);
      const mark = today.querySelector<HTMLElement>('[class*="dateMark"]');
      if (!mark) throw new Error(`${appearance}: today has no number mark`);
      const markBox = mark.getBoundingClientRect();
      const number = dayNumberBox(today);
      const cellBox = today.getBoundingClientRect();
      expect(mark.textContent?.trim(), appearance).toBe('18');
      expect(markBox.width, appearance).toBeGreaterThan(number.width);
      expect(markBox.height, appearance).toBeGreaterThan(number.height);
      expect(markBox.width, appearance).toBeLessThan(cellBox.width / 2);
      expect(markBox.left, appearance).toBeLessThanOrEqual(number.left + 1);
      expect(markBox.right, appearance).toBeGreaterThanOrEqual(number.right - 1);
      expect(markBox.top, appearance).toBeLessThanOrEqual(number.top + 1);
      expect(markBox.bottom, appearance).toBeGreaterThanOrEqual(number.bottom - 1);
      const radius = parseFloat(getComputedStyle(mark).borderTopLeftRadius);
      expect(radius, appearance).toBeGreaterThanOrEqual(markBox.width / 2 - 1);
      expect(contrastRatio(getComputedStyle(mark).backgroundColor, todayCell.backgroundColor), appearance).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(getComputedStyle(mark).color, getComputedStyle(mark).backgroundColor), appearance).toBeGreaterThanOrEqual(4.5);
      expect(getComputedStyle(today).outlineStyle, appearance).toBe('none');
      today.focus({ focusVisible: true } as FocusOptions);
      const focus = getComputedStyle(today);
      expect(focus.outlineStyle, appearance).not.toBe('none');
      expect(today.getBoundingClientRect().width, appearance).toBeGreaterThan(markBox.width * 2);
      expect(mark.getBoundingClientRect().width, appearance).toBeLessThan(cellBox.width / 2);
      view.unmount();
    }
    } finally {
      clock.mockRestore();
    }
  });

  it('runs a multi-day bar across the grid line without a gap', async () => {
    for (const appearance of ['light', 'dark'] as const) {
      for (const width of [1280, 1024, 375]) {
        await page.viewport(width, 900);
        window.localStorage.setItem(APPEARANCE_KEY, appearance);
        const view = render(
          <Providers>
            <main>
              <EventCalendarExample locale="en-US" />
            </main>
          </Providers>,
        );
        await userEvent.click(screen.getByRole('button', { name: 'Month' }));
        await settle();
        const label = `${appearance} ${width}`;
        const pairs = [
          ['Friday, November 20, 2026', 'Saturday, November 21, 2026'],
          ['Monday, November 16, 2026', 'Tuesday, November 17, 2026'],
          ['Wednesday, November 18, 2026', 'Thursday, November 19, 2026'],
        ];
        for (const [leftName, rightName] of pairs) {
          const leftDay = screen.getByRole('button', { name: leftName });
          const rightDay = screen.getByRole('button', { name: rightName });
          const leftBar = [...leftDay.querySelectorAll<HTMLElement>('[data-bar]')].find((bar) => bar.hasAttribute('data-join-end'));
          const rightBar = [...rightDay.querySelectorAll<HTMLElement>('[data-bar]')].find(
            (bar) => bar.hasAttribute('data-join-start') && bar.getAttribute('data-bar') === leftBar?.getAttribute('data-bar'),
          );
          if (!leftBar || !rightBar) throw new Error(`${label}: ${leftName} does not continue`);
          const leftBox = leftBar.getBoundingClientRect();
          const rightBox = rightBar.getBoundingClientRect();
          const name = `${label} ${leftBar.getAttribute('data-bar')}`;
          expect(rightBox.left, name).toBeLessThanOrEqual(leftBox.right + 0.5);
          expect(Math.abs(leftBox.top - rightBox.top), name).toBeLessThan(1);
          expect(Math.abs(leftBox.bottom - rightBox.bottom), name).toBeLessThan(1);
          const leftCell = leftDay.closest('td')!.getBoundingClientRect();
          const rightCell = rightDay.closest('td')!.getBoundingClientRect();
          const boundary = (leftCell.right + rightCell.left) / 2;
          expect(leftBox.right, name).toBeGreaterThan(boundary);
          expect(rightBox.left, name).toBeLessThan(boundary);
          const hit = document.elementFromPoint(boundary, (leftBox.top + leftBox.bottom) / 2);
          expect(hit?.closest('[data-bar]')?.getAttribute('data-bar'), name).toBe(leftBar.getAttribute('data-bar'));
        }
        const grid = screen.getByRole('grid').getBoundingClientRect();
        for (const bar of document.querySelectorAll<HTMLElement>('[data-bar]')) {
          const box = bar.getBoundingClientRect();
          if (box.width < 1) continue;
          expect(box.left, `${label} grid`).toBeGreaterThanOrEqual(grid.left - 0.5);
          expect(box.right, `${label} grid`).toBeLessThanOrEqual(grid.right + 0.5);
        }
        view.unmount();
      }
    }
    await page.viewport(1280, 800);
  });

  it('hides the end cue below 30rem and shows it when the month is wider', async () => {
    const view = render(
      <Providers>
        <main>
          <EventCalendarExample locale="en-US" />
        </main>
      </Providers>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Month' }));
    const saturday = () => screen.getByRole('button', { name: 'Saturday, November 21, 2026' });
    const cue = () => saturday().querySelector<HTMLElement>('[class*="cueEnd"]');
    await page.viewport(375, 800);
    await settle();
    const narrow = cue();
    if (!narrow) throw new Error('Saturday is missing its end cue');
    const narrowBox = narrow.getBoundingClientRect();
    expect(Math.max(narrowBox.width, narrowBox.height)).toBeLessThanOrEqual(1);
    await page.viewport(1280, 800);
    await settle();
    const wide = cue();
    if (!wide) throw new Error('Saturday is missing its end cue');
    expect(wide.getBoundingClientRect().width).toBeGreaterThan(1);
    expect(wide.textContent).toContain('…');
    view.unmount();
    await page.viewport(1280, 800);
  });

  it('keeps today\'s bars below the date mark and level with the rest of the week', async () => {
    const clock = vi.spyOn(Temporal.Now, 'plainDateISO').mockReturnValue(Temporal.PlainDate.from('2026-11-18'));
    try {
      const view = render(
        <Providers>
          <main>
            <EventCalendarExample locale="en-US" />
          </main>
        </Providers>,
      );
      await userEvent.click(screen.getByRole('button', { name: 'Month' }));
      await settle();
      for (const width of [1280, 375]) {
        await page.viewport(width, 900);
        await settle();
        const today = screen.getByRole('button', { name: 'Wednesday, November 18, 2026' });
        const mark = today.querySelector<HTMLElement>('[class*="dateMark"]');
        const bar = today.querySelector<HTMLElement>('[data-bar="launch"]');
        if (!mark || !bar) throw new Error(`${width}: today is missing its mark or Launch watch`);
        const markBox = mark.getBoundingClientRect();
        const barBox = bar.getBoundingClientRect();
        const cellBox = today.getBoundingClientRect();
        expect(markBox.width, `${width} mark`).toBeLessThan(cellBox.width / 2);
        expect(markBox.right, `${width} mark`).toBeLessThanOrEqual(cellBox.right);
        expect(barBox.top, `${width} below mark`).toBeGreaterThanOrEqual(markBox.bottom - 0.5);
        const hit = document.elementFromPoint((barBox.left + barBox.right) / 2, (barBox.top + barBox.bottom) / 2);
        expect(hit?.closest('[data-bar]')?.getAttribute('data-bar'), `${width} hit`).toBe('launch');
        const row = today.closest('tr');
        if (!row) throw new Error('today is not in a week');
        const tracks = [...row.querySelectorAll<HTMLElement>('[class*="barRows"]')].map((track) => track.getBoundingClientRect().top);
        expect(tracks.length, `${width} tracks`).toBeGreaterThan(2);
        for (const top of tracks) expect(Math.abs(top - tracks[0]!), `${width} track`).toBeLessThan(1);
        const topBars = [...row.querySelectorAll<HTMLElement>('[data-bar]')].filter((item) => {
          const box = item.getBoundingClientRect();
          return box.height > 1 && Math.abs(box.top - barBox.top) < 1;
        });
        const days = new Set(topBars.map((item) => item.closest('[data-todae-calendar-cell]')?.getAttribute('aria-label')));
        expect(days.has('Monday, November 16, 2026'), `${width} row`).toBe(true);
        expect(days.has('Wednesday, November 18, 2026'), `${width} row`).toBe(true);
        expect(days.has('Friday, November 20, 2026'), `${width} row`).toBe(true);
      }
      view.unmount();
    } finally {
      clock.mockRestore();
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

const dayText = (iso: string, locale: string) => formatDate(Temporal.PlainDate.from(iso), { locale });

async function newEventDialog() {
  const dialog = await screen.findByRole('dialog', { name: 'New event' });
  const title = within(dialog).getByRole('textbox', { name: 'Title' });
  await expect.poll(() => document.activeElement).toBe(title);
  expect(title).toHaveValue('');
  return dialog;
}

describe('creating an event from empty lane space', () => {
  it('shows a preview that tracks a downward drag and an upward drag', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    const down = dragLane('Wed, Nov 18', 240, 330);
    await expect.poll(() => down.lane.querySelector('[data-create]')).toBeTruthy();
    const preview = expectCreatePreview(down.lane, 240, 330);
    const review = screen.getByRole('button', { name: `Design review, ${clock('09:00')} to ${clock('10:30')}` }).closest('li');
    expect(review).toBeTruthy();
    expect(Math.abs(preview.getBoundingClientRect().height - review!.getBoundingClientRect().height)).toBeLessThan(2);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    down.escape();
    await expect.poll(() => down.lane.querySelector('[data-create]')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();

    const up = dragLane('Wed, Nov 18', 240, 140);
    await expect.poll(() => up.lane.querySelector('[data-create]')).toBeTruthy();
    expectCreatePreview(up.lane, 135, 255);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    up.escape();
    await expect.poll(() => screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the editor on release and adds the event when it is saved', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    const gesture = dragLane('Wed, Nov 18', 240, 330);
    await expect.poll(() => gesture.lane.querySelector('[data-create]')).toBeTruthy();
    gesture.drop();
    const dialog = await newEventDialog();
    expectCreatePreview(gesture.lane, 240, 330);
    expect(document.querySelectorAll('[data-create]')).toHaveLength(1);
    expect(within(dialog).getByRole('textbox', { name: 'Date' })).toHaveValue(dayText('2026-11-18', 'en-US'));
    expect(within(dialog).getByRole('textbox', { name: 'Start' })).toHaveValue(clock('12:00'));
    expect(within(dialog).getByRole('textbox', { name: 'End' })).toHaveValue(clock('13:30'));
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Title' }), 'Lunch');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await expect.poll(() => screen.queryByRole('dialog')).toBeNull();
    const saved = screen.getByRole('button', { name: `Lunch, ${clock('12:00')} to ${clock('13:30')}` });
    expect(gesture.lane.contains(saved)).toBe(true);
    expect(gesture.lane.querySelector('[data-create]')).toBeNull();
    await expect.poll(() => document.activeElement).toBe(saved);
    await expect.poll(() => document.querySelector('[data-todae-announcer] [aria-live="polite"]')?.textContent).toBe(`Added Lunch, ${clock('12:00')} to ${clock('13:30')}`);
  });

  it('opens the editor for one slot when empty space is clicked', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    const lane = clickLane('Wed, Nov 18', 248);
    const dialog = await newEventDialog();
    expectCreatePreview(lane, 240, 255);
    expect(within(dialog).getByRole('textbox', { name: 'Start' })).toHaveValue(clock('12:00'));
    expect(within(dialog).getByRole('textbox', { name: 'End' })).toHaveValue(clock('12:15'));
    expect(within(dialog).getByRole('textbox', { name: 'Date' })).toHaveValue(dayText('2026-11-18', 'en-US'));
  });

  it('adds nothing and returns focus to the day heading when the editor is cancelled', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    const lane = clickLane('Wed, Nov 18', 248);
    await newEventDialog();
    expect(lane.querySelector('[data-create]')).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    await expect.poll(() => screen.queryByRole('dialog')).toBeNull();
    expect(lane.querySelector('[data-create]')).toBeNull();
    expect(screen.queryByRole('button', { name: /Lunch/ })).toBeNull();
    await expect.poll(() => document.activeElement).toBe(screen.getByRole('heading', { name: 'Wed, Nov 18' }));
    expect(document.activeElement).not.toBe(document.body);
  });

  it('cancels a create drag on Escape and opens no editor', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    const gesture = dragLane('Wed, Nov 18', 240, 330);
    await expect.poll(() => gesture.lane.querySelector('[data-create]')).toBeTruthy();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    gesture.escape();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(gesture.lane.querySelector('[data-create]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'New event' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Lunch/ })).toBeNull();
  });

  it('moves an event from a press on it, and a press on that control does not create', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    const review = screen.getByRole('button', { name: `Design review, ${clock('09:00')} to ${clock('10:30')}` });
    dragBlock(review, atUnits('Mon, Nov 16', 120)).drop();
    await expect.poll(() => screen.getByRole('button', { name: /^Design review,/ }).getAttribute('aria-label')).toBe(`Design review, ${clock('10:00')} to ${clock('11:30')}`);
    expect(screen.queryByRole('dialog')).toBeNull();
    const button = screen.getByRole('button', { name: `Design review, ${clock('10:00')} to ${clock('11:30')}` });
    const box = button.getBoundingClientRect();
    pointer('pointerdown', button, box.left + box.width / 2, box.top + box.height / 2);
    pointer('pointerup', button, box.left + box.width / 2, box.top + box.height / 2);
    expect(screen.queryByRole('dialog', { name: 'New event' })).toBeNull();
    const handle = button.closest('li')?.querySelector<HTMLElement>('[data-edge="end"]');
    if (!handle) throw new Error('missing resize handle');
    const edge = handle.getBoundingClientRect();
    pointer('pointerdown', handle, edge.left + edge.width / 2, edge.top + edge.height / 2);
    pointer('pointerup', handle, edge.left + edge.width / 2, edge.top + edge.height / 2);
    expect(screen.queryByRole('dialog', { name: 'New event' })).toBeNull();
  });

  it('opens the same editor from New event at the focused day and time', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    expect(screen.getAllByRole('button', { name: 'New event' })).toHaveLength(1);
    const review = screen.getByRole('button', { name: `Design review, ${clock('09:00')} to ${clock('10:30')}` });
    review.focus();
    const create = screen.getByRole('button', { name: 'New event' });
    create.focus();
    await userEvent.keyboard('{Enter}');
    const dialog = await newEventDialog();
    expect(within(dialog).getByRole('textbox', { name: 'Date' })).toHaveValue(dayText('2026-11-16', 'en-US'));
    expect(within(dialog).getByRole('textbox', { name: 'Start' })).toHaveValue(clock('10:30'));
    expect(within(dialog).getByRole('textbox', { name: 'End' })).toHaveValue(clock('10:45'));
  });

  it('starts a new event at the close when the focused event runs into it', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    const ship = screen.getByRole('button', { name: `Ship review, ${clock('15:00')} to ${clock('18:30')}, continues` });
    ship.focus();
    screen.getByRole('button', { name: 'New event' }).focus();
    await userEvent.keyboard('{Enter}');
    const dialog = await newEventDialog();
    expect(within(dialog).getByRole('textbox', { name: 'Date' })).toHaveValue(dayText('2026-11-19', 'en-US'));
    expect(within(dialog).getByRole('textbox', { name: 'Start' })).toHaveValue(clock('17:45'));
    expect(within(dialog).getByRole('textbox', { name: 'End' })).toHaveValue(clock('18:00'));
  });

  it('starts at the first slot after a day heading takes focus', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    screen.getByRole('button', { name: `Design review, ${clock('09:00')} to ${clock('10:30')}` }).focus();
    screen.getByRole('heading', { name: 'Wed, Nov 18' }).focus();
    screen.getByRole('button', { name: 'New event' }).focus();
    await userEvent.keyboard('{Enter}');
    const dialog = await newEventDialog();
    expect(within(dialog).getByRole('textbox', { name: 'Date' })).toHaveValue(dayText('2026-11-18', 'en-US'));
    expect(within(dialog).getByRole('textbox', { name: 'Start' })).toHaveValue(clock('08:00'));
    expect(within(dialog).getByRole('textbox', { name: 'End' })).toHaveValue(clock('08:15'));
  });

  it('returns focus to the event when an edit is cancelled', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    clickLane('Sun, Nov 15', 120);
    await newEventDialog();
    await userEvent.keyboard('{Escape}');
    await expect.poll(() => document.activeElement).toBe(screen.getByRole('heading', { name: 'Sun, Nov 15' }));
    const review = screen.getByRole('button', { name: `Design review, ${clock('09:00')} to ${clock('10:30')}` });
    review.focus();
    await userEvent.keyboard('{Enter}');
    const menu = await openMenu();
    const items = within(menu).getAllByRole('menuitem');
    const target = items.findIndex((item) => item.textContent === 'Edit…');
    await userEvent.keyboard('{ArrowDown}'.repeat(target));
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('dialog', { name: 'Edit Design review' });
    await userEvent.keyboard('{Escape}');
    await expect.poll(() => screen.queryByRole('dialog')).toBeNull();
    await expect.poll(() => document.activeElement).toBe(review);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('announces a created event as added, in English and in Korean', async () => {
    for (const locale of ['en-US', 'ko'] as const) {
      const view = render(
        <Providers>
          <EventCalendarExample locale={locale} />
        </Providers>,
      );
      const heading = locale === 'ko' ? screen.getAllByRole('heading', { level: 3 }).find((item) => item.id.endsWith('2026-11-18')) : screen.getByRole('heading', { name: 'Wed, Nov 18' });
      if (!heading?.textContent) throw new Error('missing Wednesday');
      const gesture = dragLane(heading.textContent, 120, 195);
      await expect.poll(() => gesture.lane.querySelector('[data-create]')).toBeTruthy();
      gesture.drop();
      const dialog = await newEventDialog();
      await userEvent.type(within(dialog).getByRole('textbox', { name: 'Title' }), 'Probe');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
      const start = formatTime(Temporal.PlainTime.from('10:00'), { locale });
      const end = formatTime(Temporal.PlainTime.from('11:15'), { locale });
      if (locale === 'ko') expect(start).toContain('오전');
      await expect.poll(() => document.querySelector('[data-todae-announcer] [aria-live="polite"]')?.textContent).toBe(`Added Probe, ${start} to ${end}`);
      expect(screen.getByRole('button', { name: `Probe, ${start} to ${end}` })).toBeTruthy();
      view.unmount();
      cleanup();
    }
  });

  it('creates from empty space in the day view', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Day' }));
    const lane = clickLane('Mon, Nov 16', 188);
    const dialog = await newEventDialog();
    expectCreatePreview(lane, 180, 195);
    expect(within(dialog).getByRole('textbox', { name: 'Start' })).toHaveValue(clock('11:00'));
    expect(within(dialog).getByRole('textbox', { name: 'End' })).toHaveValue(clock('11:15'));
  });

  it('does not create from the month', async () => {
    render(
      <Providers>
        <EventCalendarExample locale="en-US" />
      </Providers>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Month' }));
    expect(screen.queryByRole('button', { name: 'New event' })).toBeNull();
    expect(document.querySelector('[data-create]')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Thursday, November 19, 2026' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(planning());
  });

  it('creates from a touch on a narrow day, in Korean, in light and in dark', async () => {
    const errors: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args.map((item) => (typeof item === 'string' ? item : String(item))).join(' '));
      original.apply(console, args);
    };
    try {
      for (const appearance of ['dark', 'light'] as const) {
        window.localStorage.setItem(APPEARANCE_KEY, appearance);
        await page.viewport(appearance === 'dark' ? 375 : 1280, 800);
        const view = render(
          <Providers>
            <EventCalendarExample locale="ko" />
          </Providers>,
        );
        await settle();
        expect(document.documentElement.getAttribute('data-appearance')).toBe(appearance);
        await userEvent.click(screen.getByRole('button', { name: 'Day' }));
        const heading = screen.getAllByRole('heading', { level: 3 })[0];
        if (!heading?.textContent) throw new Error('missing day heading');
        const lane = clickLane(heading.textContent, 368, SCALE, 'touch');
        const dialog = await newEventDialog();
        const start = formatTime(Temporal.PlainTime.from('14:00'), { locale: 'ko' });
        const end = formatTime(Temporal.PlainTime.from('14:15'), { locale: 'ko' });
        expect(start).toContain('오후');
        expect(end).toContain('오후');
        expect(within(dialog).getByRole('textbox', { name: 'Start' })).toHaveValue(start);
        expect(within(dialog).getByRole('textbox', { name: 'End' })).toHaveValue(end);
        expect(within(dialog).getByRole('textbox', { name: 'Date' })).toHaveValue(dayText('2026-11-16', 'ko'));
        expectCreatePreview(lane, 360, 375);
        if (appearance === 'light') {
          await userEvent.keyboard('{Escape}');
          await expect.poll(() => screen.queryByRole('dialog')).toBeNull();
          await userEvent.click(screen.getByRole('button', { name: 'Week' }));
          const lane = document.querySelector<HTMLElement>('[data-todae-lane="2026-11-18"]');
          if (!lane) throw new Error('missing Wednesday lane');
          const week = dragLane(lane, 240, 330);
          await expect.poll(() => week.lane.querySelector('[data-create]')).toBeTruthy();
          expectCreatePreview(week.lane, 240, 330);
          await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
          });
          week.escape();
        }
        view.unmount();
        cleanup();
      }
      expect(errors).toEqual([]);
    } finally {
      console.error = original;
      window.localStorage.removeItem(APPEARANCE_KEY);
      document.documentElement.removeAttribute('data-appearance');
      await page.viewport(1280, 800);
    }
  });

  it('creates from a real finger on empty space at 375, and a sideways swipe still scrolls', async () => {
    await page.viewport(375, 800);
    try {
      render(
        <Providers>
          <EventCalendarExample locale="en-US" />
        </Providers>,
      );
      const sunday = dayLane('Sun, Nov 15');
      const review = screen.getByRole('button', { name: `Design review, ${clock('09:00')} to ${clock('10:30')}` });
      const edge = review.closest('li')?.querySelector<HTMLElement>('[data-edge="end"]');
      if (!edge) throw new Error('missing resize handle');
      expect(getComputedStyle(sunday).touchAction).toBe('pan-x');
      expect(getComputedStyle(review).touchAction).toBe('none');
      expect(getComputedStyle(edge).touchAction).toBe('none');
      if (!/Chrome/.test(navigator.userAgent)) return;

      const scroller = screen.getByRole('region', { name: 'Calendar' });
      const start = atUnits('Sun, Nov 15', 180);
      const before = scroller.scrollLeft;
      await fingerDrag(start, { x: start.x - 140, y: start.y });
      await expect.poll(() => scroller.scrollLeft).toBeGreaterThan(before + 20);
      expect(screen.queryByRole('dialog', { name: 'New event' })).toBeNull();

      await userEvent.click(screen.getByRole('button', { name: 'Day' }));
      await userEvent.click(screen.getByRole('button', { name: 'Next day' }));
      await userEvent.click(screen.getByRole('button', { name: 'Next day' }));
      const from = atUnits('Wed, Nov 18', 120);
      const to = atUnits('Wed, Nov 18', 210);
      await fingerDrag(from, to);
      const dialog = await newEventDialog();
      expect(within(dialog).getByRole('textbox', { name: 'Date' })).toHaveValue(dayText('2026-11-18', 'en-US'));
      expect(within(dialog).getByRole('textbox', { name: 'Start' })).toHaveValue(clock('10:00'));
      expect(within(dialog).getByRole('textbox', { name: 'End' })).toHaveValue(clock('11:30'));
      expectCreatePreview(dayLane('Wed, Nov 18'), 120, 210);
      expect(document.querySelectorAll('[data-create]')).toHaveLength(1);
    } finally {
      await page.viewport(1280, 800);
    }
  });

  it('hides the second zone column at 375px and keeps the primary label', async () => {
    await page.viewport(800, 900);
    render(
      <Providers>
        <EventCalendarExample locale="en-US" timeZone="America/Los_Angeles" compareZone="Asia/Kolkata" events={[]} />
      </Providers>,
    );
    const columns = () =>
      [...document.querySelectorAll<HTMLElement>('[aria-hidden="true"]')].filter((el) => [...el.children].some((child) => (child as HTMLElement).style?.top));
    await expect.poll(() => columns().length).toBeGreaterThan(1);
    expect(screen.getByText('PST')).toBeTruthy();
    expect(screen.getByText('GMT+5:30')).toBeTruthy();

    await page.viewport(375, 800);
    await expect.poll(() => columns().length).toBe(1);
    expect(screen.getByText('PST')).toBeTruthy();
    expect(screen.queryByText('GMT+5:30')).toBeNull();
    const described = document.getElementById(document.querySelector('[aria-label="Calendar"]')?.getAttribute('aria-describedby') ?? '')?.textContent ?? '';
    expect(described).toContain('PST');
    expect(described).not.toContain('Second column');
    const calendar = document.querySelector<HTMLElement>('[class*="calendar"]');
    expect(calendar).toBeTruthy();
    expect(calendar!.scrollWidth).toBeLessThanOrEqual(calendar!.clientWidth + 1);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth + 1);
    await page.viewport(1280, 800);
  });

  it('creates and places events in a zone that is not the viewer’s', async () => {
    const start = Temporal.Instant.from('2026-11-16T00:00:00Z');
    const end = Temporal.Instant.from('2026-11-16T01:00:00Z');
    render(
      <Providers>
        <EventCalendarExample
          locale="en-US"
          timeZone="Asia/Tokyo"
          anchor={Temporal.PlainDate.from('2026-11-16')}
          events={[{ id: 'call', title: 'Call', start, end, allDay: false }]}
        />
      </Providers>,
    );
    expect(screen.getByText('GMT+9')).toBeTruthy();
    const call = screen.getByRole('button', { name: `Call, ${clock('09:00')} to ${clock('10:00')}` });
    expect(call.parentElement?.style.top).toBe('10%');

    screen.getByRole('heading', { name: 'Mon, Nov 16' }).focus();
    screen.getByRole('button', { name: 'New event' }).focus();
    await userEvent.keyboard('{Enter}');
    const keyed = await newEventDialog();
    expect(within(keyed).getByRole('textbox', { name: 'Start' })).toHaveValue(clock('08:00'));
    expect(within(keyed).getByRole('textbox', { name: 'End' })).toHaveValue(clock('08:15'));
    await userEvent.type(within(keyed).getByRole('textbox', { name: 'Title' }), 'Breakfast');
    await userEvent.click(within(keyed).getByRole('button', { name: 'Save' }));
    const breakfast = await screen.findByRole('button', { name: `Breakfast, ${clock('08:00')} to ${clock('08:15')}` });
    expect(breakfast.parentElement?.style.top).toBe('0%');
    await expect.poll(() => document.querySelector('[data-todae-announcer] [aria-live="polite"]')?.textContent).toBe(`Added Breakfast, ${clock('08:00')} to ${clock('08:15')}`);

    dragLane('Mon, Nov 16', 60, 120).drop();
    const dragged = await newEventDialog();
    expect(within(dragged).getByRole('textbox', { name: 'Start' })).toHaveValue(clock('09:00'));
    expect(within(dragged).getByRole('textbox', { name: 'End' })).toHaveValue(clock('10:00'));
    await userEvent.type(within(dragged).getByRole('textbox', { name: 'Title' }), 'Standup');
    await userEvent.click(within(dragged).getByRole('button', { name: 'Save' }));
    const standup = await screen.findByRole('button', { name: `Standup, ${clock('09:00')} to ${clock('10:00')}` });
    expect(standup.parentElement?.style.top).toBe(call.parentElement?.style.top);
  });

  it('lines an all-day bar up with its day when a second hour column is showing', async () => {
    await page.viewport(1280, 900);
    render(
      <Providers>
        <EventCalendarExample
          locale="en-US"
          timeZone="America/Los_Angeles"
          compareZone="Asia/Kolkata"
          anchor={Temporal.PlainDate.from('2026-11-16')}
          events={[
            {
              id: 'offsite',
              title: 'Offsite',
              start: Temporal.ZonedDateTime.from('2026-11-16T00:00:00-08:00[America/Los_Angeles]'),
              end: Temporal.ZonedDateTime.from('2026-11-17T00:00:00-08:00[America/Los_Angeles]'),
              allDay: true,
            },
          ]}
        />
      </Providers>,
    );
    const bar = screen.getByRole('button', { name: /Offsite/ });
    const heading = screen.getByRole('heading', { name: 'Mon, Nov 16' });
    const barBox = bar.getBoundingClientRect();
    const headBox = heading.getBoundingClientRect();
    expect(barBox.width).toBeGreaterThan(0);
    expect(headBox.width).toBeGreaterThan(0);
    expect(Math.abs(barBox.left - headBox.left)).toBeLessThan(32);
    expect(Math.abs(barBox.right - headBox.right)).toBeLessThan(32);
  });
});
