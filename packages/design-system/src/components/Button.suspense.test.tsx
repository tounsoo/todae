import { Suspense, use, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Button } from './Button.js';
import { resetInputModality } from '../internal/inputModality.js';
import { resetTooltipWarmth } from '../overlay/tooltipWarmth.js';

const tip = () => document.querySelector('[role="tooltip"][data-open]')?.textContent ?? null;
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
  resetInputModality();
  resetTooltipWarmth();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// A Suspense fallback hides an open hover tip and cleans up its layout
// effects without unmounting it; a leave meanwhile must still release it.
describe('Button tip behind a Suspense fallback', () => {
  it.each([
    ['leaves', true],
    ['stays', false],
  ] as const)('shows the tip when the content is back only if the pointer stays (pointer %s)', async (_how, leave) => {
    let resolve!: () => void;
    const pending = new Promise<void>((done) => {
      resolve = done;
    });
    function Lazy({ on }: { on: boolean }) {
      if (on) use(pending);
      return null;
    }
    let suspend!: (on: boolean) => void;
    function App() {
      const [on, setOn] = useState(false);
      suspend = setOn;
      return (
        <Suspense fallback={<p>loading</p>}>
          <Button.Root aria-label="Save">
            <Button.Icon>s</Button.Icon>
          </Button.Root>
          <Lazy on={on} />
        </Suspense>
      );
    }
    render(<App />);
    const button = screen.getByRole('button', { name: 'Save' });
    fireEvent.pointerEnter(button);
    advance(1500);
    expect(tip()).toBe('Save');
    await act(async () => {
      suspend(true);
    });
    expect(screen.getByText('loading')).toBeTruthy();
    if (leave) fireEvent.pointerLeave(button, { relatedTarget: document.body });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await act(async () => {
      resolve();
      await pending;
    });
    for (let i = 0; i < 40 && screen.queryByText('loading'); i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }
    expect(screen.queryByText('loading')).toBeNull();
    expect(tip()).toBe(leave ? null : 'Save');
  });
});
