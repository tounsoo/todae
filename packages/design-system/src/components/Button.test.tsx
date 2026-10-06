import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { Button, type ButtonIconProps, type ButtonRootProps } from './Button';
import * as api from '../index';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'Button.tsx'), 'utf8');
const css = readFileSync(join(here, 'Button.module.css'), 'utf8');

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Button exports', () => {
  it('hard-cuts the flat Button and is not callable', () => {
    expect(api.Button).toEqual({
      Root: Button.Root,
      Icon: Button.Icon,
      Group: Button.Group,
    });
    expect(typeof api.Button).toBe('object');
    expect('ButtonGroup' in api).toBe(false);
    expectTypeOf<typeof Button extends (...args: never[]) => unknown ? true : false>().toEqualTypeOf<false>();
    expectTypeOf<ButtonRootProps>().toHaveProperty('variant');
    expectTypeOf<ButtonRootProps>().toHaveProperty('tooltip');
    expectTypeOf<ButtonIconProps>().not.toHaveProperty('side');
    expectTypeOf<ButtonIconProps>().not.toHaveProperty('interactive');
  });
});

describe('Button.Root', () => {
  it('defaults type to button and omits primary variant data', () => {
    render(<Button.Root>Save</Button.Root>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveProperty('type', 'button');
    expect(button.getAttribute('data-button-variant')).toBeNull();
  });

  it('sets data-button-variant for secondary and ghost', () => {
    const { rerender } = render(<Button.Root variant="secondary">Cancel</Button.Root>);
    expect(screen.getByRole('button').getAttribute('data-button-variant')).toBe('secondary');
    rerender(<Button.Root variant="ghost">Ghost</Button.Root>);
    expect(screen.getByRole('button').getAttribute('data-button-variant')).toBe('ghost');
  });

  it('keeps an explicit type and disabled', () => {
    render(
      <Button.Root type="submit" disabled>
        Send
      </Button.Root>,
    );
    const button = screen.getByRole('button', { name: 'Send' });
    expect(button).toHaveProperty('type', 'submit');
    expect(button).toHaveProperty('disabled', true);
  });
});

describe('Button.Icon', () => {
  it('is decorative and follows source order', () => {
    render(
      <Button.Root>
        <Button.Icon>+</Button.Icon>
        Save
        <Button.Icon>→</Button.Icon>
      </Button.Root>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    const icons = [...button.querySelectorAll('[aria-hidden="true"]')];
    expect(button.textContent).toBe('+Save→');
    expect(icons.map((icon) => icon.textContent)).toEqual(['+', '→']);
    expect(button.firstElementChild).toBe(icons[0]);
    expect(button.lastElementChild).toBe(icons[1]);
  });

  it('names an icon-only root from aria-label', () => {
    render(
      <Button.Root aria-label="Add">
        <Button.Icon>+</Button.Icon>
      </Button.Root>,
    );
    const button = screen.getByRole('button', { name: 'Add' });
    expect(button.querySelector('[aria-hidden="true"]')?.textContent).toBe('+');
    expect(button.hasAttribute('data-icon-only')).toBe(true);
  });

  it('omits data-icon-only when the button has a label', () => {
    render(<Button.Root>Save</Button.Root>);
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('data-icon-only')).toBe(false);
  });
});

describe('Button.Group', () => {
  it('is a named group of buttons with no pressed state', () => {
    render(
      <Button.Group aria-label="Align">
        <Button.Root variant="secondary" aria-label="Left">
          <Button.Icon>L</Button.Icon>
        </Button.Root>
        <Button.Root variant="secondary" aria-label="Center">
          <Button.Icon>C</Button.Icon>
        </Button.Root>
        <Button.Root variant="secondary" aria-label="Right">
          <Button.Icon>R</Button.Icon>
        </Button.Root>
      </Button.Group>,
    );
    const group = screen.getByRole('group', { name: 'Align' });
    const buttons = screen.getAllByRole('button');
    expect(group.contains(buttons[0] as Node)).toBe(true);
    expect(buttons).toHaveLength(3);
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(['Left', 'Center', 'Right']);
    expect(buttons.every((button) => button.getAttribute('aria-pressed') === null)).toBe(true);
    expect(group.getAttribute('role')).toBe('group');
  });

  it('overlaps later roots after a sibling tip', () => {
    expect(css).toContain('.group > .root ~ .root');
    expect(css).not.toContain('.group > .root + .root');
  });
});

describe('Button auto-tip', () => {
  let notifyOverflow: (() => void) | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    notifyOverflow = null;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        cb: ResizeObserverCallback;
        constructor(cb: ResizeObserverCallback) {
          this.cb = cb;
        }
        observe(el: Element) {
          notifyOverflow = () => this.cb([{ target: el } as ResizeObserverEntry], this as never);
          notifyOverflow();
        }
        disconnect() {
          notifyOverflow = null;
        }
        unobserve() {}
      },
    );
  });

  function advance(ms: number) {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  }

  function overflow(el: Element) {
    Object.defineProperty(el, 'scrollWidth', { configurable: true, value: 120 });
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: 40 });
    act(() => {
      notifyOverflow?.();
    });
  }

  it('tips an icon-only name from aria-label', () => {
    render(
      <Button.Root aria-label="Archive">
        <Button.Icon>+</Button.Icon>
      </Button.Root>,
    );
    const button = screen.getByRole('button', { name: 'Archive' });
    fireEvent.pointerEnter(button);
    advance(300);
    expect(screen.getByRole('tooltip').textContent).toBe('Archive');
    expect(button.getAttribute('aria-describedby')).toBe(screen.getByRole('tooltip').id);
  });

  it('tips an icon-only name from aria-labelledby text', () => {
    render(
      <>
        <span id="add-caption">Add item</span>
        <Button.Root aria-labelledby="add-caption">
          <Button.Icon>+</Button.Icon>
        </Button.Root>
      </>,
    );
    const button = screen.getByRole('button', { name: 'Add item' });
    fireEvent.pointerEnter(button);
    advance(300);
    expect(screen.getByRole('tooltip').textContent).toBe('Add item');
  });

  it('errors and does not tip an unnamed icon-only root', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <Button.Root>
        <Button.Icon>+</Button.Icon>
      </Button.Root>,
    );
    expect(error).toHaveBeenCalledWith('Button.Root icon-only requires aria-label or aria-labelledby');
    fireEvent.pointerEnter(screen.getByRole('button'));
    advance(300);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('does not tip a labeled button that fits', () => {
    render(<Button.Root>Save</Button.Root>);
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Save' }));
    advance(300);
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(screen.getByRole('button').querySelector('span:not([aria-hidden])')?.textContent).toBe('Save');
  });

  it('tips the full string only while the label overflows', () => {
    render(<Button.Root>Very long archive label</Button.Root>);
    const button = screen.getByRole('button', { name: 'Very long archive label' });
    const label = button.querySelector('span:not([aria-hidden])');
    expect(label).not.toBeNull();
    overflow(label as HTMLElement);
    fireEvent.pointerEnter(button);
    advance(300);
    expect(screen.getByRole('tooltip').textContent).toBe('Very long archive label');
  });

  it('opts out with tooltip={false}', () => {
    render(
      <Button.Root tooltip={false} aria-label="Archive">
        <Button.Icon>+</Button.Icon>
      </Button.Root>,
    );
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Archive' }));
    advance(300);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('forwards ref to the native button when tipped', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Button.Root ref={ref} aria-label="Archive">
        <Button.Icon>+</Button.Icon>
      </Button.Root>,
    );
    expect(ref.current).toBe(screen.getByRole('button', { name: 'Archive' }));
  });

  it('wires one useTooltip machine and does not import Trigger', () => {
    expect(source).toContain("from '../hooks/useTooltip'");
    expect(source).toContain("from './Tooltip'");
    expect(source).not.toContain('Tooltip.Trigger');
    expect(source).not.toContain('createIntent');
    expect(source).not.toContain('useControlledState');
    const froms = [...source.matchAll(/from ['"]([^'"]+)['"]/g)].map((match) => match[1]);
    expect(new Set(froms)).toEqual(
      new Set(['react', '../hooks/useTooltip', './Button.module.css', './props', './Tooltip']),
    );
  });

  it('never marks auto tips interactive', () => {
    render(
      <Button.Root aria-label="Archive">
        <Button.Icon>+</Button.Icon>
      </Button.Root>,
    );
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Archive' }));
    advance(300);
    const tip = screen.getByRole('tooltip');
    expect(tip.getAttribute('role')).toBe('tooltip');
    expect(tip.hasAttribute('popover')).toBe(false);
  });
});
