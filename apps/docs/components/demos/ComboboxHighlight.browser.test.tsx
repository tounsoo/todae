import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from 'vitest/browser';
import { afterEach, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import ComboboxCreate from '../../examples/recipes/combobox/ComboboxCreate';
import ComboboxEmpty from '../../examples/recipes/combobox/ComboboxEmpty';
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

it('marks only the typed text in the create row, not its own word "Create"', async () => {
  render(
    <Providers>
      <ComboboxCreate />
    </Providers>,
  );
  await userEvent.click(screen.getByRole('combobox'));
  // "e" is in todae, tokens and twice in "Create".
  await userEvent.keyboard('e');
  await expect
    .poll(() => [...(CSS.highlights.get('combobox-match') ?? [])].map(String))
    .toEqual(['e', 'e', 'e']);
  const marks = [...CSS.highlights.get('combobox-match')!] as Range[];
  const inRow = marks.filter((range) => range.startContainer.parentElement?.closest('[role="option"]')?.textContent === '+ Create "e"');
  expect(inRow.map((range) => range.startOffset)).toEqual(['+ Create "'.length]);
  expect(screen.getByRole('option', { name: '+ Create "e"' })).toBeTruthy();
});
