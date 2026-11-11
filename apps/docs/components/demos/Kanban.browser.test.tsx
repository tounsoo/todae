import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from 'vitest/browser';
import { afterEach, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { Providers } from '../Providers';
import KanbanExample from '../../examples/recipes/kanban/KanbanExample';

afterEach(cleanup);

// The cards in a column, by the names of their menu buttons.
const cards = (column: string) => {
  const list = within(screen.getByRole('region', { name: column })).queryByRole('list');
  if (!list) return [];
  return within(list)
    .getAllByRole('button', { name: /^Move / })
    .map((button) => button.getAttribute('aria-label')!.slice('Move '.length));
};
const trigger = (name: string) => screen.getByRole('button', { name: `Move ${name}` });
const politeRegion = () => document.querySelector('[data-todae-announcer] > [aria-live="polite"]');

function setup() {
  render(
    <Providers>
      <KanbanExample />
    </Providers>,
  );
}

// Opens a card's menu from the keyboard and walks to an item with the arrow keys.
async function open(name: string, item: string) {
  trigger(name).focus();
  await userEvent.keyboard('{Enter}');
  const menu = await screen.findByRole('menu');
  const items = within(menu).getAllByRole('menuitem');
  const target = items.findIndex((element) => element.textContent === item);
  await expect.poll(() => document.activeElement).toBe(items[0]);
  if (target > 0) await userEvent.keyboard('{ArrowDown}'.repeat(target));
  expect(document.activeElement).toBe(items[target]);
  return items[target]!;
}

it('moves a card within its column from its menu, keeps focus on its button and announces where it went', async () => {
  setup();
  await open('Export invoices as CSV', 'Move down');
  await userEvent.keyboard('{Enter}');
  expect(cards('To do')).toEqual([
    'Fix chart colors in dark mode',
    'Export invoices as CSV',
    'Write the onboarding guide',
  ]);
  await expect.poll(() => document.activeElement).toBe(trigger('Export invoices as CSV'));
  await expect
    .poll(() => politeRegion()?.textContent)
    .toBe('Export invoices as CSV moved to To do, position 2 of 3');
});

it('moves a card to the end of another column, hands focus to its button there and announces it', async () => {
  setup();
  await open('Fix chart colors in dark mode', 'Move to In progress');
  await userEvent.keyboard('{Enter}');
  expect(cards('To do')).toEqual(['Export invoices as CSV', 'Write the onboarding guide']);
  expect(cards('In progress')).toEqual([
    'Search across projects',
    'Show due dates in local time',
    'Fix chart colors in dark mode',
  ]);
  await expect.poll(() => document.activeElement).toBe(trigger('Fix chart colors in dark mode'));
  await expect
    .poll(() => politeRegion()?.textContent)
    .toBe('Fix chart colors in dark mode moved to In progress, position 3 of 3');

  // A second move from the card's new place hands focus on again.
  await open('Fix chart colors in dark mode', 'Move to Done');
  await userEvent.keyboard(' ');
  expect(cards('Done')).toEqual(['Sign in with SSO', 'Fix chart colors in dark mode']);
  await expect.poll(() => document.activeElement).toBe(trigger('Fix chart colors in dark mode'));
});

it('keeps the moves a card cannot make in the arrow-key order, unavailable', async () => {
  setup();
  await open('Export invoices as CSV', 'Move up');
  const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
  expect(items.map((item) => item.textContent)).toEqual([
    'Move up',
    'Move down',
    'Move to To do',
    'Move to In progress',
    'Move to Done',
  ]);
  expect(items.map((item) => item.getAttribute('aria-disabled'))).toEqual(['true', null, 'true', null, null]);
});

it('says a column has no cards once its last card leaves', async () => {
  setup();
  await open('Sign in with SSO', 'Move to To do');
  await userEvent.keyboard('{Enter}');
  const done = screen.getByRole('region', { name: 'Done' });
  expect(within(done).queryByRole('list')).toBeNull();
  expect(within(done).getByText('No tasks')).toBeVisible();
  await expect.poll(() => document.activeElement).toBe(trigger('Sign in with SSO'));
});

it('moves a card dragged by its grip within its column and announces where it went', async () => {
  setup();
  const card = (name: string) => trigger(name).closest('li')!;
  const grip = card('Export invoices as CSV').querySelector('.lucide-grip-vertical')!.parentElement!;
  const rect = card('Fix chart colors in dark mode').getBoundingClientRect();
  await userEvent.dragAndDrop(grip, card('Fix chart colors in dark mode'), {
    targetPosition: { x: 40, y: rect.height - 2 },
  });
  expect(cards('To do')).toEqual([
    'Fix chart colors in dark mode',
    'Export invoices as CSV',
    'Write the onboarding guide',
  ]);
  await expect
    .poll(() => politeRegion()?.textContent)
    .toBe('Export invoices as CSV moved to To do, position 2 of 3');
});
