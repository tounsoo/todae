import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { afterEach, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { Providers } from '../Providers';
import { WizardExample } from './WizardDemo';

afterEach(cleanup);

const heading = (name: RegExp) => screen.getByRole('heading', { name });
const current = () => screen.getByRole('list', { name: 'Sign-up steps' }).querySelector('[aria-current="step"]')?.textContent;

function setup() {
  render(
    <Providers>
      <WizardExample />
    </Providers>,
  );
}

async function fillAccount(email: string) {
  await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Ada Park');
  await userEvent.type(screen.getByRole('textbox', { name: 'Work email' }), email);
}

async function fillWorkspace() {
  await userEvent.type(screen.getByRole('textbox', { name: 'Workspace name' }), 'Orbit');
  await userEvent.click(screen.getByRole('radio', { name: 'Pro' }));
}

it('keeps a step with a problem and moves focus to its first invalid control', async () => {
  setup();
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(current()).toBe('In progress: Account');
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Name' }));
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('aria-invalid', 'true');
});

it('moves focus to the heading of each step it shows, forward and back, and keeps the answers', async () => {
  setup();
  await fillAccount('ada@example.com');
  // Enter in a field submits the step, as in any form.
  await userEvent.keyboard('{Enter}');
  expect(document.activeElement).toBe(heading(/Step 2 of 3\s*Workspace/));
  expect(current()).toBe('In progress: Workspace');
  // The step before is hidden, so its controls leave the page's tab order and the accessibility tree.
  expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();

  await userEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(document.activeElement).toBe(heading(/Step 1 of 3\s*Account/));
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Ada Park');
  // Going back shows no problem on the step that comes next.
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByRole('textbox', { name: 'Workspace name' })).not.toHaveAttribute('aria-invalid', 'true');
});

it('shows every answer on the last step and confirms the workspace', async () => {
  setup();
  await fillAccount('ada@example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  await fillWorkspace();
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(document.activeElement).toBe(heading(/Step 3 of 3\s*Review/));
  const review = within(screen.getByRole('form', { name: /Review/ }));
  expect(review.getAllByRole('definition').map((details) => details.textContent)).toEqual(['Ada Park', 'ada@example.com', 'Orbit', 'Pro']);

  await userEvent.click(screen.getByRole('button', { name: 'Create workspace' }));
  await expect.poll(() => document.activeElement?.textContent, { timeout: 3000 }).toBe('Workspace created');
});

it('takes a server error back to the step that asks for it, with focus on the control', async () => {
  setup();
  await fillAccount('ben@example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  await fillWorkspace();
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  await userEvent.click(screen.getByRole('button', { name: 'Create workspace' }));

  const email = () => screen.queryByRole('textbox', { name: 'Work email' });
  await expect.poll(() => document.activeElement === email() && email() !== null, { timeout: 3000 }).toBe(true);
  expect(current()).toBe('In progress: Account');
  expect(email()).toHaveAccessibleDescription('That address is taken.');

  // A new address and the same path through the steps creates the workspace.
  await userEvent.clear(email()!);
  await userEvent.type(email()!, 'ada@example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  await userEvent.click(screen.getByRole('button', { name: 'Create workspace' }));
  await expect.poll(() => document.activeElement?.textContent, { timeout: 3000 }).toBe('Workspace created');
});

it('takes a second reply with the same error back again', async () => {
  setup();
  await fillAccount('ben@example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  await fillWorkspace();
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  await userEvent.click(screen.getByRole('button', { name: 'Create workspace' }));
  const email = () => screen.queryByRole('textbox', { name: 'Work email' });
  await expect.poll(() => document.activeElement === email() && email() !== null, { timeout: 3000 }).toBe(true);

  // Through the steps again without a change: the server says the same, and focus comes back to the field.
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  await userEvent.click(screen.getByRole('button', { name: 'Create workspace' }));
  await expect.poll(() => document.activeElement === email() && email() !== null, { timeout: 3000 }).toBe(true);
  expect(email()).toHaveAccessibleDescription('That address is taken.');
});
