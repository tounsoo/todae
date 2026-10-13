import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { afterEach, expect, it } from 'vitest';
import '@omsoo.design/todae/todae.css';
import { Providers } from '../Providers';
import { ComboboxHighlight } from './ComboboxDemo';

afterEach(cleanup);

it('highlights the typed text in every matching option', async () => {
  render(
    <Providers>
      <ComboboxHighlight />
    </Providers>,
  );
  await userEvent.click(screen.getByRole('combobox'));
  await userEvent.keyboard('san');
  await expect
    .poll(() => [...(CSS.highlights.get('docs-combobox-match') ?? [])].map(String))
    .toEqual(['San', 'San', 'San']);
});
