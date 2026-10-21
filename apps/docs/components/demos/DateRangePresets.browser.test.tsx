import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { afterEach, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { Providers } from '../Providers';
import { DateRangePresets } from './DateRangePresetsDemo';

afterEach(cleanup);

const sent = () => document.querySelector<HTMLInputElement>('[data-todae-value-input]')!.value;
const pressed = () => screen.queryAllByRole('button', { pressed: true }).map((button) => button.textContent);

const monthName = (month: Temporal.PlainYearMonth) =>
  month.toPlainDate({ day: 1 }).toLocaleString('en', { month: 'long', year: 'numeric', calendar: 'gregory' });

// Moves the open calendar to the date's month, then picks the date.
async function pick(date: Temporal.PlainDate) {
  const heading = document.querySelector('[role="dialog"] button[aria-expanded]')!.textContent;
  const target = date.toPlainYearMonth();
  const away = [-2, -1, 0, 1, 2].find((months) => monthName(target.add({ months })) === heading)!;
  const button = screen.getByRole('button', { name: away > 0 ? 'Previous month' : 'Next month' });
  for (let step = 0; step < Math.abs(away); step++) await userEvent.click(button);
  await userEvent.click(screen.getByRole('button', { name: date.toLocaleString('en', { dateStyle: 'full', calendar: 'gregory' }) }));
}

it('sets the range from a preset, and presses the preset that matches the range, if any', async () => {
  render(
    <Providers>
      <DateRangePresets />
    </Providers>,
  );
  const today = Temporal.Now.plainDateISO();
  expect(pressed()).toEqual([]);
  const last30 = screen.getByRole('button', { name: 'Last 30 days' });
  await userEvent.click(last30);
  expect(sent()).toBe(`${today.subtract({ days: 29 })}/${today}`);
  expect(pressed()).toEqual(['Last 30 days']);
  // Pressing the pressed preset again keeps its range.
  await userEvent.click(last30);
  expect(sent()).toBe(`${today.subtract({ days: 29 })}/${today}`);
  expect(pressed()).toEqual(['Last 30 days']);

  // A range no preset gives presses none; it never ends today.
  const yesterday = today.subtract({ days: 1 });
  await userEvent.click(screen.getByRole('button', { name: 'Report dates' }));
  await pick(yesterday.subtract({ days: 2 }));
  await pick(yesterday);
  await expect.poll(() => screen.queryByRole('dialog')).toBeNull();
  expect(sent()).toBe(`${yesterday.subtract({ days: 2 })}/${yesterday}`);
  expect(pressed()).toEqual([]);

  // A range picked in the calendar that a preset gives presses that preset.
  await userEvent.click(screen.getByRole('button', { name: 'Report dates' }));
  await pick(today.subtract({ days: 6 }));
  await pick(today);
  await expect.poll(() => screen.queryByRole('dialog')).toBeNull();
  expect(pressed()).toEqual(['Last 7 days']);
});
