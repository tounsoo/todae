import { StrictMode, useLayoutEffect, useState, type ReactElement } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Button } from './Button.js';
import { resetInputModality } from '../internal/inputModality.js';
import { resetTooltipWarmth } from '../overlay/tooltipWarmth.js';

const tipOpen = () => screen.queryByRole('tooltip', { hidden: true })?.hasAttribute('data-open') ?? false;
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  resetInputModality();
});
afterEach(() => {
  cleanup();
  resetTooltipWarmth();
  vi.useRealTimers();
});

const wrapper = (strict: boolean) => (el: ReactElement) => (strict ? <StrictMode>{el}</StrictMode> : el);

// Focus that lands during a commit, from a sibling's layout effect or the
// button's own ref, before the tip that commit turns on has set its holds.
describe('Button tip and focus taken during a commit', () => {
  // C: a button reached before (tip once mounted), whose tip turns back on in
  // the same commit that an earlier sibling's layout effect moves keyboard
  // focus onto it: the reach runs with `tipped` true, before ButtonTip's
  // layout effect has set `holds`.
  it.each([false, true])('tips an icon-only button focused by an earlier sibling in the commit that turns its tip on (StrictMode %s)', (strict) => {
    const wrap = wrapper(strict);
    function Focuser({ on }: { on: boolean }) {
      useLayoutEffect(() => {
        if (on) (document.querySelector('[aria-label="Close"]') as HTMLElement | null)?.focus();
      }, [on]);
      return null;
    }
    const tree = (on: boolean) => (
      <>
        <Focuser on={on} />
        <Button.Root aria-label="Close" tooltip={on}>
          <Button.Icon>x</Button.Icon>
        </Button.Root>
      </>
    );
    // Reach it first so the tip has been on once.
    const { rerender } = render(wrap(tree(true)));
    const button = screen.getByRole('button', { name: 'Close' });
    act(() => button.blur());
    fireEvent.pointerEnter(button);
    advance(1000);
    expect(tipOpen()).toBe(true);
    fireEvent.pointerLeave(button);
    advance(1000);
    expect(tipOpen()).toBe(false);
    act(() => {
      rerender(wrap(tree(false)));
    });
    expect(document.activeElement).not.toBe(button);
    // A key, then the commit that turns the tip on and focuses the button.
    fireEvent.keyDown(document.body, { key: 'Enter' });
    act(() => {
      rerender(wrap(tree(true)));
    });
    expect(document.activeElement).toBe(button);
    advance(1000);
    expect(tipOpen()).toBe(true);
  });

  // D: same as C, with the button gaining its name (aria-label) in that commit.
  it('tips an icon-only button focused by an earlier sibling in the commit that names it', () => {
    function Panel() {
      const [named, setNamed] = useState(false);
      useLayoutEffect(() => {
        if (named) (document.querySelector('[data-testid="b"]') as HTMLElement | null)?.focus();
      }, [named]);
      return (
        <>
          <button type="button" onClick={() => setNamed(true)}>
            go
          </button>
          <Button.Root data-testid="b" aria-label={named ? 'Close' : undefined}>
            <Button.Icon>x</Button.Icon>
          </Button.Root>
        </>
      );
    }
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<Panel />);
    const go = screen.getByRole('button', { name: 'go' });
    fireEvent.keyDown(go, { key: 'Enter' });
    act(() => go.click());
    const button = screen.getByTestId('b');
    expect(document.activeElement).toBe(button);
    advance(1000);
    expect(tipOpen()).toBe(true);
  });

  // C2: as C, with the button's own ref callback taking focus in that commit.
  it('tips an icon-only button whose ref callback focuses it in the commit that turns its tip on', () => {
    const tree = (on: boolean) => (
      <Button.Root aria-label="Close" tooltip={on} ref={(el: HTMLElement | null) => (on ? el?.focus() : undefined)}>
        <Button.Icon>x</Button.Icon>
      </Button.Root>
    );
    const { rerender } = render(tree(true));
    const button = screen.getByRole('button', { name: 'Close' });
    act(() => button.blur());
    fireEvent.pointerEnter(button);
    advance(1000);
    expect(tipOpen()).toBe(true);
    fireEvent.pointerLeave(button);
    advance(1000);
    act(() => {
      rerender(tree(false));
    });
    fireEvent.keyDown(document.body, { key: 'Enter' });
    act(() => {
      rerender(tree(true));
    });
    expect(document.activeElement).toBe(button);
    advance(1000);
    expect(tipOpen()).toBe(true);
  });

  // C3: a toolbar button that collapses from a label to its icon in the
  // commit where an earlier sibling's layout effect gives it keyboard focus.
  it('tips a button that turns icon-only in the commit an earlier sibling focuses it', () => {
    function Focuser({ on }: { on: boolean }) {
      useLayoutEffect(() => {
        if (on) (document.querySelector('[aria-label="Archive"]') as HTMLElement | null)?.focus();
      }, [on]);
      return null;
    }
    const tree = (narrow: boolean) => (
      <>
        <Focuser on={narrow} />
        <Button.Root aria-label="Archive">
          <Button.Icon>+</Button.Icon>
          {narrow ? null : 'Archive'}
        </Button.Root>
      </>
    );
    // Icon-only first, reached once by pointer, then a label.
    const { rerender } = render(tree(true));
    const button = screen.getByRole('button', { name: 'Archive' });
    act(() => button.blur());
    fireEvent.pointerEnter(button);
    advance(1000);
    expect(tipOpen()).toBe(true);
    fireEvent.pointerLeave(button);
    advance(1000);
    act(() => {
      rerender(tree(false));
    });
    expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull();
    fireEvent.keyDown(document.body, { key: 'Enter' });
    act(() => {
      rerender(tree(true));
    });
    expect(document.activeElement).toBe(button);
    advance(1000);
    expect(tipOpen()).toBe(true);
  });
});
