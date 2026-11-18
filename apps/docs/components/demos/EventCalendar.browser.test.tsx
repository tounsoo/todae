import { cleanup, render, screen } from '@testing-library/react';
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
