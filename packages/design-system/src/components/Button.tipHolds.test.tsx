import { StrictMode, useRef, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Button } from './Button.js';
import { Coachmark } from './Coachmark.js';
import { usePopover } from '../hooks/usePopover.js';
import { resetInputModality } from '../internal/inputModality.js';
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

beforeEach(() => {
  vi.useFakeTimers();
  resetInputModality();
});
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

  it('shows a second icon-only tip warm, at once, when the pointer moves on from an open one under StrictMode', () => {
    render(
      <StrictMode>
        {['A', 'B'].map((name) => (
          <Button.Root key={name} aria-label={name}>
            <Button.Icon>+</Button.Icon>
          </Button.Root>
        ))}
      </StrictMode>,
    );
    const [a, b] = screen.getAllByRole('button');
    fireEvent.pointerEnter(a!);
    advance(1000);
    fireEvent.pointerLeave(a!, { relatedTarget: b });
    fireEvent.pointerEnter(b!);
    advance(0);
    const tip = [...document.querySelectorAll('[role="tooltip"]')].find((el) => el.textContent === 'B')!;
    expect(tip.hasAttribute('data-open')).toBe(true);
    expect(tip.hasAttribute('data-todae-warm')).toBe(true);
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

  it('takes no focus hold later for focus a script moved after a press', () => {
    // An icon-only toggle that shows a word while it works, then its icon again.
    const Pin = ({ busy }: { busy: boolean }) => (
      <Button.Root aria-label="Pin">{busy ? 'Pinning' : <Button.Icon>p</Button.Icon>}</Button.Root>
    );
    const { rerender } = render(<Pin busy={false} />);
    const button = screen.getByRole('button', { name: 'Pin' });
    fireEvent.pointerDown(document.body);
    act(() => button.focus());
    advance(1000);
    expect(tipOpen()).toBe(false);
    fireEvent.keyDown(button, { key: 'Enter' });
    rerender(<Pin busy />);
    advance(1000);
    rerender(<Pin busy={false} />);
    advance(1000);
    expect(tipOpen()).toBe(false);
  });

  it('takes no hover a press spent before the tip showed when a word the button showed while working turns back to its icon', () => {
    // A word, not an svg, while it works, so its tip handlers stay on.
    const Pin = ({ busy }: { busy: boolean }) => (
      <Button.Root aria-label="Pin">{busy ? 'Pinning' : <Button.Icon>p</Button.Icon>}</Button.Root>
    );
    const { rerender } = render(<Pin busy={false} />);
    const button = screen.getByRole('button', { name: 'Pin' });
    fireEvent.pointerEnter(button);
    advance(100);
    fireEvent.pointerDown(button);
    fireEvent.click(button);
    rerender(<Pin busy />);
    advance(3000);
    rerender(<Pin busy={false} />);
    advance(3000);
    expect(tipOpen()).toBe(false);
  });

  it('keeps a cut label tip open by keyboard focus when the button collapses to its icon', () => {
    const Collapse = ({ small }: { small: boolean }) => (
      <Button.Root aria-label="Collapse the sidebar">{small ? <Button.Icon>c</Button.Icon> : 'Collapse the sidebar'}</Button.Root>
    );
    const { rerender } = render(<Collapse small={false} />);
    const button = screen.getByRole('button');
    cut(button);
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => button.focus());
    expect(tipOpen()).toBe(true);
    fireEvent.keyDown(button, { key: 'Enter' });
    rerender(<Collapse small />);
    advance(1000);
    expect(document.activeElement).toBe(button);
    expect(tipOpen()).toBe(true);
    expect(screen.getByRole('tooltip', { hidden: true }).textContent).toBe('Collapse the sidebar');
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
  function Tour({ label = false, tooltip = true }: { label?: boolean; tooltip?: boolean }) {
    const target = useRef<HTMLButtonElement>(null);
    return (
      <>
        {label ? (
          <Button.Root ref={target} tooltip={tooltip}>
            Save every archived thread
          </Button.Root>
        ) : (
          <Button.Root ref={target} aria-label="Archive" tooltip={tooltip}>
            <Button.Icon>+</Button.Icon>
          </Button.Root>
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

  it.each([
    ['an icon-only', false],
    ['a cut-label', true],
  ])('keeps the anchor name a Coachmark adds when %s tip mounts', (_, label) => {
    render(<Tour label={label} />);
    const button = screen.getAllByRole('button')[0]!;
    if (label) cut(button);
    fireEvent.pointerEnter(button);
    advance(1000);
    expect(tipOpen()).toBe(true);
    expect(button.style.getPropertyValue('anchor-name')).toMatch(/--todae-coachmark-/);
  });

  it('puts no style on a Button nothing has reached, in the server markup or after it mounts', () => {
    const icon = (
      <Button.Root aria-label="Archive">
        <Button.Icon>+</Button.Icon>
      </Button.Root>
    );
    expect(renderToString(<Button.Root>Save</Button.Root>)).not.toContain('style');
    expect(renderToString(icon)).not.toContain('style');
    render(
      <>
        <Button.Root>Save</Button.Root>
        {icon}
      </>,
    );
    for (const button of screen.getAllByRole('button')) expect(button.getAttribute('style')).toBeNull();
  });

  it.each([
    ['turned on', false, true],
    ['turned off', true, false],
  ])('keeps the anchor name a Coachmark adds when the tip is %s', (_, from, to) => {
    const { rerender } = render(<Tour tooltip={from} />);
    const button = screen.getAllByRole('button')[0]!;
    if (from) {
      fireEvent.pointerEnter(button);
      advance(1000);
    }
    rerender(<Tour tooltip={to} />);
    expect(button.style.getPropertyValue('anchor-name')).toMatch(/--todae-coachmark-/);
  });

  it('keeps the anchor name a popover adds to an icon-only Button whose icon a product component wraps', () => {
    function MyIcon({ children }: { children: ReactNode }) {
      return <Button.Icon>{children}</Button.Icon>;
    }
    function Anchored() {
      const anchorRef = useRef<HTMLButtonElement>(null);
      usePopover({ open: true, anchorRef });
      return (
        <Button.Root ref={anchorRef} aria-label="Filter">
          <MyIcon>f</MyIcon>
        </Button.Root>
      );
    }
    render(<Anchored />);
    const button = screen.getByRole('button', { name: 'Filter' });
    fireEvent.pointerEnter(button);
    advance(1000);
    expect(tipOpen()).toBe(true);
    expect(button.style.getPropertyValue('anchor-name')).toMatch(/--todae-popover-/);
  });

  // A text Save that shows a spinner while it saves, as a Coachmark target.
  function SaveTour({ busy, tooltip }: { busy: boolean; tooltip: boolean }) {
    const target = useRef<HTMLButtonElement>(null);
    return (
      <>
        <Button.Root ref={target} tooltip={tooltip}>
          {busy ? <span aria-hidden>...</span> : 'Save'}
        </Button.Root>
        <Coachmark.Root targetRef={target} defaultOpen>
          <Coachmark.Title>New</Coachmark.Title>
          <Coachmark.Footer>
            <Coachmark.Close>Got it</Coachmark.Close>
          </Coachmark.Footer>
        </Coachmark.Root>
      </>
    );
  }

  it.each([
    ['its label turns into a spinner', { busy: true, tooltip: true }],
    ['its tip is turned off', { busy: false, tooltip: false }],
  ])('keeps the anchor name a Coachmark adds to a text Button when %s', (_, next) => {
    const { rerender } = render(<SaveTour busy={false} tooltip />);
    const button = screen.getAllByRole('button')[0]!;
    rerender(<SaveTour {...next} />);
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
