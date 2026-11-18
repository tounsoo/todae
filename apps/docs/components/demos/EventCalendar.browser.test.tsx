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
    expect(getComputedStyle(detail).position).toBe('absolute');
    const described = document.getElementById(day.getAttribute('aria-describedby') ?? '');
    expect(described && spoken(described)).toBe('Offsite, Design review, +2 more');

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
  const body = headings[0]?.parentElement?.nextElementSibling;
  const column = body?.children[index + 1];
  if (!(column instanceof HTMLElement)) throw new Error(`no lane for ${name}`);
  return column;
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
    const menu = await screen.findByRole('menu');
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
    const menu = await screen.findByRole('menu');
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
