import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { afterEach, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { Providers } from '../Providers';
import { FilterBarIssues } from './FilterBarDemo';

afterEach(() => {
  cleanup();
  // Drop writes still pending, so none lands in a later test.
  const pending = (globalThis as unknown as Record<symbol, Record<string, ReturnType<typeof setTimeout>> | undefined>)[
    Symbol.for('todae.announcer.pending')
  ];
  for (const [key, id] of Object.entries(pending ?? {})) {
    clearTimeout(id);
    delete pending![key];
  }
  for (const node of document.querySelectorAll('[data-todae-announcer]')) node.remove();
});

const status = () => screen.getByRole('button', { name: /^Status/ });
const chips = () => screen.queryByRole('list', { name: 'Active filters' });
const rows = () => within(screen.getByRole('table', { name: 'Issues' })).getAllByRole('row').slice(1);
const liveRegions = () => [...document.querySelectorAll('[data-todae-announcer] [aria-live]')];

// Every non-empty text the announcer writes from now on, in order.
function recordAnnouncements() {
  const said: string[] = [];
  const last = new Map(liveRegions().map((node) => [node, node.textContent ?? '']));
  const observer = new MutationObserver(() => {
    for (const node of liveRegions()) {
      const text = node.textContent ?? '';
      if (text && last.get(node) !== text) said.push(text);
      last.set(node, text);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  return said;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function setup() {
  render(
    <Providers>
      <FilterBarIssues />
    </Providers>,
  );
}

it('keeps a filter menu open while values are checked and names the count on its button', async () => {
  setup();
  const said = recordAnnouncements();
  status().focus();
  await userEvent.keyboard('{ArrowDown}');
  const menu = screen.getByRole('menu', { name: 'Status' });
  expect(document.activeElement).toBe(within(menu).getByRole('menuitemcheckbox', { name: 'Open' }));
  // A pause between checks, as a screen reader reading each item makes, says nothing while the menu is open.
  await userEvent.keyboard('{Enter}');
  await wait(800);
  await userEvent.keyboard('{ArrowDown}{Enter}');
  await wait(800);
  expect(said).toEqual([]);
  expect(within(menu).getByRole('menuitemcheckbox', { name: 'In progress' })).toHaveAttribute('aria-checked', 'true');
  expect(menu).toBeVisible();
  expect(status()).toHaveAccessibleName('Status 2 selected');
  expect(within(chips()!).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
    'Status: Open',
    'Status: In progress',
  ]);
  expect(rows()).toHaveLength(6);

  await userEvent.keyboard('{Escape}');
  await expect.poll(() => menu.matches(':popover-open')).toBe(false);
  expect(document.activeElement).toBe(status());
  // The count is said once the menu closes.
  await expect.poll(() => said, { timeout: 2000 }).toEqual(['6 issues shown']);
});

it('removes a chip from the keyboard and says the new count once', async () => {
  setup();
  await userEvent.click(status());
  await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Open' }));
  await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Closed' }));
  await userEvent.keyboard('{Escape}');
  await wait(800);
  const said = recordAnnouncements();
  within(chips()!).getByRole('button', { name: 'Remove Status: Open' }).focus();
  await userEvent.keyboard('{Enter}');
  // Focus stays in the row, on the chip that took the removed one's place.
  await expect.poll(() => document.activeElement).toBe(within(chips()!).getByRole('button', { name: 'Remove Status: Closed' }));
  expect(rows()).toHaveLength(2);
  await expect.poll(() => said, { timeout: 2000 }).toEqual(['2 issues shown']);
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
  const said = recordAnnouncements();
  await expect.poll(() => said, { timeout: 2000 }).toEqual(['No issues match these filters']);

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
