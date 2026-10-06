import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useRef, useState, type RefObject } from 'react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as api from '../index';
import {
  usePopover,
  type PopoverTriggerUserProps,
  type PopoverWire,
  type UsePopoverOptions,
  type UsePopoverResult,
} from './usePopover';

afterEach(cleanup);

function Harness({
  label = 'Open',
  ...options
}: UsePopoverOptions & { label?: string }) {
  const popover = usePopover(options);
  const wire = popover.getPopoverProps();
  return (
    <>
      <button type="button" {...popover.getTriggerProps()}>
        {label}
      </button>
      <div
        id={wire.id}
        ref={wire.ref}
        style={wire.style}
        aria-label="Menu"
        onPointerDown={wire.onPointerDown}
        onClick={wire.onClick}
      >
        Hello
      </div>
    </>
  );
}

describe('usePopover exports', () => {
  it('a trigger whose own click prevents its default still toggles', () => {
    function Link() {
      const popover = usePopover();
      return (
        <a href="#x" {...popover.getTriggerProps({ onClick: (event) => event.preventDefault() })}>
          Open
        </a>
      );
    }
    render(<Link />);
    const link = screen.getByText('Open');
    fireEvent.click(link);
    expect(link.getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps each ref stable when the getter is used on two elements', () => {
    const a = vi.fn();
    const b = vi.fn();
    function Two({ tick }: { tick: number }) {
      const popover = usePopover();
      return (
        <div data-tick={tick}>
          <button type="button" {...popover.getTriggerProps({ ref: a })}>
            A
          </button>
          <button type="button" {...popover.getTriggerProps({ ref: b })}>
            B
          </button>
        </div>
      );
    }
    const { rerender } = render(<Two tick={1} />);
    rerender(<Two tick={2} />);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("keeps another overlay's anchor name on the trigger", () => {
    let style: Record<string, unknown> = {};
    function Probe() {
      const popover = usePopover();
      style = popover.getTriggerProps({ style: { anchorName: '--other' } }).style as unknown as Record<string, unknown>;
      return null;
    }
    render(<Probe />);
    expect(String(style.anchorName)).toMatch(/^--other, --todae-popover-/);
  });

  it('exports the hook and prop getters', () => {
    expect(api.usePopover).toBe(usePopover);
    expectTypeOf<UsePopoverResult>().toHaveProperty('getTriggerProps');
    expectTypeOf<UsePopoverResult>().toHaveProperty('getPopoverProps');
    expectTypeOf<UsePopoverOptions>().toHaveProperty('enabled');
    expectTypeOf<PopoverWire>().toHaveProperty('onPointerDown');
    expectTypeOf<PopoverWire>().toHaveProperty('onClick');
  });
});

describe('usePopover haspopup', () => {
  it('defaults to dialog and takes listbox or menu', () => {
    const { rerender } = render(<Harness />);
    expect(screen.getByRole('button').getAttribute('aria-haspopup')).toBe('dialog');
    rerender(<Harness haspopup="listbox" />);
    expect(screen.getByRole('button').getAttribute('aria-haspopup')).toBe('listbox');
    rerender(<Harness haspopup="menu" />);
    expect(screen.getByRole('button').getAttribute('aria-haspopup')).toBe('menu');
  });
});

describe('usePopover', () => {
  it('toggles from the trigger with reason trigger', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<Harness open={false} onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-controls')).toBe(screen.getByLabelText('Menu').id);
    fireEvent.click(trigger);
    expect(onOpenChange).toHaveBeenCalledWith(true, 'trigger');
    rerender(<Harness open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(onOpenChange).toHaveBeenCalledWith(false, 'trigger');
  });

  it('requests close on Escape and outside without hiding', () => {
    const onOpenChange = vi.fn();
    render(<Harness open onOpenChange={onOpenChange} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false, 'escape');
    fireEvent.pointerDown(document.body);
    expect(onOpenChange).toHaveBeenCalledWith(false, 'outside');
  });

  it('ignores outside presses on the trigger and content', () => {
    const onOpenChange = vi.fn();
    render(<Harness open onOpenChange={onOpenChange} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Open' }));
    fireEvent.pointerDown(screen.getByLabelText('Menu'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('treats composedPath hits as inside the popover', () => {
    const onOpenChange = vi.fn();
    render(<Harness open onOpenChange={onOpenChange} />);
    const content = screen.getByLabelText('Menu');
    const event = new PointerEvent('pointerdown', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'target', { configurable: true, value: document.body });
    vi.spyOn(event, 'composedPath').mockReturnValue([content, document.body, document]);
    document.dispatchEvent(event);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('sets CSS anchor-name on anchorRef', () => {
    function AnchorHarness() {
      const anchorRef = useRef<HTMLDivElement>(null);
      usePopover({ open: true, anchorRef });
      return <div ref={anchorRef} data-testid="anchor" />;
    }
    render(<AnchorHarness />);
    const anchor = screen.getByTestId('anchor');
    expect(anchor.style.getPropertyValue('anchor-name')).toMatch(/^--todae-popover-/);
    expect(anchor.style.getPropertyValue('--todae-popover-anchor')).toMatch(/^--todae-popover-/);
    expect(anchor.style.getPropertyValue('anchor-name')).toBe(
      anchor.style.getPropertyValue('--todae-popover-anchor'),
    );
  });

  it('keeps the anchor variable on a popover still anchored, whichever unmounts first', () => {
    function Anchored({ anchorRef }: { anchorRef: RefObject<HTMLDivElement | null> }) {
      usePopover({ open: true, anchorRef });
      return null;
    }
    function Shared({ a, b }: { a: boolean; b: boolean }) {
      const anchorRef = useRef<HTMLDivElement>(null);
      return (
        <>
          <div ref={anchorRef} data-testid="anchor" />
          {a && <Anchored anchorRef={anchorRef} />}
          {b && <Anchored anchorRef={anchorRef} />}
        </>
      );
    }
    const variable = () => screen.getByTestId('anchor').style.getPropertyValue('--todae-popover-anchor');
    const names = () => screen.getByTestId('anchor').style.getPropertyValue('anchor-name').split(', ');
    let { rerender } = render(<Shared a b />);
    const [, second] = names();
    expect(variable()).toBe(second);
    // The first one goes: the second keeps the variable.
    rerender(<Shared a={false} b />);
    expect(names()).toEqual([second]);
    expect(variable()).toBe(second);
    cleanup();
    // The second one goes: the variable goes back to the first.
    ({ rerender } = render(<Shared a b />));
    const [first] = names();
    rerender(<Shared a b={false} />);
    expect(names()).toEqual([first]);
    expect(variable()).toBe(first);
  });

  it('uses a provided id on the surface', () => {
    render(<Harness id="menu-1" defaultOpen />);
    expect(screen.getByLabelText('Menu').id).toBe('menu-1');
    expect(screen.getByRole('button').getAttribute('aria-controls')).toBe('menu-1');
  });

  it('skips toggle and dismiss when enabled is false', () => {
    const onOpenChange = vi.fn();
    render(<Harness open enabled={false} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.pointerDown(document.body);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('calls the user click handler before toggle', () => {
    const user = vi.fn();
    function UserClick() {
      const popover = usePopover();
      return (
        <button
          type="button"
          {...popover.getTriggerProps({ onClick: user } satisfies PopoverTriggerUserProps)}
        >
          Open
        </button>
      );
    }
    render(<UserClick />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(user).toHaveBeenCalledTimes(1);
  });

  it('focuses the trigger after an outside press blurs to the body', () => {
    function CloseHarness() {
      const [open, setOpen] = useState(true);
      return <Harness open={open} onOpenChange={(next) => setOpen(next)} />;
    }
    render(<CloseHarness />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.focus();
    fireEvent.pointerDown(document.body);
    trigger.blur();
    expect(document.activeElement).toBe(document.body);
    fireEvent.pointerUp(document.body);
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps focus on a focusable element outside the popover', () => {
    function CloseHarness() {
      const [open, setOpen] = useState(true);
      return <Harness open={open} onOpenChange={(next) => setOpen(next)} />;
    }
    render(<CloseHarness />);
    const other = document.createElement('button');
    other.type = 'button';
    other.textContent = 'Other';
    document.body.appendChild(other);
    fireEvent.pointerDown(other);
    other.focus();
    fireEvent.pointerUp(other);
    expect(document.activeElement).toBe(other);
    other.remove();
  });

  it('returns click-through guards on the wire', () => {
    const { result } = renderHook(() => usePopover());
    const wire = result.current.getPopoverProps();
    const event = { stopPropagation: vi.fn() };
    wire.onPointerDown(event as never);
    wire.onClick(event as never);
    expect(event.stopPropagation).toHaveBeenCalledTimes(2);
  });
});
