import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { afterEach, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { ComboboxCreate, ComboboxEmpty } from './ComboboxDemo';
import { Providers } from '../Providers';

afterEach(cleanup);

it('highlights the typed text in the options of any combobox sharing the name', async () => {
  render(
    <Providers>
      <ComboboxEmpty />
      <ComboboxCreate />
    </Providers>,
  );
  // The first combobox mounted first, so a name held by the last hook alone would leave it unpainted.
  const [first] = screen.getAllByRole('combobox');
  await userEvent.click(first!);
  await userEvent.keyboard('to');
  await expect
    .poll(() => [...(CSS.highlights.get('combobox-match') ?? [])].map(String))
    .toEqual(['to', 'to']);
  // The highlight changes no markup, so each option keeps its accessible name.
  expect(screen.getByRole('option', { name: 'todae' })).toBeTruthy();
  expect(screen.getByRole('option', { name: 'tokens' })).toBeTruthy();
});
