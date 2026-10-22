import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { afterEach, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { Providers } from '../Providers';
import { ToolCallExample } from './ToolCallDemo';

afterEach(cleanup);

const summary = (name: string) => screen.getByText(name).closest('summary')!;

it('opens a call that waits for approval and groups its buttons under the tool\'s name', () => {
  render(
    <Providers>
      <ToolCallExample />
    </Providers>,
  );
  expect(summary('search_docs').parentElement).not.toHaveAttribute('open');
  expect(summary('create_branch').parentElement).toHaveAttribute('open');
  expect(screen.getByRole('group', { name: 'create_branch' })).toContainElement(screen.getByRole('button', { name: 'Approve' }));
});

it('moves focus to the summary when a call is approved, then fills in its output', async () => {
  render(
    <Providers>
      <ToolCallExample />
    </Providers>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
  const call = summary('create_branch');
  expect(call).toHaveFocus();
  expect(call).toHaveTextContent('Running');
  expect(call.parentElement).not.toHaveAttribute('open');
  expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
  await expect.poll(() => call.textContent, { timeout: 3000 }).toContain('Done');
  expect(call).toHaveFocus();
  expect(screen.getByRole('region', { name: 'create_branch output' })).toHaveTextContent('focus-ring-brand');
});

it('moves focus to the summary when a call is denied', async () => {
  render(
    <Providers>
      <ToolCallExample />
    </Providers>,
  );
  screen.getByRole('button', { name: 'Deny' }).focus();
  await userEvent.keyboard('{Enter}');
  const call = summary('create_branch');
  expect(call).toHaveFocus();
  expect(call).toHaveTextContent('Denied');
  expect(await screen.findByText(/didn't make the branch/)).toBeVisible();
});

it('keeps a call someone opened by hand open as it finishes', async () => {
  render(
    <Providers>
      <ToolCallExample />
    </Providers>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
  const call = summary('create_branch');
  await userEvent.click(call);
  expect(call.parentElement).toHaveAttribute('open');
  await expect.poll(() => call.textContent, { timeout: 3000 }).toContain('Done');
  expect(call.parentElement).toHaveAttribute('open');
  expect(screen.getByRole('region', { name: 'create_branch output' })).toBeVisible();
});

it('keeps the reply busy only while the agent writes, not while a call waits', async () => {
  render(
    <Providers>
      <ToolCallExample />
    </Providers>,
  );
  const reply = screen.getByRole('article', { name: 'Assistant' });
  expect(reply).not.toHaveAttribute('aria-busy', 'true');
  await userEvent.click(screen.getByRole('button', { name: 'Deny' }));
  expect(reply).toHaveAttribute('aria-busy', 'true');
  await expect.poll(() => reply.getAttribute('aria-busy'), { timeout: 3000 }).not.toBe('true');
  expect(screen.getByText(/didn't make the branch/)).toBeVisible();
});
