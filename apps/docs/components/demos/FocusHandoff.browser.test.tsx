import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { afterEach, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { Providers } from '../Providers';
import { FocusHandoffRequest } from './FocusHandoffDemo';

afterEach(cleanup);

it('hands focus to the buttons that replace the ones pressed', async () => {
  render(
    <Providers>
      <FocusHandoffRequest />
    </Providers>,
  );
  screen.getByRole('button', { name: 'Allow' }).focus();
  await userEvent.keyboard('{Enter}');
  const askAgain = screen.getByRole('button', { name: 'Ask again' });
  await expect.poll(() => document.activeElement).toBe(askAgain);
  await userEvent.keyboard('{Enter}');
  await expect.poll(() => document.activeElement).toBe(screen.getByRole('button', { name: 'Allow' }));
});
