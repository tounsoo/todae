import { Activity, StrictMode, useState } from 'react';
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

// A hidden Activity cleans up the tip's effects without unmounting it: a
// leave or blur meanwhile must still release it, and showing it again must
// not replay the reach that mounted it.
describe('Button tip inside a hidden Activity', () => {
  it.each([[false], [true]])('a blur while hidden closes a keyboard tip (strict %s)', (strict) => {
    let setMode!: (m: 'visible' | 'hidden') => void;
    function App() {
      const [mode, set] = useState<'visible' | 'hidden'>('visible');
      setMode = set;
      return (
        <>
          <button>other</button>
          <Activity mode={mode}>
            <Button.Root aria-label="Save">
              <Button.Icon>s</Button.Icon>
            </Button.Root>
          </Activity>
        </>
      );
    }
    render(strict ? <StrictMode><App /></StrictMode> : <App />);
    const button = screen.getByRole('button', { name: 'Save' });
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => button.focus());
    advance(1500);
    expect(tip()).toBe('Save');
    act(() => setMode('hidden'));
    act(() => screen.getByRole('button', { name: 'other', hidden: true }).focus());
    advance(1500);
    act(() => setMode('visible'));
    advance(1500);
    expect(tip()).toBeNull();
  });

  it.each([[false], [true]])('a leave while hidden closes the tip (strict %s)', (strict) => {
    let setMode!: (m: 'visible' | 'hidden') => void;
    function App() {
      const [mode, set] = useState<'visible' | 'hidden'>('visible');
      setMode = set;
      return (
        <Activity mode={mode}>
          <Button.Root aria-label="Save">
            <Button.Icon>s</Button.Icon>
          </Button.Root>
        </Activity>
      );
    }
    render(strict ? <StrictMode><App /></StrictMode> : <App />);
    const button = screen.getByRole('button', { name: 'Save' });
    fireEvent.pointerEnter(button);
    advance(1500);
    expect(tip()).toBe('Save');
    act(() => setMode('hidden'));
    fireEvent.pointerLeave(button, { relatedTarget: document.body });
    advance(1500);
    act(() => setMode('visible'));
    advance(1500);
    expect(tip()).toBeNull();
  });

  it.each([[false], [true]])('takes no hold again when shown after a hover in the show delay (strict %s)', async (strict) => {
    let setMode!: (m: 'visible' | 'hidden') => void;
    function App() {
      const [mode, set] = useState<'visible' | 'hidden'>('visible');
      setMode = set;
      return (
        <Activity mode={mode}>
          <Button.Root aria-label="Save">
            <Button.Icon>s</Button.Icon>
          </Button.Root>
        </Activity>
      );
    }
    render(strict ? <StrictMode><App /></StrictMode> : <App />);
    const button = screen.getByRole('button', { name: 'Save' });
    fireEvent.pointerEnter(button);
    // The task that delivered the hover ends.
    await act(async () => {
      await Promise.resolve();
    });
    advance(100);
    act(() => setMode('hidden'));
    advance(5000);
    fireEvent.keyDown(document, { key: 'Escape' });
    act(() => setMode('visible'));
    advance(1500);
    expect(tip()).toBe(null);
  });
});
