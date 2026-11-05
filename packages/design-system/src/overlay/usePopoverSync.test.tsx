import { act, cleanup, render } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { reshowHeldInside, usePopoverSync } from './usePopoverSync.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Held({ name, open, children }: { name: string; open: boolean; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  usePopoverSync(ref, open);
  return (
    <div ref={ref} popover="manual" data-name={name}>
      {children}
    </div>
  );
}

function trackCalls() {
  const calls: string[] = [];
  const show = HTMLElement.prototype.showPopover;
  const hide = HTMLElement.prototype.hidePopover;
  vi.spyOn(HTMLElement.prototype, 'showPopover').mockImplementation(function (this: HTMLElement) {
    calls.push(`show ${this.dataset.name ?? '?'}`);
    show.call(this);
  });
  vi.spyOn(HTMLElement.prototype, 'hidePopover').mockImplementation(function (this: HTMLElement) {
    calls.push(`hide ${this.dataset.name ?? '?'}`);
    hide.call(this);
  });
  return calls;
}

describe('reshowHeldInside', () => {
  it('hides and shows again each popover React holds open inside the layer, in DOM order', () => {
    const { getByTestId } = render(
      <div data-testid="layer">
        <Held name="a" open>
          <Held name="b" open />
        </Held>
        <Held name="closed" open={false} />
        <div popover="manual" data-name="foreign" data-popover-open="" />
        <Held name="c" open />
      </div>,
    );
    const calls = trackCalls();
    reshowHeldInside(getByTestId('layer'));
    expect(calls).toEqual(['hide a', 'show a', 'hide b', 'show b', 'hide c', 'show c']);
  });

  it('shows again one that a move hid, and leaves those outside the layer alone', () => {
    const { getByTestId } = render(
      <>
        <div data-testid="layer">
          <Held name="inside" open />
        </div>
        <Held name="outside" open />
      </>,
    );
    const inside = document.querySelector<HTMLElement>('[data-name="inside"]')!;
    // A move hides it with no toggle event, so React still holds it open.
    inside.removeAttribute('data-popover-open');
    const calls = trackCalls();
    reshowHeldInside(getByTestId('layer'));
    expect(calls).toEqual(['show inside']);
    expect(inside.hasAttribute('data-popover-open')).toBe(true);
  });

  it('stops holding a popover once it closes', () => {
    const { getByTestId, rerender } = render(
      <div data-testid="layer">
        <Held name="a" open />
      </div>,
    );
    rerender(
      <div data-testid="layer">
        <Held name="a" open={false} />
      </div>,
    );
    const calls = trackCalls();
    reshowHeldInside(getByTestId('layer'));
    expect(calls).toEqual([]);
  });
});

describe('usePopoverSync with presence', () => {
  function Moving({ open, onExited }: { open: boolean; onExited?: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    usePopoverSync(ref, open, { onExited });
    return <div ref={ref} popover="manual" data-testid="p" />;
  }

  const frames = () =>
    new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

  // jsdom reads no stylesheet, so supply the exit fade the browser would.
  function fade(ms: string | null) {
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element, pseudo?: string | null) => {
      const style = real(el, pseudo);
      if (ms === null || !(el instanceof HTMLElement) || el.dataset.testid !== 'p') return style;
      return Object.assign(Object.create(style), {
        transitionProperty: 'opacity, scale',
        transitionDuration: ms,
        transitionDelay: '0s',
      }) as CSSStyleDeclaration;
    });
  }

  const endFade = (el: HTMLElement) =>
    act(() => {
      el.dispatchEvent(Object.assign(new Event('transitionend'), { propertyName: 'opacity' }));
    });

  it('shows first and marks it entered two frames later, so it transitions in', async () => {
    const { getByTestId } = render(<Moving open />);
    const el = getByTestId('p');
    expect(el.hasAttribute('data-popover-open')).toBe(true);
    expect(el.hasAttribute('data-entered')).toBe(false);
    expect(el.hasAttribute('data-todae-entering')).toBe(true);
    await act(frames);
    expect(el.hasAttribute('data-entered')).toBe(true);
    expect(el.hasAttribute('data-todae-entering')).toBe(false);
  });

  it('hides at once and tells when it closes inside those frames, never drawn', () => {
    fade('0.2s');
    const onExited = vi.fn();
    const { getByTestId, rerender } = render(<Moving open onExited={onExited} />);
    rerender(<Moving open={false} onExited={onExited} />);
    const el = getByTestId('p');
    expect(el.hasAttribute('data-todae-entering')).toBe(false);
    expect(el.hasAttribute('data-popover-open')).toBe(false);
    expect(el.inert).toBe(false);
    expect(onExited).toHaveBeenCalledTimes(1);
  });

  it('keeps an inert its owner set through a close and a reopen', async () => {
    fade('0.2s');
    function Owned({ open }: { open: boolean }) {
      const ref = useRef<HTMLDivElement>(null);
      usePopoverSync(ref, open, {});
      return <div ref={ref} popover="manual" data-testid="p" inert />;
    }
    const { getByTestId, rerender } = render(<Owned open />);
    const el = getByTestId('p');
    await act(frames);
    rerender(<Owned open={false} />);
    rerender(<Owned open />);
    expect(el.inert).toBe(true);
    rerender(<Owned open={false} />);
    endFade(el);
    expect(el.inert).toBe(true);
  });

  it('fades again after turning back from a close that lost its anchor', async () => {
    fade('0.2s');
    const { getByTestId, rerender } = render(<Moving open />);
    const el = getByTestId('p');
    await act(frames);
    rerender(<Moving open={false} />);
    el.setAttribute('data-todae-unanchored', '');
    rerender(<Moving open />);
    expect(el.hasAttribute('data-todae-unanchored')).toBe(false);
  });

  it('stays shown and inert through its exit fade, then hides and tells', async () => {
    fade('0.2s');
    const onExited = vi.fn();
    const { getByTestId, rerender } = render(<Moving open onExited={onExited} />);
    const el = getByTestId('p');
    await act(frames);
    rerender(<Moving open={false} onExited={onExited} />);
    expect(el.hasAttribute('data-popover-open')).toBe(true);
    expect(el.hasAttribute('data-entered')).toBe(false);
    expect(el.hasAttribute('data-todae-exiting')).toBe(true);
    expect(el.inert).toBe(true);
    expect(onExited).not.toHaveBeenCalled();
    endFade(el);
    expect(el.hasAttribute('data-popover-open')).toBe(false);
    expect(el.hasAttribute('data-todae-exiting')).toBe(false);
    expect(el.inert).toBe(false);
    expect(onExited).toHaveBeenCalledTimes(1);
  });

  it('turns back where it is when opened again inside the fade', async () => {
    fade('0.2s');
    const onExited = vi.fn();
    const { getByTestId, rerender } = render(<Moving open onExited={onExited} />);
    const el = getByTestId('p');
    await act(frames);
    rerender(<Moving open={false} onExited={onExited} />);
    const calls = trackCalls();
    rerender(<Moving open onExited={onExited} />);
    expect(calls).toEqual([]);
    expect(el.hasAttribute('data-entered')).toBe(true);
    expect(el.hasAttribute('data-todae-exiting')).toBe(false);
    expect(el.inert).toBe(false);
    endFade(el);
    expect(el.hasAttribute('data-popover-open')).toBe(true);
    expect(onExited).not.toHaveBeenCalled();
  });

  it('holds still once its fade in ends, so Safari has no transition to run again', async () => {
    fade('0.2s');
    const { getByTestId, rerender } = render(<Moving open />);
    const el = getByTestId('p');
    await act(frames);
    expect(el.hasAttribute('data-todae-settled')).toBe(false);
    endFade(el);
    expect(el.hasAttribute('data-todae-settled')).toBe(true);
    rerender(<Moving open={false} />);
    expect(el.hasAttribute('data-todae-settled')).toBe(false);
    expect(el.hasAttribute('data-todae-exiting')).toBe(true);
  });

  it('holds still at once when it has no fade in', async () => {
    fade(null);
    const { getByTestId } = render(<Moving open />);
    const el = getByTestId('p');
    expect(el.hasAttribute('data-todae-settled')).toBe(false);
    await act(frames);
    expect(el.hasAttribute('data-todae-settled')).toBe(true);
  });

  it('holds still after turning back inside the exit fade', async () => {
    fade('0.2s');
    const { getByTestId, rerender } = render(<Moving open />);
    const el = getByTestId('p');
    await act(frames);
    rerender(<Moving open={false} />);
    rerender(<Moving open />);
    expect(el.hasAttribute('data-todae-settled')).toBe(false);
    endFade(el);
    expect(el.hasAttribute('data-todae-settled')).toBe(true);
  });

  it('never holds still once it closes inside its fade in', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      fade('0.2s');
      const { getByTestId, rerender } = render(<Moving open />);
      const el = getByTestId('p');
      await act(frames);
      rerender(<Moving open={false} />);
      // The fade in's own timer would have run out by now.
      act(() => vi.advanceTimersByTime(250));
      expect(el.hasAttribute('data-todae-settled')).toBe(false);
      expect(el.hasAttribute('data-popover-open')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  function Layer({
    name,
    open,
    onExited,
    children,
  }: {
    name: string;
    open: boolean;
    onExited?: () => void;
    children?: ReactNode;
  }) {
    const ref = useRef<HTMLDivElement>(null);
    usePopoverSync(ref, open, { onExited });
    return (
      <div ref={ref} popover="manual" data-testid="p" data-name={name}>
        {children}
      </div>
    );
  }

  it('ends the fade of a popover still fading inside it, which goes first, as it hides', async () => {
    fade('0.2s');
    const onInnerExited = vi.fn();
    // A submenu that closes with its menu: both fade, each on its own clock.
    const tree = (open: boolean) => (
      <Layer name="menu" open={open}>
        <Layer name="submenu" open={open} onExited={onInnerExited} />
      </Layer>
    );
    const { container, rerender } = render(tree(true));
    const menu = container.querySelector<HTMLElement>('[data-name="menu"]')!;
    const submenu = container.querySelector<HTMLElement>('[data-name="submenu"]')!;
    await act(frames);
    rerender(tree(false));
    expect(submenu.hasAttribute('data-todae-exiting')).toBe(true);
    const calls = trackCalls();
    endFade(menu);
    expect(calls).toEqual(['hide submenu', 'hide menu']);
    expect(submenu.hasAttribute('data-todae-exiting')).toBe(false);
    expect(submenu.inert).toBe(false);
    expect(onInnerExited).toHaveBeenCalledTimes(1);
    // Its own fade ending afterwards tells nothing more.
    endFade(submenu);
    expect(onInnerExited).toHaveBeenCalledTimes(1);
  });

  it('ends the fade of a popover inside it when it hides at once, never drawn', async () => {
    fade('0.2s');
    const tree = (open: boolean, inner: boolean) => (
      <Layer name="menu" open={open}>
        <Layer name="submenu" open={inner} />
      </Layer>
    );
    const { container, rerender } = render(tree(true, true));
    const menu = container.querySelector<HTMLElement>('[data-name="menu"]')!;
    const submenu = container.querySelector<HTMLElement>('[data-name="submenu"]')!;
    await act(frames);
    // The inner one's owner holds it open while the outer one closes, then
    // the outer one shows again and both close inside its first frames.
    rerender(tree(false, true));
    endFade(menu);
    rerender(tree(true, true));
    const calls = trackCalls();
    rerender(tree(false, false));
    expect(calls).toEqual(['hide submenu', 'hide menu']);
    expect(submenu.hasAttribute('data-todae-exiting')).toBe(false);
  });

  it('leaves a popover inside it to its own fade while it is still shown', async () => {
    fade('0.2s');
    const onInnerExited = vi.fn();
    const tree = (open: boolean, inner: boolean) => (
      <Layer name="menu" open={open}>
        <Layer name="submenu" open={inner} onExited={onInnerExited} />
      </Layer>
    );
    const { container, rerender } = render(tree(true, true));
    const submenu = container.querySelector<HTMLElement>('[data-name="submenu"]')!;
    await act(frames);
    rerender(tree(true, false));
    expect(submenu.hasAttribute('data-popover-open')).toBe(true);
    endFade(submenu);
    expect(submenu.hasAttribute('data-popover-open')).toBe(false);
    expect(container.querySelector('[data-name="menu"]')!.hasAttribute('data-popover-open')).toBe(true);
    expect(onInnerExited).toHaveBeenCalledTimes(1);
  });

  it('hides at once and tells when it has no fade', async () => {
    fade(null);
    const onExited = vi.fn();
    const { getByTestId, rerender } = render(<Moving open onExited={onExited} />);
    await act(frames);
    rerender(<Moving open={false} onExited={onExited} />);
    expect(getByTestId('p').hasAttribute('data-popover-open')).toBe(false);
    expect(onExited).toHaveBeenCalledTimes(1);
  });

  it('tells nothing for a first render closed', () => {
    const onExited = vi.fn();
    render(<Moving open={false} onExited={onExited} />);
    expect(onExited).not.toHaveBeenCalled();
  });

  it('hides at once without presence, as a tooltip does', () => {
    fade('0.2s');
    const { rerender } = render(<Held name="tip" open />);
    rerender(<Held name="tip" open={false} />);
    expect(document.querySelector('[data-name="tip"]')!.hasAttribute('data-popover-open')).toBe(false);
  });
});
