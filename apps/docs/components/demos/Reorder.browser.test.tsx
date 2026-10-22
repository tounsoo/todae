import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { afterEach, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { Providers } from '../Providers';
import { PinnedChannels } from './PinnedChannels';
import { ReorderExample } from './ReorderDemo';

afterEach(cleanup);

const order = () =>
  within(screen.getByRole('list', { name: 'Pinned channels' }))
    .getAllByRole('button', { name: /^Move / })
    .map((button) => button.getAttribute('aria-label')!.slice('Move '.length));
const trigger = (name: string) => screen.getByRole('button', { name: `Move ${name}` });
const politeRegion = () => document.querySelector('[data-todae-announcer] > [aria-live="polite"]');

function setup() {
  render(
    <Providers>
      <ReorderExample />
    </Providers>,
  );
}

// Opens a row's menu from the keyboard and walks to an item with the arrow keys.
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

it('moves a row from its menu, keeps focus on its button and announces the new position', async () => {
  setup();
  await open('Design', 'Move down');
  await userEvent.keyboard('{Enter}');
  expect(order()).toEqual(['Engineering', 'Design', 'Marketing', 'Sales', 'Support']);
  await expect.poll(() => document.activeElement).toBe(trigger('Design'));
  await expect.poll(() => politeRegion()?.textContent).toBe('Design moved to position 2 of 5');

  await open('Design', 'Move to bottom');
  await userEvent.keyboard(' ');
  expect(order()).toEqual(['Engineering', 'Marketing', 'Sales', 'Support', 'Design']);
  await expect.poll(() => document.activeElement).toBe(trigger('Design'));
  await expect.poll(() => politeRegion()?.textContent).toBe('Design moved to position 5 of 5');

  await userEvent.click(await open('Support', 'Move to top'));
  expect(order()).toEqual(['Support', 'Engineering', 'Marketing', 'Sales', 'Design']);
  await expect.poll(() => document.activeElement).toBe(trigger('Support'));
  await expect.poll(() => politeRegion()?.textContent).toBe('Support moved to position 1 of 5');

  await open('Sales', 'Move up');
  await userEvent.keyboard('{Enter}');
  expect(order()).toEqual(['Support', 'Engineering', 'Sales', 'Marketing', 'Design']);
  await expect.poll(() => document.activeElement).toBe(trigger('Sales'));
  await expect.poll(() => politeRegion()?.textContent).toBe('Sales moved to position 3 of 5');
});

it('keeps the moves a row at an end cannot make in the arrow-key order, unavailable', async () => {
  setup();
  const said = politeRegion()?.textContent ?? '';
  const up = await open('Design', 'Move up');
  const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
  expect(items.map((item) => item.textContent)).toEqual(['Move to top', 'Move up', 'Move down', 'Move to bottom']);
  expect(items.map((item) => item.getAttribute('aria-disabled'))).toEqual(['true', 'true', null, null]);

  expect(document.activeElement).toBe(up);
  await userEvent.keyboard('{Enter}');
  expect(order()).toEqual(['Design', 'Engineering', 'Marketing', 'Sales', 'Support']);
  expect(screen.getByRole('menu')).toBeVisible();
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(politeRegion()?.textContent ?? '').toBe(said);
});

it('keeps focus on a focused row its props move, as a revert after a failed save does', async () => {
  const channels = [
    { id: 'design', name: 'Design' },
    { id: 'engineering', name: 'Engineering' },
    { id: 'marketing', name: 'Marketing' },
  ];
  // Design was moved to the top; putting it back moves its element, which React keeps focused.
  const before = [channels[1]!, channels[2]!, channels[0]!];
  const { rerender } = render(
    <Providers>
      <PinnedChannels channels={channels} onReorder={() => {}} />
    </Providers>,
  );
  trigger('Design').focus();
  rerender(
    <Providers>
      <PinnedChannels channels={before} onReorder={() => {}} />
    </Providers>,
  );
  expect(order()).toEqual(['Engineering', 'Marketing', 'Design']);
  expect(document.activeElement).toBe(trigger('Design'));
});
