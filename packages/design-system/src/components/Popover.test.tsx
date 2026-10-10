import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState, type CSSProperties } from 'react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as api from '../index';
import { usePopover, type PopoverCloseReason, type UsePopoverOptions } from '../hooks/usePopover';
import { OptionList } from './OptionList';
import { Popover, type PopoverRootProps } from './Popover';
import type { PopoverWire } from './Popover.wire';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'Popover.tsx'), 'utf8');
const css = readFileSync(join(here, 'Popover.module.css'), 'utf8');

afterEach(cleanup);

function Harness({
  label = 'Open',
  children = 'Hello',
  ...options
}: UsePopoverOptions & { label?: string; children?: string }) {
  const popover = usePopover(options);
  return (
    <>
      <button type="button" {...popover.getTriggerProps()}>
        {label}
      </button>
      <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="Menu">
        {children}
      </Popover.Root>
    </>
  );
}

describe('Popover exports', () => {
  it('exports the surface and hard-cuts Trigger and Content', () => {
    expect(api.Popover).toBe(Popover);
    expect(api.usePopover).toBeDefined();
    expect(Popover).not.toHaveProperty('Trigger');
    expect(Popover).not.toHaveProperty('Content');
    expectTypeOf<PopoverRootProps>().toHaveProperty('id');
    expectTypeOf<PopoverRootProps>().toHaveProperty('open');
    expectTypeOf<PopoverRootProps>().toHaveProperty('ref');
    expectTypeOf<PopoverRootProps>().toHaveProperty('style');
    expectTypeOf<PopoverRootProps>().not.toHaveProperty('onOpenChange');
    expectTypeOf<PopoverRootProps>().not.toHaveProperty('enabled');
    expectTypeOf<PopoverRootProps>().not.toHaveProperty('anchorRef');
    expectTypeOf<PopoverRootProps>().not.toHaveProperty('defaultOpen');
    expectTypeOf<PopoverCloseReason>().toEqualTypeOf<'escape' | 'outside' | 'trigger'>();
  });
});

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

  it('stays non-modal and does not write top or left', () => {
    const onOpenChange = vi.fn();
    render(<Harness open onOpenChange={onOpenChange} />);
    const content = screen.getByLabelText('Menu');
    expect(content.getAttribute('aria-modal')).toBeNull();
    expect(content.getAttribute('popover')).toBe('manual');
    expect(content.getAttribute('tabindex')).toBe('-1');
    expect(content.style.top).toBe('');
    expect(content.style.left).toBe('');
  });

  it('always mounts the surface', () => {
    render(<Harness open={false} />);
    expect(document.querySelector('[popover="manual"]')).not.toBeNull();
  });

  it('anchors in CSS with a 4px gap', () => {
    expect(css).toMatch(/--todae-popover-offset:\s*var\(--todae-space-1\)/);
    expect(css).toMatch(/top:\s*calc\(anchor\(bottom\) \+ var\(--todae-popover-offset\)\)/);
    expect(css).toMatch(/@position-try --todae-popover-flip-block/);
  });

  it('owns the pointer on the popover box', () => {
    expect(css).toMatch(/position:\s*fixed/);
    expect(css).toMatch(/inset:\s*unset/);
    expect(css).toMatch(/pointer-events:\s*auto/);
  });

  it('does not click through to a control under the popover', () => {
    const under = vi.fn();
    const onChange = vi.fn();
    function Through() {
      const [open, setOpen] = useState(true);
      const popover = usePopover({ open, onOpenChange: setOpen });
      return (
        <div>
          <button type="button" onClick={under}>
            Under
          </button>
          <button type="button" {...popover.getTriggerProps()}>
            Open
          </button>
          <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="Menu">
            <OptionList.Root
              value={null}
              onValueChange={(value) => {
                onChange(value);
                setOpen(false);
              }}
            >
              <OptionList.Option value="apple">Apple</OptionList.Option>
            </OptionList.Root>
          </Popover.Root>
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
  });

  it('does not own a machine and keeps CSS anchors plus no trigger chrome', () => {
    expect(source).not.toContain('../hooks/usePopover');
    expect(source).not.toContain('useControlledOpen');
    expect(source).not.toContain('useFocusRestore');
    expect(source).not.toContain('useInitialFocus');
    expect(source).not.toContain('useFocusTrap');
    expect(source).not.toContain('useInertOutside');
    expect(source).not.toContain('Popover.Trigger');
    expect(source).not.toContain('Popover.Content');
    const froms = [...source.matchAll(/from ['"]([^'"]+)['"]/g)].map((match) => match[1]);
    expect(new Set(froms)).toEqual(
      new Set(['react', '../overlay/usePopoverSync', './Popover.wire', './Popover.module.css', './props', './cx', './toolbarContext']),
    );
    expect(css).not.toContain('.trigger');
    expect(css).toContain('anchor(');
    expectTypeOf<{
      id: string;
      open: boolean;
      ref: (node: HTMLElement | null) => void;
      style: CSSProperties;
      onPointerDown: () => void;
      onClick: () => void;
    }>().toMatchTypeOf<PopoverRootProps>();
    expectTypeOf<{ open: boolean; onOpenChange: () => void }>().not.toMatchTypeOf<PopoverRootProps>();
  });

  it('omits role unless set, and stays byte-identical aside from that', () => {
    function Bare() {
      const popover = usePopover({ open: true });
      return (
        <Popover.Root {...popover.getPopoverProps()} data-testid="bare">
          Hi
        </Popover.Root>
      );
    }
    render(<Bare />);
    const content = screen.getByTestId('bare');
    expect(content.hasAttribute('role')).toBe(false);
    expect(content.outerHTML).not.toMatch(/\srole=/);
    expect(content.getAttribute('aria-modal')).toBeNull();
    expect(content.getAttribute('popover')).toBe('manual');
    expect(content.getAttribute('tabindex')).toBe('-1');
  });

  it('requires an accessible name when role is dialog', () => {
    expectTypeOf<PopoverWire & { role: 'dialog' }>().not.toMatchTypeOf<PopoverRootProps>();
    expectTypeOf<PopoverWire & { role: 'dialog'; 'aria-label': string }>().toMatchTypeOf<PopoverRootProps>();
    expectTypeOf<PopoverWire & { role: 'dialog'; 'aria-labelledby': string }>().toMatchTypeOf<PopoverRootProps>();
    expectTypeOf<PopoverWire>().toMatchTypeOf<PopoverRootProps>();
  });

  it('takes no name without a role, since ARIA prohibits one there', () => {
    expectTypeOf<PopoverWire & { 'aria-label': string }>().not.toMatchTypeOf<PopoverRootProps>();
    expectTypeOf<PopoverWire & { 'aria-labelledby': string }>().not.toMatchTypeOf<PopoverRootProps>();
    // A plain JS caller can still pass one; the element drops it.
    const loose = { 'aria-label': 'Menu', 'aria-labelledby': 'x' } as unknown as Record<string, never>;
    function Unnamed() {
      const popover = usePopover({ defaultOpen: true });
      return (
        <Popover.Root {...popover.getPopoverProps()} {...loose} data-testid="unnamed">
          Hi
        </Popover.Root>
      );
    }
    render(<Unnamed />);
    const content = screen.getByTestId('unnamed');
    expect(content.hasAttribute('aria-label')).toBe(false);
    expect(content.hasAttribute('aria-labelledby')).toBe(false);
  });
});
