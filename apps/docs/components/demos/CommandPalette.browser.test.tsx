import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { afterEach, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { Providers } from '../Providers';
import { CommandPalette } from './CommandPaletteDemo';

afterEach(cleanup);

function renderPalette() {
  render(
    <Providers>
      <CommandPalette />
    </Providers>,
  );
}

it('opens with Ctrl+K, filters, runs the highlighted command, and returns focus', async () => {
  renderPalette();
  const trigger = screen.getByRole('button', { name: 'Search commands' });
  trigger.focus();
  await userEvent.keyboard('{Control>}k{/Control}');
  const input = await screen.findByRole('combobox', { name: 'Command' });
  expect(document.activeElement).toBe(input);
  await userEvent.keyboard('bill');
  await expect.poll(() => screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Open billing settings']);
  await userEvent.keyboard('{ArrowDown}{Enter}');
  await expect.poll(() => screen.getByRole('status').textContent).toBe('Ran: Open billing settings');
  await expect.poll(() => screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it('closes on Escape and says when nothing matches', async () => {
  renderPalette();
  await userEvent.click(screen.getByRole('button', { name: 'Search commands' }));
  await screen.findByRole('combobox', { name: 'Command' });
  await userEvent.keyboard('zzz');
  await expect.poll(() => screen.queryByText('No matching commands.')).not.toBeNull();
  await userEvent.keyboard('{Escape}');
  await expect.poll(() => screen.queryByRole('dialog')).toBeNull();
});
