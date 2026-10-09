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
      <button type="button">Elsewhere</button>
      <CommandPalette />
    </Providers>,
  );
}

const options = () => screen.getAllByRole('option').map((option) => option.textContent);

it('opens with Ctrl+K, filters, runs the highlighted command, and returns focus', async () => {
  renderPalette();
  const trigger = screen.getByRole('button', { name: 'Search commands' });
  trigger.focus();
  await userEvent.keyboard('{Control>}k{/Control}');
  const input = await screen.findByRole('combobox', { name: 'Command' });
  expect(document.activeElement).toBe(input);
  // The recipe's own name wins over getDialogProps' default.
  expect(screen.getByRole('dialog', { name: 'Commands' })).toBeTruthy();
  await userEvent.keyboard('bill');
  await expect.poll(options).toEqual(['Open billing settings']);
  await userEvent.keyboard('{ArrowDown}{Enter}');
  await expect.poll(() => screen.queryByText('Ran: Open billing settings')).not.toBeNull();
  await expect.poll(() => screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);

  // Reopening starts from an empty query and the full list.
  await userEvent.keyboard('{Meta>}k{/Meta}');
  const again = await screen.findByRole('combobox', { name: 'Command' });
  expect((again as HTMLInputElement).value).toBe('');
  await expect.poll(options).toHaveLength(5);
});

it('returns focus to where it was when opened with the shortcut', async () => {
  renderPalette();
  const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
  elsewhere.focus();
  await userEvent.keyboard('{Control>}k{/Control}');
  await screen.findByRole('combobox', { name: 'Command' });
  await userEvent.keyboard('{Escape}');
  await expect.poll(() => screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(elsewhere);
});

it('closes on Escape and says when nothing matches', async () => {
  renderPalette();
  await userEvent.click(screen.getByRole('button', { name: 'Search commands' }));
  await screen.findByRole('combobox', { name: 'Command' });
  await userEvent.keyboard('zzz');
  await expect.poll(() => screen.getByText('No matching commands.').getAttribute('role')).toBe('status');
  await userEvent.keyboard('{Escape}');
  await expect.poll(() => screen.queryByRole('dialog')).toBeNull();
});

function press(init: KeyboardEventInit) {
  return document.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
}

const dialogOpen = () => screen.queryByRole('dialog') !== null;

it('matches the K letter, or the K position when the layout has no Latin letters', async () => {
  renderPalette();
  // Dvorak: the key labelled K sits where QWERTY has V.
  expect(press({ key: 'k', code: 'KeyV', ctrlKey: true })).toBe(false);
  await expect.poll(dialogOpen).toBe(true);
  await userEvent.keyboard('{Escape}');
  await expect.poll(dialogOpen).toBe(false);

  // Korean 2-set: the K position types ㅏ.
  expect(press({ key: 'ㅏ', code: 'KeyK', metaKey: true })).toBe(false);
  await expect.poll(dialogOpen).toBe(true);
});

it('ignores Ctrl+T on Dvorak, AltGr+K and Ctrl+Shift+K', async () => {
  renderPalette();
  expect(press({ key: 't', code: 'KeyK', ctrlKey: true })).toBe(true);
  expect(press({ key: 'ł', code: 'KeyK', ctrlKey: true, altKey: true })).toBe(true);
  expect(press({ key: 'K', code: 'KeyK', ctrlKey: true, shiftKey: true })).toBe(true);
  // A frame later, still closed; then the real shortcut opens it, so the checks above were live.
  await new Promise(requestAnimationFrame);
  expect(dialogOpen()).toBe(false);
  expect(press({ key: 'k', code: 'KeyK', ctrlKey: true })).toBe(false);
  await expect.poll(dialogOpen).toBe(true);
});

it('keeps the query when the shortcut is pressed while open', async () => {
  renderPalette();
  await userEvent.keyboard('{Control>}k{/Control}');
  const input = (await screen.findByRole('combobox', { name: 'Command' })) as HTMLInputElement;
  await userEvent.keyboard('bill');
  await userEvent.keyboard('{Control>}k{/Control}');
  await new Promise(requestAnimationFrame);
  expect(input.value).toBe('bill');
  await expect.poll(options).toEqual(['Open billing settings']);
});

it('starts each search at the top row', async () => {
  renderPalette();
  await userEvent.keyboard('{Control>}k{/Control}');
  await screen.findByRole('combobox', { name: 'Command' });
  await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
  await expect.poll(() => screen.queryByText('Ran: Open billing settings')).not.toBeNull();
  await expect.poll(dialogOpen).toBe(false);
  await userEvent.keyboard('{Control>}k{/Control}');
  await screen.findByRole('combobox', { name: 'Command' });
  await userEvent.keyboard('{Enter}');
  await expect.poll(() => screen.queryByText('Ran: Create invoice')).not.toBeNull();
});

it('runs a command on click and returns focus to the trigger when the click did not focus it', async () => {
  renderPalette();
  const trigger = screen.getByRole('button', { name: 'Search commands' });
  (document.activeElement as HTMLElement | null)?.blur();
  // Like Safari: activate the trigger without moving focus to it.
  trigger.click();
  await screen.findByRole('combobox', { name: 'Command' });
  await userEvent.click(screen.getByRole('option', { name: 'Switch theme' }));
  await expect.poll(() => screen.queryByText('Ran: Switch theme')).not.toBeNull();
  await expect.poll(dialogOpen).toBe(false);
  expect(document.activeElement).toBe(trigger);
});

it('hides the empty list when nothing matches', async () => {
  renderPalette();
  await userEvent.keyboard('{Control>}k{/Control}');
  await screen.findByRole('combobox', { name: 'Command' });
  await userEvent.keyboard('zzz');
  await expect.poll(() => screen.queryByRole('listbox')).toBeNull();
});

it('runs a command once, even when a second Enter or click lands while it closes', async () => {
  const runs: string[] = [];
  render(
    <Providers>
      <CommandPalette onRun={(value) => runs.push(value)} />
    </Providers>,
  );
  await userEvent.keyboard('{Control>}k{/Control}');
  await screen.findByRole('combobox', { name: 'Command' });
  await userEvent.keyboard('{Enter}{Enter}');
  // Still closing, so the option is still there to click.
  expect(dialogOpen()).toBe(true);
  screen.getByRole('option', { name: 'Create invoice' }).click();
  await expect.poll(dialogOpen).toBe(false);
  expect(runs).toEqual(['new-invoice']);
});

it('keeps the query and the focus target when reopened while closing', async () => {
  renderPalette();
  const trigger = screen.getByRole('button', { name: 'Search commands' });
  (document.activeElement as HTMLElement | null)?.blur();
  trigger.click();
  const input = (await screen.findByRole('combobox', { name: 'Command' })) as HTMLInputElement;
  await userEvent.keyboard('b');
  await userEvent.keyboard('{Escape}');
  expect(press({ key: 'k', code: 'KeyK', ctrlKey: true })).toBe(false);
  await new Promise(requestAnimationFrame);
  expect(input.value).toBe('b');
  await userEvent.keyboard('{Escape}');
  await expect.poll(dialogOpen).toBe(false);
  expect(document.activeElement).toBe(trigger);
});
