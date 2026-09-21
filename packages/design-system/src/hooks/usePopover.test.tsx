import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useRef } from 'react';
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
  it('exports the hook and prop getters', () => {
    expect(api.usePopover).toBe(usePopover);
    expectTypeOf<UsePopoverResult>().toHaveProperty('getTriggerProps');
    expectTypeOf<UsePopoverResult>().toHaveProperty('getPopoverProps');
    expectTypeOf<UsePopoverOptions>().toHaveProperty('enabled');
    expectTypeOf<PopoverWire>().toHaveProperty('onPointerDown');
    expectTypeOf<PopoverWire>().toHaveProperty('onClick');
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

  it('returns click-through guards on the wire', () => {
    const { result } = renderHook(() => usePopover());
    const wire = result.current.getPopoverProps();
    const event = { stopPropagation: vi.fn() };
    wire.onPointerDown(event as never);
    wire.onClick(event as never);
    expect(event.stopPropagation).toHaveBeenCalledTimes(2);
  });
});
