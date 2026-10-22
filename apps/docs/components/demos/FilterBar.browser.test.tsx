import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { afterEach, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { Providers } from '../Providers';
import { FilterBarIssues } from './FilterBarDemo';

afterEach(() => {
  cleanup();
  for (const node of document.querySelectorAll('[data-todae-announcer]')) node.remove();
});

const status = () => screen.getByRole('button', { name: /^Status/ });
const chips = () => screen.queryByRole('list', { name: 'Active filters' });
const rows = () => within(screen.getByRole('table', { name: 'Issues' })).getAllByRole('row').slice(1);
const announced = () =>
  [...document.querySelectorAll('[data-todae-announcer] [aria-live="polite"]')].map((node) => node.textContent).join('');

function setup() {
  render(
    <Providers>
      <FilterBarIssues />
    </Providers>,
  );
}

it('keeps a filter menu open while values are checked and names the count on its button', async () => {
  setup();
  status().focus();
  await userEvent.keyboard('{ArrowDown}');
  const menu = screen.getByRole('menu', { name: 'Status' });
  expect(document.activeElement).toBe(within(menu).getByRole('menuitemcheckbox', { name: 'Open' }));
  await userEvent.keyboard('{Enter}{ArrowDown}{Enter}');
  expect(within(menu).getByRole('menuitemcheckbox', { name: 'In progress' })).toHaveAttribute('aria-checked', 'true');
  expect(menu).toBeVisible();
  expect(status()).toHaveAccessibleName('Status 2 selected');
  expect(within(chips()!).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
    'Status: Open',
    'Status: In progress',
  ]);
  expect(rows()).toHaveLength(6);

  await userEvent.keyboard('{Escape}');
  expect(menu).not.toBeVisible();
  expect(document.activeElement).toBe(status());
  // The count is said once, after the checks settle.
  await expect.poll(() => announced(), { timeout: 2000 }).toBe('6 issues shown');
});

it('hands focus to the first filter button when the last chip is removed', async () => {
  setup();
  await userEvent.click(status());
  await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Closed' }));
  await userEvent.keyboard('{Escape}');
  await userEvent.click(within(chips()!).getByRole('button', { name: 'Remove Status: Closed' }));
  expect(chips()).toBeNull();
  await expect.poll(() => document.activeElement).toBe(status());
  expect(rows()).toHaveLength(8);
});

it('hands focus to the first filter button after Clear all and after Clear filters', async () => {
  setup();
  await userEvent.click(status());
  await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Closed' }));
  await userEvent.keyboard('{Escape}');
  await userEvent.click(screen.getByRole('button', { name: /^Priority/ }));
  await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'High' }));
  await userEvent.keyboard('{Escape}');
  // No closed issue is high priority.
  expect(screen.getByRole('heading', { name: 'No issues match these filters' })).toBeVisible();

  await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  await expect.poll(() => document.activeElement).toBe(status());
  expect(rows()).toHaveLength(8);

  await userEvent.click(status());
  await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Open' }));
  await userEvent.keyboard('{Escape}');
  await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
  expect(chips()).toBeNull();
  await expect.poll(() => document.activeElement).toBe(status());
});
