import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Button } from './Button.js';

// Each test here runs on a page where no tip has mounted yet, so this file
// keeps out of Button.test.tsx, whose earlier tips would watch the page.
describe('Button on a page with no tip yet', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('opens no icon-only tip for focus a script moves after a press', () => {
    render(
      <>
        <Button.Root>Open</Button.Root>
        <Button.Root aria-label="Close">
          <Button.Icon>x</Button.Icon>
        </Button.Root>
      </>,
    );
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Open' }));
    act(() => {
      screen.getByRole('button', { name: 'Close' }).focus();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByRole('tooltip', { hidden: true })?.hasAttribute('data-open') ?? false).toBe(false);
  });

  it('shows an icon-only tip on the first hover in StrictMode', () => {
    render(
      <StrictMode>
        <Button.Root aria-label="Archive">
          <Button.Icon>+</Button.Icon>
        </Button.Root>
      </StrictMode>,
    );
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Archive' }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('tooltip', { hidden: true }).hasAttribute('data-open')).toBe(true);
  });

  it('shows a cut label tip on the first hover in StrictMode', () => {
    render(
      <StrictMode>
        <Button.Root>Save every archived thread</Button.Root>
      </StrictMode>,
    );
    const button = screen.getByRole('button', { name: 'Save every archived thread' });
    const label = button.querySelector('span:not([aria-hidden])') as HTMLElement;
    Object.defineProperty(label, 'scrollWidth', { configurable: true, value: 120 });
    Object.defineProperty(label, 'clientWidth', { configurable: true, value: 40 });
    fireEvent.pointerEnter(button);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('tooltip', { hidden: true }).hasAttribute('data-open')).toBe(true);
  });
});
