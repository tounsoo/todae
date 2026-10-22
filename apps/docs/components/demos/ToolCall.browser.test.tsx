import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { afterEach, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { Providers } from '../Providers';
import { ToolCallExample } from './ToolCallDemo';

afterEach(cleanup);

const summary = (name: string) => screen.getByText(name).closest('summary')!;

it('opens a call that waits for approval and names its buttons by the tool', () => {
  render(
    <Providers>
      <ToolCallExample />
    </Providers>,
  );
  expect(summary('search_docs').parentElement).not.toHaveAttribute('open');
  expect(summary('create_branch').parentElement).toHaveAttribute('open');
  expect(screen.getByRole('group', { name: 'create_branch' })).toContainElement(screen.getByRole('button', { name: 'Approve' }));
});

it('moves focus to the summary when a call is approved, then shows its output', async () => {
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
  expect(screen.getByText(/didn't make the branch/)).toBeVisible();
});
