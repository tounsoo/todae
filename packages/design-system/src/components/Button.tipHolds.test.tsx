import { StrictMode, useRef } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Button } from './Button.js';
import { Coachmark } from './Coachmark.js';
import { usePopover } from '../hooks/usePopover.js';
import { resetTooltipWarmth } from '../overlay/tooltipWarmth.js';

// How a Button's lazily mounted tip takes, keeps and drops the holds that
// reach it, and what it leaves on the button's style.

const tipOpen = () => screen.queryByRole('tooltip', { hidden: true })?.hasAttribute('data-open') ?? false;
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

function cut(button: HTMLElement) {
  const label = button.querySelector('span') as HTMLElement;
  Object.defineProperty(label, 'scrollWidth', { configurable: true, value: 120 });
  Object.defineProperty(label, 'clientWidth', { configurable: true, value: 40 });
}

let finishScale: () => void = () => undefined;
// A running scale transition on `box`, as a popover growing open has.
function scaling(box: Element) {
  const anim = {
    playState: 'running' as AnimationPlayState,
    transitionProperty: 'scale',
    effect: { target: box, pseudoElement: null, getComputedTiming: () => ({ endTime: 160 }), getKeyframes: () => [] },
    finished: new Promise<void>((resolve) => {
      finishScale = () => {
        anim.playState = 'finished';
        resolve();
      };
    }),
  };
  Object.defineProperty(document, 'getAnimations', {
    configurable: true,
    value: () => (anim.playState === 'running' ? [anim] : []),
  });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  resetTooltipWarmth();
  vi.useRealTimers();
  delete (document as unknown as { getAnimations?: unknown }).getAnimations;
});

describe('Button tip holds', () => {
  it.each([false, true])('opens an icon-only tip for first keyboard focus once its box stops scaling (StrictMode %s)', async (strict) => {
    const tree = (
      <div data-testid="box">
        <Button.Root aria-label="Archive">
          <Button.Icon>+</Button.Icon>
        </Button.Root>
      </div>
    );
    render(strict ? <StrictMode>{tree}</StrictMode> : tree);
    scaling(screen.getByTestId('box'));
    const button = screen.getByRole('button', { name: 'Archive' });
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => button.focus());
    await act(async () => {
      vi.advanceTimersByTime(10);
      finishScale();
      for (let i = 0; i < 6; i++) await Promise.resolve();
    });
    advance(1000);
    expect(tipOpen()).toBe(true);
  });

  it('keeps a cut-label tip closed by Escape from coming back when a new cut label is hovered and left', () => {
    const { rerender } = render(<Button.Root>Save every archived thread</Button.Root>);
    const button = screen.getByRole('button');
    cut(button);
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => button.focus());
    expect(tipOpen()).toBe(true);
    fireEvent.keyDown(button, { key: 'Escape' });
    advance(500);
    expect(tipOpen()).toBe(false);
    rerender(<Button.Root>Saved every archived thread</Button.Root>);
    fireEvent.pointerEnter(button);
    advance(1000);
    fireEvent.pointerLeave(button);
    advance(1000);
    expect(tipOpen()).toBe(false);
  });

  // An icon-only Save that shows a spinner while it saves, so its tip
  // unmounts and mounts again.
  function Save({ busy }: { busy: boolean }) {
    return <Button.Root aria-label="Save">{busy ? <svg data-spinner="" /> : <Button.Icon>s</Button.Icon>}</Button.Root>;
  }

  it.each(['focus', 'hover'] as const)('keeps a tip closed by Escape closed through a spinner while %s stays', (hold) => {
    const { rerender } = render(<Save busy={false} />);
    const button = screen.getByRole('button', { name: 'Save' });
    if (hold === 'focus') {
      fireEvent.keyDown(document, { key: 'Tab' });
      act(() => button.focus());
    } else fireEvent.pointerEnter(button);
    advance(1000);
    expect(tipOpen()).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    advance(1000);
    rerender(<Save busy />);
    advance(1000);
    rerender(<Save busy={false} />);
    advance(1000);
    expect(tipOpen()).toBe(false);
  });
});

describe('Button tip anchor names', () => {
  function Tour({ iconOnly }: { iconOnly: boolean }) {
    const target = useRef<HTMLButtonElement>(null);
    return (
      <>
        {iconOnly ? (
          <Button.Root ref={target} aria-label="Archive">
            <Button.Icon>+</Button.Icon>
          </Button.Root>
        ) : (
          <Button.Root ref={target}>Save every archived thread</Button.Root>
        )}
        <Coachmark.Root targetRef={target} defaultOpen>
          <Coachmark.Title>New</Coachmark.Title>
          <Coachmark.Footer>
            <Coachmark.Close>Got it</Coachmark.Close>
          </Coachmark.Footer>
        </Coachmark.Root>
      </>
    );
  }

  it.each([true, false])('keeps the anchor name a Coachmark adds when its tip mounts (icon-only %s)', (iconOnly) => {
    render(<Tour iconOnly={iconOnly} />);
    const button = screen.getAllByRole('button')[0]!;
    if (!iconOnly) cut(button);
    fireEvent.pointerEnter(button);
    advance(1000);
    expect(tipOpen()).toBe(true);
    expect(button.style.getPropertyValue('anchor-name')).toMatch(/--todae-coachmark-/);
  });

  it('keeps the anchor name a popover anchored by ref adds when its tip mounts', () => {
    function Anchored() {
      const anchorRef = useRef<HTMLButtonElement>(null);
      usePopover({ open: true, anchorRef });
      return (
        <Button.Root ref={anchorRef} aria-label="Filter">
          <Button.Icon>f</Button.Icon>
        </Button.Root>
      );
    }
    render(<Anchored />);
    const button = screen.getByRole('button', { name: 'Filter' });
    fireEvent.pointerEnter(button);
    advance(1000);
    expect(button.style.getPropertyValue('anchor-name')).toMatch(/--todae-popover-/);
  });
});
