import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from 'vitest/browser';
import { afterEach, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { Providers } from '../Providers';
import BetweenListsExample from '../../examples/utilities/use-reorder/BetweenListsExample';

afterEach(cleanup);

// The rows of a list, by the names of their menu buttons.
const rows = (list: string) => {
  const ol = screen.queryByRole('list', { name: list });
  if (!ol) return [];
  return within(ol)
    .getAllByRole('button', { name: /^Move / })
    .map((button) => button.getAttribute('aria-label')!.slice('Move '.length));
};
const trigger = (name: string) => screen.getByRole('button', { name: `Move ${name}` });
const row = (name: string) => trigger(name).closest('li')!;
const politeRegion = () => document.querySelector('[data-todae-announcer] > [aria-live="polite"]');

function setup() {
  render(
    <Providers>
      <BetweenListsExample />
    </Providers>,
  );
}

it('moves a row to the other list from its menu, hands focus to its button there and announces it', async () => {
  setup();
  trigger('Sales').focus();
  await userEvent.keyboard('{Enter}');
  const menu = await screen.findByRole('menu');
  const items = within(menu).getAllByRole('menuitem');
  expect(items.map((item) => item.textContent)).toEqual(['Move up', 'Move down', 'Move to Pinned', 'Move to Other']);
  await expect.poll(() => document.activeElement).toBe(items[0]);
  await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
  expect(rows('Pinned')).toEqual(['Design', 'Engineering', 'Sales']);
  expect(rows('Other')).toEqual(['Marketing', 'Support']);
  await expect.poll(() => document.activeElement).toBe(trigger('Sales'));
  await expect.poll(() => politeRegion()?.textContent).toBe('Sales moved to Pinned, position 3 of 3');
});

it('moves a row dragged by its grip to the other list, and into the list once it is empty', async () => {
  setup();
  const grip = (name: string) => row(name).querySelector('[aria-hidden]')!;
  const rect = row('Support').getBoundingClientRect();
  await userEvent.dragAndDrop(grip('Design'), row('Support'), { targetPosition: { x: 40, y: rect.height - 2 } });
  expect(rows('Pinned')).toEqual(['Engineering']);
  expect(rows('Other')).toEqual(['Marketing', 'Sales', 'Support', 'Design']);
  await expect.poll(() => politeRegion()?.textContent).toBe('Design moved to Other, position 4 of 4');

  await userEvent.dragAndDrop(grip('Engineering'), row('Marketing'), { targetPosition: { x: 40, y: 2 } });
  expect(rows('Pinned')).toEqual([]);
  expect(screen.getByText('No channels')).toBeVisible();

  const empty = screen.getByText('No channels').parentElement!;
  await userEvent.dragAndDrop(grip('Sales'), empty, { targetPosition: { x: 40, y: 8 } });
  expect(rows('Pinned')).toEqual(['Sales']);
  await expect.poll(() => politeRegion()?.textContent).toBe('Sales moved to Pinned, position 1 of 1');
});
