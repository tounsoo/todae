import { act, cleanup, render, screen } from '@testing-library/react';
import { useState, type CSSProperties } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Popover } from '../components/Popover.js';
import { usePopover } from '../hooks/usePopover.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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
