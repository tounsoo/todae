import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState, type CSSProperties } from 'react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as api from '../index';
import { usePopover, type PopoverCloseReason, type UsePopoverOptions } from '../hooks/usePopover';
import { Option, OptionList } from './OptionList';
import { Popover, type PopoverProps } from './Popover';

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
      <Popover {...popover.getPopoverProps()} aria-label="Menu">
        {children}
      </Popover>
    </>
  );
}

describe('Popover exports', () => {
  it('exports the surface and hard-cuts Trigger and Content', () => {
    expect(api.Popover).toBe(Popover);
    expect(api.usePopover).toBeDefined();
    expect(Popover).not.toHaveProperty('Trigger');
    expect(Popover).not.toHaveProperty('Content');
    expectTypeOf<PopoverProps>().toHaveProperty('id');
    expectTypeOf<PopoverProps>().toHaveProperty('open');
    expectTypeOf<PopoverProps>().toHaveProperty('ref');
    expectTypeOf<PopoverProps>().toHaveProperty('style');
    expectTypeOf<PopoverProps>().not.toHaveProperty('onOpenChange');
    expectTypeOf<PopoverProps>().not.toHaveProperty('enabled');
    expectTypeOf<PopoverProps>().not.toHaveProperty('anchorRef');
    expectTypeOf<PopoverProps>().not.toHaveProperty('defaultOpen');
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

  it('sets CSS anchor-name on anchorRef', () => {
    function AnchorHarness() {
      const anchorRef = useRef<HTMLDivElement>(null);
      const popover = usePopover({ open: true, anchorRef });
      return (
        <>
          <div ref={anchorRef} data-testid="anchor">
            Field
          </div>
          <Popover {...popover.getPopoverProps()} aria-label="Menu">
            Hello
          </Popover>
        </>
      );
    }
    render(<AnchorHarness />);
    const anchor = screen.getByTestId('anchor');
    expect(anchor.style.getPropertyValue('anchor-name')).toMatch(/^--todae-popover-/);
    expect(anchor.style.getPropertyValue('--todae-popover-anchor')).toMatch(/^--todae-popover-/);
    expect(anchor.style.getPropertyValue('anchor-name')).toBe(
      anchor.style.getPropertyValue('--todae-popover-anchor'),
    );
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
          <Popover {...popover.getPopoverProps()} aria-label="Menu">
            <OptionList
              value={null}
              onChange={(value) => {
                onChange(value);
                setOpen(false);
              }}
            >
              <Option value="apple">Apple</Option>
            </OptionList>
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
  });

  it('does not own a machine and keeps CSS anchors plus no trigger chrome', () => {
    expect(source).not.toContain('usePopover');
    expect(source).not.toContain('useControlledOpen');
    expect(source).not.toContain('useFocusRestore');
    expect(source).not.toContain('useInitialFocus');
    expect(source).not.toContain('useFocusTrap');
    expect(source).not.toContain('useInertOutside');
    expect(source).not.toContain('useScrollLock');
    expect(source).not.toContain('Popover.Trigger');
    expect(source).not.toContain('Popover.Content');
    const froms = [...source.matchAll(/from ['"]([^'"]+)['"]/g)].map((match) => match[1]);
    expect(new Set(froms)).toEqual(
      new Set(['react', '../overlay/usePopoverSync', './Popover.wire', './Popover.module.css']),
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
    }>().toMatchTypeOf<PopoverProps>();
    expectTypeOf<{ open: boolean; onOpenChange: () => void }>().not.toMatchTypeOf<PopoverProps>();
  });
});
