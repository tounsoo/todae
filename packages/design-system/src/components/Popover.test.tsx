import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Popover } from './Popover';

afterEach(cleanup);

function Harness({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean, reason: string) => void;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger>Open</Popover.Trigger>
      <Popover.Content aria-label="Menu">Hello</Popover.Content>
    </Popover>
  );
}

describe('Popover', () => {
  it('calls showPopover when open and hidePopover only when open is false', () => {
    const show = vi.spyOn(HTMLElement.prototype, 'showPopover');
    const hide = vi.spyOn(HTMLElement.prototype, 'hidePopover');
    const onOpenChange = vi.fn();
    const { rerender } = render(<Harness open={false} onOpenChange={onOpenChange} />);
    expect(show).not.toHaveBeenCalled();
    rerender(<Harness open onOpenChange={onOpenChange} />);
    expect(show).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[popover="manual"]')?.hasAttribute('data-popover-open')).toBe(true);
    rerender(<Harness open={false} onOpenChange={onOpenChange} />);
    expect(hide).toHaveBeenCalledTimes(1);
    show.mockRestore();
    hide.mockRestore();
  });

  it('requests close on Escape and outside but hides only after open is false', () => {
    const hide = vi.spyOn(HTMLElement.prototype, 'hidePopover');
    const onOpenChange = vi.fn();
    render(<Harness open onOpenChange={onOpenChange} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false, 'escape');
    expect(hide).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.body);
    expect(onOpenChange).toHaveBeenCalledWith(false, 'outside');
    expect(hide).not.toHaveBeenCalled();
    hide.mockRestore();
  });

  it('ignores outside presses on the trigger and content', () => {
    const onOpenChange = vi.fn();
    render(<Harness open onOpenChange={onOpenChange} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Open' }));
    fireEvent.pointerDown(screen.getByLabelText('Menu'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

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

  it('stays non-modal and pins once when CSS anchors are missing', () => {
    const supports = vi.spyOn(CSS, 'supports').mockReturnValue(false);
    const onOpenChange = vi.fn();
    render(<Harness open onOpenChange={onOpenChange} />);
    const content = screen.getByLabelText('Menu');
    expect(content.getAttribute('aria-modal')).toBeNull();
    expect(content.getAttribute('popover')).toBe('manual');
    expect(content.getAttribute('tabindex')).toBe('-1');
    expect(content.style.top).toMatch(/px$/);
    expect(content.style.left).toMatch(/px$/);
    supports.mockRestore();
  });
});
