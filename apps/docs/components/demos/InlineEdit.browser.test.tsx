import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { afterEach, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { Providers } from '../Providers';
import { InlineEditExample } from './InlineEditDemo';

afterEach(cleanup);

const rename = () => screen.getByRole('button', { name: 'Rename' });
const field = () => screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement;

function setup() {
  render(
    <Providers>
      <InlineEditExample />
    </Providers>,
  );
}

// The description starts with the name; the open tooltip of an icon-only button adds its own name after it.
it('renames with Enter and puts focus back on Rename, described by the new name', async () => {
  setup();
  await userEvent.click(rename());
  expect(document.activeElement).toBe(field());
  // The name is selected, so typing replaces it.
  await userEvent.keyboard('Q4 report{Enter}');
  await expect.poll(() => document.activeElement).toBe(rename());
  expect(rename()).toHaveAccessibleDescription(/^Q4 report\b/);
});

it('puts the name back on Escape', async () => {
  setup();
  await userEvent.click(rename());
  await userEvent.keyboard('Draft{Escape}');
  await expect.poll(() => document.activeElement).toBe(rename());
  expect(rename()).toHaveAccessibleDescription(/^Q3 report\b/);
});

it('keeps editing an empty name and shows the error', async () => {
  setup();
  await userEvent.click(rename());
  await userEvent.keyboard('{Backspace}{Enter}');
  expect(document.activeElement).toBe(field());
  expect(field()).toHaveAttribute('aria-invalid', 'true');
  expect(field()).toHaveAccessibleDescription('Enter a name.');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(document.activeElement).toBe(field());
  await userEvent.keyboard('Plan{Enter}');
  await expect.poll(() => document.activeElement).toBe(rename());
  expect(rename()).toHaveAccessibleDescription(/^Plan\b/);
});
