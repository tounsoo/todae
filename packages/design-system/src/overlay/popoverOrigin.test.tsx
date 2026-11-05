import { act, cleanup, render, screen } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import { useState, type CSSProperties } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Popover } from '../components/Popover.js';
import { usePopover } from '../hooks/usePopover.js';
import { anchorNamed } from './popoverOrigin.js';
import { useSurfaceClosed } from './surfaceContext.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

const box = (top: number, left: number, height: number, width: number) =>
  ({ top, left, bottom: top + height, right: left + width, height, width, x: left, y: top, toJSON() {} }) as DOMRect;

// The popover flipped above its anchor, left edges lined up.
function stubAbove() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute('popover')) return box(100, 20, 200, 160); // 100..300
    return box(304, 20, 30, 80); // anchor 304..334
  });
}
// The popover below its anchor.
function stubBelow() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute('popover')) return box(338, 20, 200, 160);
    return box(304, 20, 30, 80);
  });
}

describe('A popover grows from its anchor', () => {
  it('aims at the element it was placed by with the anchorName option', () => {
    stubAbove();
    function Harness() {
      const popover = usePopover({ defaultOpen: true, anchorName: '--word' });
      return (
        <>
          <span style={{ anchorName: '--word' } as CSSProperties}>@ann</span>
          <button type="button" {...popover.getTriggerProps()}>
            Open
          </button>
          <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="List">
            x
          </Popover.Root>
        </>
      );
    }
    render(<Harness />);
    const el = screen.getByRole('dialog', { name: 'List', hidden: true });
    // Sits above its anchor, so it should grow from its bottom edge.
    expect(el.style.getPropertyValue('--_origin')).toBe('left bottom');
  });

  it('grows from its bottom when it sits above its trigger', () => {
    stubAbove();
    function Harness() {
      const popover = usePopover({ defaultOpen: true });
      return (
        <>
          <button type="button" {...popover.getTriggerProps()}>
            Open
          </button>
          <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="C">
            x
          </Popover.Root>
        </>
      );
    }
    render(<Harness />);
    expect(screen.getByRole('dialog', { name: 'C', hidden: true }).style.getPropertyValue('--_origin')).toBe('left bottom');
  });

  it('shrinks back toward its trigger after flipping while open', () => {
    stubBelow();
    let setOpen: (open: boolean) => void = () => undefined;
    function Harness() {
      const [open, set] = useState(true);
      setOpen = set;
      const popover = usePopover({ open, onOpenChange: set });
      return (
        <>
          <button type="button" {...popover.getTriggerProps()}>
            Open
          </button>
          <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="P">
            x
          </Popover.Root>
        </>
      );
    }
    render(<Harness />);
    const el = screen.getByRole('dialog', { name: 'P', hidden: true });
    expect(el.style.getPropertyValue('--_origin')).toBe('left top');
    // A scroll flips it above its trigger (position-try), then it closes.
    vi.restoreAllMocks();
    stubAbove();
    act(() => setOpen(false));
    expect(el.style.getPropertyValue('--_origin')).toBe('left bottom');
  });
});

describe('anchorNamed', () => {
  it('does not match a name that is only a prefix of another', () => {
    document.body.innerHTML = '<span id="a" style="anchor-name: --word-2"></span><span id="b" style="anchor-name: --word"></span>';
    expect(anchorNamed(document.body, '--word')?.id).toBe('b');
  });

  it('matches one name in a list', () => {
    document.body.innerHTML = '<span id="a" style="anchor-name: --tip, --word"></span>';
    expect(anchorNamed(document.body, '--word')?.id).toBe('a');
  });

  it('like CSS, takes the last element carrying a duplicated name', () => {
    document.body.innerHTML = '<span id="a" style="anchor-name: --word"></span><span id="b" style="anchor-name: --word"></span>';
    expect(anchorNamed(document.body, '--word')?.id).toBe('b');
  });
});

describe('a popover inside a shadow root, placed by name', () => {
  it('aims at the named anchor beside it in the same shadow tree', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.hasAttribute('popover')) return box(100, 20, 200, 160); // It sits above its anchor.
      return box(304, 20, 30, 80);
    });
    const host = document.createElement('div');
    document.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    shadow.append(container);
    function Harness() {
      const popover = usePopover({ defaultOpen: true, anchorName: '--word' });
      return (
        <>
          <span style={{ anchorName: '--word' } as CSSProperties}>@ann</span>
          <button type="button" {...popover.getTriggerProps()}>
            Open
          </button>
          <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="List">
            x
          </Popover.Root>
        </>
      );
    }
    const root = createRoot(container);
    act(() => root.render(<Harness />));
    const el = shadow.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(el.style.getPropertyValue('--_origin')).toBe('left bottom');
    act(() => root.unmount());
  });
});

describe('A popover whose anchor goes away as it closes', () => {
  it('goes at once, and fades in again on its next open', () => {
    function Harness({ open }: { open: boolean }) {
      const popover = usePopover({ open, onOpenChange: () => undefined, anchorName: '--word' });
      return (
        <>
          {open && <span style={{ anchorName: '--word' } as CSSProperties}>@ann</span>}
          <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="List">
            x
          </Popover.Root>
        </>
      );
    }
    const { rerender } = render(<Harness open />);
    const el = screen.getByRole('dialog', { name: 'List', hidden: true });
    expect(el.hasAttribute('data-todae-unanchored')).toBe(false);
    rerender(<Harness open={false} />);
    expect(el.hasAttribute('data-todae-unanchored')).toBe(true);
    rerender(<Harness open />);
    expect(el.hasAttribute('data-todae-unanchored')).toBe(false);
  });

  it('keeps its fade while its anchor stays', () => {
    function Harness({ open }: { open: boolean }) {
      const popover = usePopover({ open, onOpenChange: () => undefined, anchorName: '--word' });
      return (
        <>
          <span style={{ anchorName: '--word' } as CSSProperties}>@ann</span>
          <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="List">
            x
          </Popover.Root>
        </>
      );
    }
    const { rerender } = render(<Harness open />);
    rerender(<Harness open={false} />);
    expect(screen.getByRole('dialog', { name: 'List', hidden: true }).hasAttribute('data-todae-unanchored')).toBe(false);
  });
});

describe('A popover whose caller stops naming its anchor as it closes', () => {
  it('keeps sitting at that anchor to fade out, and goes where it is told on its next open', () => {
    function Harness({ open, name }: { open: boolean; name: string | null }) {
      const popover = usePopover({ open, onOpenChange: () => undefined, anchorName: name });
      return (
        <>
          <span style={{ anchorName: '--word' } as CSSProperties}>@ann</span>
          <span style={{ anchorName: '--other' } as CSSProperties}>@bo</span>
          <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="Peek">
            x
          </Popover.Root>
        </>
      );
    }
    const { rerender } = render(<Harness open name="--word" />);
    const el = screen.getByRole('dialog', { name: 'Peek', hidden: true });
    rerender(<Harness open={false} name={null} />);
    expect(el.style.getPropertyValue('--todae-popover-anchor')).toBe('--word');
    expect(el.hasAttribute('data-todae-unanchored')).toBe(false);
    rerender(<Harness open name="--other" />);
    expect(el.style.getPropertyValue('--todae-popover-anchor')).toBe('--other');
  });

  it('goes at once when that anchor goes away while it fades', async () => {
    markAwareFade((el) => el.getAttribute('role') === 'dialog');
    function Harness({ open, word }: { open: boolean; word: boolean }) {
      const popover = usePopover({ open, onOpenChange: () => undefined, anchorName: open ? '--word' : null });
      return (
        <>
          {word ? <span style={{ anchorName: '--word' } as CSSProperties}>@ann</span> : null}
          <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="Peek">
            x
          </Popover.Root>
        </>
      );
    }
    const { rerender } = render(<Harness open word />);
    const el = screen.getByRole('dialog', { name: 'Peek', hidden: true });
    // Two frames in, it has entered, so closing fades it.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    rerender(<Harness open={false} word />);
    expect(el.hasAttribute('data-todae-exiting')).toBe(true);
    expect(el.hasAttribute('data-todae-unanchored')).toBe(false);
    rerender(<Harness open={false} word={false} />);
    expect(el.hasAttribute('data-todae-unanchored')).toBe(true);
    expect(el.hasAttribute('data-todae-exiting')).toBe(false);
  });
});

/** The computed exit a browser gives `.content`: a fade, or none once the lost-anchor mark is on. */
function markAwareFade(match: (el: HTMLElement) => boolean) {
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element, pseudo?: string | null) => {
    const style = real(el, pseudo);
    if (el instanceof HTMLElement && match(el)) {
      const none = el.hasAttribute('data-todae-unanchored');
      return Object.assign(Object.create(style), {
        transitionProperty: none ? 'none' : 'opacity, scale',
        transitionDuration: none ? '0s' : '0.16s',
        transitionDelay: '0s',
      }) as CSSStyleDeclaration;
    }
    return style;
  });
}

describe('A Popover whose trigger goes away as it closes', () => {
  function Closed({ onClosed }: { onClosed: () => void }) {
    useSurfaceClosed(onClosed);
    return <span>Body</span>;
  }
  function Owner({ open, withTrigger, onClosed }: { open: boolean; withTrigger: boolean; onClosed: () => void }) {
    const popover = usePopover({ open, onOpenChange: () => undefined });
    return (
      <>
        {withTrigger ? (
          <button type="button" {...popover.getTriggerProps()}>
            Open
          </button>
        ) : null}
        <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="Panel">
          <Closed onClosed={onClosed} />
        </Popover.Root>
      </>
    );
  }

  it('goes at once and reports closed when its fade is cut short', () => {
    vi.useFakeTimers();
    markAwareFade((el) => el.getAttribute('role') === 'dialog');
    const onClosed = vi.fn();
    const { rerender } = render(<Owner open withTrigger onClosed={onClosed} />);
    rerender(<Owner open={false} withTrigger={false} onClosed={onClosed} />);
    const el = screen.getByRole('dialog', { hidden: true });
    expect(el.hasAttribute('data-todae-unanchored')).toBe(true);
    // The mark cuts the fade short, which a browser reports as a cancel.
    act(() => {
      el.dispatchEvent(Object.assign(new Event('transitioncancel'), { propertyName: 'opacity' }));
    });
    expect(onClosed).toHaveBeenCalledTimes(1);
  });
});


describe('A Popover opened from code, with nothing to sit by', () => {
  it('keeps its fade as it closes', () => {
    function Bare({ open }: { open: boolean }) {
      const popover = usePopover({ open, onOpenChange: () => undefined });
      return (
        <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="Bare">
          x
        </Popover.Root>
      );
    }
    const { rerender } = render(<Bare open />);
    rerender(<Bare open={false} />);
    expect(screen.getByRole('dialog', { name: 'Bare', hidden: true }).hasAttribute('data-todae-unanchored')).toBe(false);
  });
});
