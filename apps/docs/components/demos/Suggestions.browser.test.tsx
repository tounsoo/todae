import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { afterEach, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { Providers } from '../Providers';
import { SuggestionsExample } from './SuggestionsDemo';

afterEach(cleanup);

const field = () => screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;
const suggestions = () => screen.queryByRole('list', { name: 'Suggestions' });
const replies = () => screen.getAllByRole('article', { name: 'Assistant' });
const count = (reply: HTMLElement) => within(reply).getByText(/^\d+ of \d+$/).textContent;

function setup() {
  render(
    <Providers>
      <SuggestionsExample />
    </Providers>,
  );
}

it('fills the field from a suggestion and hides the list until the next reply is done', async () => {
  setup();
  await userEvent.click(within(suggestions()!).getByRole('button', { name: 'What about a toggle button?' }));
  expect(field().value).toBe('What about a toggle button?');
  expect(document.activeElement).toBe(field());
  // A draft is never replaced by a suggestion.
  expect(suggestions()).toBeNull();

  await userEvent.keyboard('{Enter}');
  expect(field().value).toBe('');
  expect(suggestions()).toBeNull();
  await expect.poll(() => suggestions(), { timeout: 3000 }).not.toBeNull();
  expect(replies()).toHaveLength(2);
  const offered = within(suggestions()!).getAllByRole('button').map((button) => button.textContent);
  expect(offered).toEqual(['Does the tooltip show on focus?', 'Can I use a visually hidden label?']);
});

it('steps between versions and keeps focus on the switcher at either end', async () => {
  setup();
  const reply = replies()[0]!;
  expect(count(reply)).toBe('2 of 2');
  const previous = within(reply).getByRole('button', { name: 'Previous reply' });
  const next = within(reply).getByRole('button', { name: 'Next reply' });
  expect(next).toBeDisabled();
  // Each button reads the position as its description.
  expect(next).toHaveAccessibleDescription('2 of 2');

  await userEvent.click(previous);
  expect(count(reply)).toBe('1 of 2');
  expect(previous).toBeDisabled();
  expect(document.activeElement).toBe(next);

  await userEvent.click(next);
  expect(count(reply)).toBe('2 of 2');
  expect(document.activeElement).toBe(previous);
});

it('regenerates into a new version, and a later turn belongs to the version it followed', async () => {
  setup();
  const reply = replies()[0]!;
  const regenerate = within(reply).getByRole('button', { name: 'Regenerate' });
  await userEvent.click(regenerate);
  expect(count(reply)).toBe('3 of 3');
  await expect.poll(() => reply.getAttribute('aria-busy'), { timeout: 3000 }).not.toBe('true');
  expect(document.activeElement).toBe(regenerate);

  await userEvent.click(within(suggestions()!).getByRole('button', { name: 'Does the tooltip show on focus?' }));
  await userEvent.keyboard('{Enter}');
  await expect.poll(() => replies().length).toBe(2);
  expect(screen.getAllByRole('article', { name: 'You' })).toHaveLength(2);

  // Back to the second version: the follow-up asked after the third goes with it.
  await userEvent.click(within(reply).getByRole('button', { name: 'Previous reply' }));
  expect(count(reply)).toBe('2 of 3');
  expect(screen.getAllByRole('article', { name: 'You' })).toHaveLength(1);
  await userEvent.click(within(reply).getByRole('button', { name: 'Next reply' }));
  expect(screen.getAllByRole('article', { name: 'You' })).toHaveLength(2);
});

it('puts the shown version back when a regenerated reply is stopped', async () => {
  setup();
  const reply = replies()[0]!;
  await userEvent.click(within(reply).getByRole('button', { name: 'Previous reply' }));
  await userEvent.click(within(reply).getByRole('button', { name: 'Regenerate' }));
  expect(count(reply)).toBe('3 of 3');
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
  expect(count(reply)).toBe('1 of 2');
});

it('keeps the composer busy while a reply streams in a version not shown', async () => {
  setup();
  const reply = replies()[0]!;
  await userEvent.click(within(reply).getByRole('button', { name: 'Regenerate' }));
  await userEvent.click(within(reply).getByRole('button', { name: 'Previous reply' }));
  expect(count(reply)).toBe('2 of 3');
  expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
  expect(suggestions()).toBeNull();
  // Stopping it leaves the version the person chose.
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
  expect(count(reply)).toBe('2 of 2');
});

it('puts a question stopped before any reply back in the field', async () => {
  setup();
  await userEvent.click(within(suggestions()!).getByRole('button', { name: 'What about a toggle button?' }));
  await userEvent.keyboard('{Enter}');
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
  expect(screen.getAllByRole('article', { name: 'You' })).toHaveLength(1);
  expect(field().value).toBe('What about a toggle button?');
  expect(document.activeElement).toBe(field());
});
