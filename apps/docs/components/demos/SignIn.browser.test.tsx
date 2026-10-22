import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { afterEach, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { Providers } from '../Providers';
import { SignInExample, SignUpExample } from './SignInDemo';

afterEach(cleanup);

// The auto-send's 500 ms pause, the stand-in code check's 1200 ms, and a margin.
const LONGER_THAN_A_SEND = 2200;

const password = () => screen.getByLabelText('Password') as HTMLInputElement;
const show = () => screen.getByRole('button', { name: 'Show password' });
const code = () => screen.getByRole('textbox', { name: 'Verification code' }) as HTMLInputElement;

function signIn() {
  render(
    <Providers>
      <SignInExample />
    </Providers>,
  );
}

it('shows the password with a toggle that keeps its label, and hides it again on submit', async () => {
  signIn();
  await userEvent.type(screen.getByRole('textbox', { name: 'Email' }), 'ben@example.com');
  await userEvent.type(password(), 'wrong');
  expect(password().type).toBe('password');
  await userEvent.click(show());
  expect(show()).toHaveAttribute('aria-pressed', 'true');
  expect(password().type).toBe('text');
  expect(password().spellcheck).toBe(false);
  // The press keeps focus and the caret in the password, so typing goes on.
  expect(document.activeElement).toBe(password());
  await userEvent.keyboard('er');
  expect(password().value).toBe('wronger');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(password().type).toBe('password');
  expect(show()).toHaveAttribute('aria-pressed', 'false');
});

it('puts a wrong email or password on the password and moves focus there', async () => {
  signIn();
  await userEvent.type(screen.getByRole('textbox', { name: 'Email' }), 'ben@example.com');
  await userEvent.type(password(), 'wrong{Enter}');
  await expect.poll(() => password().getAttribute('aria-invalid'), { timeout: 3000 }).toBe('true');
  expect(document.activeElement).toBe(password());
  expect(password()).toHaveAccessibleDescription('The email or password is wrong.');
});

it('moves focus to an unmarked code field, sends a full code by itself, and confirms at the end', async () => {
  signIn();
  await userEvent.type(screen.getByRole('textbox', { name: 'Email' }), 'ben@example.com');
  await userEvent.type(password(), 'correct horse{Enter}');
  await expect.poll(() => document.activeElement === screen.queryByRole('textbox', { name: 'Verification code' }), { timeout: 3000 }).toBe(true);
  // A form of its own: the sign-in form's submit doesn't mark the new field as missing.
  expect(code()).not.toHaveAttribute('aria-invalid');
  expect(code()).toHaveAccessibleDescription(/6-digit code/);

  await userEvent.keyboard('111111');
  await expect.poll(() => code().getAttribute('aria-invalid'), { timeout: 3000 }).toBe('true');
  expect(document.activeElement).toBe(code());
  expect(code()).toHaveAccessibleDescription(/That code isn't right/);

  // A new code: the description says so, a screen reader hears it, and the old code's error goes.
  await userEvent.click(screen.getByRole('button', { name: 'Send a new code' }));
  await expect.poll(() => code().getAttribute('aria-invalid'), { timeout: 3000 }).toBeNull();
  expect(code()).toHaveAccessibleDescription(/^We sent a new code/);
  await expect.poll(() => document.querySelector('[data-todae-announcer]')?.textContent).toContain('We sent a new code.');
  // The old code stays in the field but isn't sent again by itself. Its check would answer after the
  // 500 ms pause and the stand-in's 1200 ms request.
  await new Promise((resolve) => setTimeout(resolve, LONGER_THAN_A_SEND));
  expect(code()).not.toHaveAttribute('aria-invalid');
  code().focus();
  await userEvent.keyboard('{Control>}a{/Control}123456');
  const heading = await screen.findByRole('heading', { name: 'Signed in' }, { timeout: 4000 });
  await expect.poll(() => document.activeElement).toBe(heading);
});

it('sends a code changed during a check, and not one in the field when a new code is asked for', async () => {
  signIn();
  await userEvent.type(screen.getByRole('textbox', { name: 'Email' }), 'ben@example.com');
  await userEvent.type(password(), 'correct horse{Enter}');
  await expect.poll(() => document.activeElement === screen.queryByRole('textbox', { name: 'Verification code' }), { timeout: 3000 }).toBe(true);
  // Verify, which reads "Verifying…" while a check runs.
  const verify = () => screen.getByRole('button', { name: /^Verify/ });

  // A full code typed and a new one asked for before it sends itself: it waits for Verify.
  await userEvent.keyboard('123456');
  // Still waiting out the pause, so the code hasn't gone.
  expect(verify()).not.toHaveAttribute('aria-disabled');
  await userEvent.click(screen.getByRole('button', { name: 'Send a new code' }));
  await expect.poll(() => code()).toHaveAccessibleDescription(/^We sent a new code/);
  await new Promise((resolve) => setTimeout(resolve, LONGER_THAN_A_SEND));
  expect(screen.queryByRole('heading', { name: 'Signed in' })).toBeNull();

  // A wrong code sends itself; changed while it is checked, the new code sends after.
  code().focus();
  await userEvent.keyboard('{Control>}a{/Control}111111');
  await expect.poll(() => verify().getAttribute('aria-disabled'), { timeout: 3000 }).toBe('true');
  await userEvent.keyboard('{Control>}a{/Control}123456');
  await screen.findByRole('heading', { name: 'Signed in' }, { timeout: 5000 });
});

it('turns down an email that has an account on sign-up, with focus on the email', async () => {
  render(
    <Providers>
      <SignUpExample />
    </Providers>,
  );
  await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Ben');
  const email = screen.getByRole('textbox', { name: 'Email' });
  await userEvent.type(email, 'ben@example.com');
  await userEvent.type(password(), 'short{Enter}');
  // The browser's own check comes first, in the page's words.
  expect(document.activeElement).toBe(password());
  expect(password()).toHaveAccessibleDescription(/^12 characters or more\..*Use at least 12 characters$/);
  await userEvent.type(password(), ' and some more{Enter}');
  await expect.poll(() => document.activeElement, { timeout: 3000 }).toBe(email);
  expect(email).toHaveAccessibleDescription('An account with this email already exists.');
});
