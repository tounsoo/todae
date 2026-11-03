import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { afterEach, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import ComboboxHighlight from '../../examples/recipes/combobox/ComboboxHighlight';
import { Providers } from '../Providers';

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
