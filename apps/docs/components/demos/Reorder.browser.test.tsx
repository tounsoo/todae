import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { afterEach, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { Providers } from '../Providers';
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

async function choose(name: string, item: string) {
  trigger(name).focus();
  await userEvent.keyboard('{Enter}');
  const menu = await screen.findByRole('menu');
  await userEvent.click(within(menu).getByRole('menuitem', { name: item }));
}

it('moves a row from its menu, keeps focus on its button and announces the new position', async () => {
  setup();
  await choose('Design', 'Move down');
  expect(order()).toEqual(['Engineering', 'Design', 'Marketing', 'Sales', 'Support']);
  await expect.poll(() => document.activeElement).toBe(trigger('Design'));
  await expect.poll(() => politeRegion()?.textContent).toBe('Design moved to position 2 of 5');

  await choose('Design', 'Move to bottom');
  expect(order()).toEqual(['Engineering', 'Marketing', 'Sales', 'Support', 'Design']);
  await expect.poll(() => document.activeElement).toBe(trigger('Design'));
  await expect.poll(() => politeRegion()?.textContent).toBe('Design moved to position 5 of 5');

  await choose('Support', 'Move to top');
  expect(order()).toEqual(['Support', 'Engineering', 'Marketing', 'Sales', 'Design']);
  await expect.poll(() => document.activeElement).toBe(trigger('Support'));

  await choose('Sales', 'Move up');
  expect(order()).toEqual(['Support', 'Engineering', 'Sales', 'Marketing', 'Design']);
  await expect.poll(() => document.activeElement).toBe(trigger('Sales'));
});

it('marks the moves a row at an end cannot make as unavailable, and keeps them in the arrow-key order', async () => {
  setup();
  trigger('Design').focus();
  await userEvent.keyboard('{Enter}');
  const menu = await screen.findByRole('menu');
  const items = within(menu).getAllByRole('menuitem');
  expect(items.map((item) => item.textContent)).toEqual(['Move to top', 'Move up', 'Move down', 'Move to bottom']);
  expect(items.map((item) => item.getAttribute('aria-disabled'))).toEqual(['true', 'true', null, null]);

  // Choosing an unavailable move does nothing and leaves the menu open.
  items[0]!.focus();
  await userEvent.keyboard('{Enter}');
  expect(order()[0]).toBe('Design');
  expect(screen.getByRole('menu')).toBeVisible();
});
