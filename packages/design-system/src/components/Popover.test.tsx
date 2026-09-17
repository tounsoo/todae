import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Option, OptionList } from './OptionList';
import { Popover } from './Popover';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'Popover.module.css'), 'utf8');

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

  it('stays non-modal and pins with a 4px gap when CSS anchors are missing', () => {
    const supports = vi.spyOn(CSS, 'supports').mockReturnValue(false);
    const onOpenChange = vi.fn();
    render(<Harness open onOpenChange={onOpenChange} />);
    const content = screen.getByLabelText('Menu');
    const trigger = screen.getByRole('button', { name: 'Open' }).parentElement as HTMLElement;
    expect(content.getAttribute('aria-modal')).toBeNull();
    expect(content.getAttribute('popover')).toBe('manual');
    expect(content.getAttribute('tabindex')).toBe('-1');
    const rect = vi.spyOn(trigger, 'getBoundingClientRect');
    rect.mockReturnValue({
      top: 80,
      bottom: 110,
      left: 16,
      right: 80,
      width: 64,
      height: 30,
      x: 16,
      y: 80,
      toJSON() {
        return {};
      },
    });
    let frame: FrameRequestCallback | undefined;
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frame = cb;
      return 1;
    });
    fireEvent.scroll(window);
    act(() => {
      frame?.(0);
    });
    expect(content.style.top).toBe('114px');
    expect(content.style.left).toBe('16px');
    rect.mockReturnValue({
      top: 40,
      bottom: 70,
      left: 16,
      right: 80,
      width: 64,
      height: 30,
      x: 16,
      y: 40,
      toJSON() {
        return {};
      },
    });
    fireEvent.scroll(window);
    act(() => {
      frame?.(0);
    });
    expect(content.style.top).toBe('74px');
    raf.mockRestore();
    supports.mockRestore();
  });

  it('does not pin when top: anchor(bottom) is supported', () => {
    const supports = vi.spyOn(CSS, 'supports').mockImplementation((query: string) => query === 'top: anchor(bottom)');
    const onOpenChange = vi.fn();
    render(<Harness open onOpenChange={onOpenChange} />);
    const content = screen.getByLabelText('Menu');
    expect(content.style.top).toBe('');
    expect(content.style.left).toBe('');
    supports.mockRestore();
  });

  it('owns the pointer on the popover box', () => {
    expect(css).toMatch(/position:\s*fixed/);
    expect(css).toMatch(/inset:\s*unset/);
    expect(css).toMatch(/pointer-events:\s*auto/);
  });

  it('does not click through to a control under the popover', () => {
    const supports = vi.spyOn(CSS, 'supports').mockReturnValue(false);
    const under = vi.fn();
    const onChange = vi.fn();
    function Through() {
      const [open, setOpen] = useState(true);
      return (
        <div>
          <button type="button" onClick={under}>
            Under
          </button>
          <Popover open={open} onOpenChange={setOpen}>
            <Popover.Trigger>Open</Popover.Trigger>
            <Popover.Content aria-label="Menu">
              <OptionList
                value={null}
                onChange={(value) => {
                  onChange(value);
                  setOpen(false);
                }}
              >
                <Option value="apple">Apple</Option>
              </OptionList>
            </Popover.Content>
          </Popover>
        </div>
      );
    }
    render(<Through />);
    const option = screen.getByRole('option', { name: 'Apple' });
    fireEvent.pointerDown(option);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Menu').hasAttribute('data-popover-open')).toBe(true);
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith('apple');
    expect(under).not.toHaveBeenCalled();
    supports.mockRestore();
  });
});
