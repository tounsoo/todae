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

it('steps between versions, and a button at an end keeps focus and does nothing', async () => {
  setup();
  const reply = replies()[0]!;
  expect(count(reply)).toBe('2 of 2');
  const previous = within(reply).getByRole('button', { name: 'Previous reply' });
  const next = within(reply).getByRole('button', { name: 'Next reply' });
  expect(next).toHaveAttribute('aria-disabled', 'true');
  // Each button reads the position as its description.
  expect(next).toHaveAccessibleDescription('2 of 2');

  await userEvent.click(previous);
  expect(count(reply)).toBe('1 of 2');
  expect(previous).toHaveAttribute('aria-disabled', 'true');
  expect(document.activeElement).toBe(previous);
  // Playwright's click waits for an aria-disabled button to turn enabled, so press it with the keyboard.
  await userEvent.keyboard('{Enter}');
  expect(count(reply)).toBe('1 of 2');

  await userEvent.click(next);
  expect(count(reply)).toBe('2 of 2');
  expect(document.activeElement).toBe(next);
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

it('holds the switcher while a reply streams, so its turn stays in view', async () => {
  setup();
  const reply = replies()[0]!;
  await userEvent.click(within(reply).getByRole('button', { name: 'Regenerate' }));
  const previous = within(reply).getByRole('button', { name: 'Previous reply' });
  expect(previous).toHaveAttribute('aria-disabled', 'true');
  previous.focus();
  await userEvent.keyboard('{Enter}');
  expect(count(reply)).toBe('3 of 3');
  await expect.poll(() => previous.getAttribute('aria-disabled'), { timeout: 3000 }).toBeNull();
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

it('keeps a draft typed while the reply ran when that reply is stopped', async () => {
  setup();
  await userEvent.click(within(suggestions()!).getByRole('button', { name: 'What about a toggle button?' }));
  await userEvent.keyboard('{Enter}');
  await userEvent.type(field(), 'my draft');
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
  expect(field().value).toBe('my draft');
  expect(screen.getAllByRole('article', { name: 'You' })).toHaveLength(2);
});

it('holds Regenerate on other replies while a reply runs', async () => {
  setup();
  await userEvent.click(within(suggestions()!).getByRole('button', { name: 'What about a toggle button?' }));
  await userEvent.keyboard('{Enter}');
  const first = within(replies()[0]!).getByRole('button', { name: 'Regenerate' });
  expect(first).toHaveAttribute('aria-disabled', 'true');
  first.focus();
  await userEvent.keyboard('{Enter}');
  // The question just sent keeps its reply.
  expect(replies()).toHaveLength(2);
  expect(screen.getAllByRole('article', { name: 'You' })).toHaveLength(2);
  expect(count(replies()[0]!)).toBe('2 of 2');
  await expect.poll(() => first.getAttribute('aria-disabled'), { timeout: 3000 }).toBeNull();
});

it('regenerates the reply that is running, and stopping that still puts its question back', async () => {
  setup();
  await userEvent.click(within(suggestions()!).getByRole('button', { name: 'What about a toggle button?' }));
  await userEvent.keyboard('{Enter}');
  const running = within(replies()[1]!).getByRole('button', { name: 'Regenerate' });
  expect(running).not.toHaveAttribute('aria-disabled');
  await new Promise((resolve) => setTimeout(resolve, 700));
  await userEvent.click(running);
  // The restarted reply is still running after the first one would have ended.
  await new Promise((resolve) => setTimeout(resolve, 700));
  expect(replies()[1]).toHaveAttribute('aria-busy', 'true');
  // Still one reply in flight, so no version switcher.
  expect(within(replies()[1]!).queryByRole('button', { name: 'Next reply' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
  expect(screen.getAllByRole('article', { name: 'You' })).toHaveLength(1);
  expect(field().value).toBe('What about a toggle button?');
});
