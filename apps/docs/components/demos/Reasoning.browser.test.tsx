import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import '@tounsoo/todae/todae.css';
import { Providers } from '../Providers';
import { ReasoningExample } from './ReasoningDemo';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const block = () => document.querySelector('details')!;
const summary = () => document.querySelector('summary')!.textContent;
const reply = () => screen.getByRole('article', { name: 'Assistant' });
const advance = (ms: number) => vi.advanceTimersByTime(ms);

function show() {
  render(
    <Providers>
      <ReasoningExample />
    </Providers>,
  );
}

it('opens while the reasoning arrives and closes when the answer starts', async () => {
  show();
  expect(block().open).toBe(false);
  expect(summary()).toBe('Thought for 6 seconds');

  await userEvent.click(screen.getByRole('button', { name: 'Ask again' }));
  expect(block().open).toBe(true);
  expect(summary()).toBe('Thinking ');
  expect(reply().getAttribute('aria-busy')).toBe('true');

  advance(60 * 120);
  await expect.poll(() => block().open).toBe(false);
  expect(summary()).toMatch(/^Thought for \d+ seconds?$/);
  expect(reply().getAttribute('aria-busy')).toBe('true');

  advance(60 * 120);
  await expect.poll(() => reply().hasAttribute('aria-busy')).toBe(false);
});

it('leaves the block as the person set it', async () => {
  show();
  await userEvent.click(screen.getByRole('button', { name: 'Ask again' }));
  await userEvent.click(screen.getByText('Thinking'));
  expect(block().open).toBe(false);
  advance(10 * 120);
  await expect.poll(() => block().textContent).toContain('They are asking');
  expect(block().open).toBe(false);

  advance(50 * 120);
  await expect.poll(summary).toMatch(/^Thought for/);
  await userEvent.click(screen.getByText(/^Thought for/));
  expect(block().open).toBe(true);
  advance(60 * 120);
  await expect.poll(() => reply().hasAttribute('aria-busy')).toBe(false);
  expect(block().open).toBe(true);
});
