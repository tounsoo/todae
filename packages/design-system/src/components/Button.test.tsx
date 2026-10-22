import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef, type ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { Button, type ButtonActionProps, type ButtonIconProps, type ButtonRenderProps, type ButtonRootProps } from './Button.js';
import * as api from '../index.js';

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

describe('Button.Root toggle', () => {
  it('stays unchanged when its own onClick calls preventDefault', () => {
    const onPressedChange = vi.fn();
    render(
      <Button.Root defaultPressed={false} onPressedChange={onPressedChange} onClick={(event) => event.preventDefault()}>
        Bold
      </Button.Root>,
    );
    const button = screen.getByRole('button', { name: 'Bold' });
    fireEvent.click(button);
    expect(onPressedChange).not.toHaveBeenCalled();
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('does not flip while aria-disabled, and still calls onClick', () => {
    const onPressedChange = vi.fn();
    const onClick = vi.fn();
    render(
      <Button.Root defaultPressed={false} onPressedChange={onPressedChange} onClick={onClick} aria-disabled="true">
        Bold
      </Button.Root>,
    );
    const button = screen.getByRole('button', { name: 'Bold' });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onPressedChange).not.toHaveBeenCalled();
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('does not flip a controlled toggle with aria-disabled={true}', () => {
    const onPressedChange = vi.fn();
    render(
      <Button.Root pressed onPressedChange={onPressedChange} aria-disabled>
        Bold
      </Button.Root>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(onPressedChange).not.toHaveBeenCalled();
  });

  it('toggles when only a child prevented the click', () => {
    const onPressedChange = vi.fn();
    render(
      <Button.Root defaultPressed={false} onPressedChange={onPressedChange}>
        <span onClick={(event) => event.preventDefault()}>Bold</span>
      </Button.Root>,
    );
    fireEvent.click(screen.getByText('Bold'));
    expect(onPressedChange).toHaveBeenCalledWith(true);
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

  it.each([
    ['pointer enter', 'onPointerEnter', fireEvent.pointerEnter],
    ['focus', 'onFocus', fireEvent.focus],
  ] as const)('shows no tip when the consumer prevents %s', (_label, handler, fire) => {
    render(
      <Button.Root aria-label="Archive" {...{ [handler]: (event: Event) => event.preventDefault() }}>
        <Button.Icon>+</Button.Icon>
      </Button.Root>,
    );
    fire(screen.getByRole('button', { name: 'Archive' }));
    advance(300);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it("keeps the consumer's aria-describedby and joins the tip to it while open", () => {
    render(
      <>
        <span id="archive-note">Moves the thread out of the inbox</span>
        <Button.Root aria-label="Archive" aria-describedby="archive-note">
          <Button.Icon>+</Button.Icon>
        </Button.Root>
      </>,
    );
    const button = screen.getByRole('button', { name: 'Archive' });
    expect(button.getAttribute('aria-describedby')).toBe('archive-note');
    fireEvent.pointerEnter(button);
    advance(300);
    expect(button.getAttribute('aria-describedby')).toBe(`archive-note ${screen.getByRole('tooltip').id}`);
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

  it('reads every id in an aria-labelledby list, in order', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <>
        <span id="verb">Add</span>
        <span id="noun">item</span>
        <Button.Root aria-labelledby="verb  noun">
          <Button.Icon>+</Button.Icon>
        </Button.Root>
      </>,
    );
    expect(error).not.toHaveBeenCalled();
    fireEvent.pointerEnter(screen.getByRole('button'));
    advance(300);
    expect(screen.getByRole('tooltip').textContent).toBe('Add item');
    error.mockRestore();
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
    expect(source).toContain("from '../hooks/useTooltip.js'");
    expect(source).toContain("from './Tooltip.js'");
    expect(source).not.toContain('Tooltip.Trigger');
    expect(source).not.toContain('createIntent');
    // useControlledState holds the toggle's pressed state only; tip state lives in useTooltip.
    expect(source.match(/useControlledState\(/g)).toHaveLength(1);
    const froms = [...source.matchAll(/from ['"]([^'"]+)['"]/g)].map((match) => match[1]);
    expect(new Set(froms)).toEqual(
      new Set(['react', '../hooks/useControlledState.js', '../hooks/useTooltip.js', './Button.module.css', './props.js', './cx.js', './Tooltip.js']),
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
    expect(tip.getAttribute('data-surface')).toBe('tip');
  });

  it('renders a link with the button look through render, keeping the link role', () => {
    const ref = createRef<HTMLElement>();
    render(
      <Button.Root variant="secondary" ref={ref} render={(props) => <a {...props} href="/docs" />}>
        Get started
      </Button.Root>,
    );
    const link = screen.getByRole('link', { name: 'Get started' });
    expect(link.getAttribute('href')).toBe('/docs');
    expect(link.getAttribute('data-button-variant')).toBe('secondary');
    expect(link.hasAttribute('type')).toBe(false);
    expect(link.hasAttribute('aria-pressed')).toBe(false);
    expect(ref.current).toBe(link);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('names an icon-only link and tips its name', () => {
    vi.useFakeTimers();
    render(
      <Button.Root aria-label="Settings" render={(props) => <a {...props} href="/settings" />}>
        <Button.Icon>*</Button.Icon>
      </Button.Root>,
    );
    const link = screen.getByRole('link', { name: 'Settings' });
    expect(link.hasAttribute('data-icon-only')).toBe(true);
    fireEvent.pointerEnter(link);
    advance(300);
    expect(screen.getByRole('tooltip').textContent).toBe('Settings');
  });

  it('logs in development when render does not pass its props to an a or a button', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<Button.Root render={(props) => <a {...props} href="/" />}>Home</Button.Root>);
    render(<Button.Root render={(props) => <button {...props} type="submit" />}>Send</Button.Root>);
    expect(error).not.toHaveBeenCalled();
    render(<Button.Root render={(props) => <div {...props} />}>Home</Button.Root>);
    expect(error).toHaveBeenCalledWith('Button.Root render must pass its props, ref included, to an a or a button');
  });

  it('does not let a rendered element take button-only props or toggle', () => {
    const link = (props: ButtonRenderProps) => <a {...props} href="/" />;
    // @ts-expect-error a link can't be a toggle
    void (<Button.Root render={link} pressed />);
    // @ts-expect-error a link has no disabled
    void (<Button.Root render={link} disabled />);
    // @ts-expect-error a link has no button type
    void (<Button.Root render={link} type="submit" />);
    // @ts-expect-error close buttons and triggers stay buttons
    expectTypeOf<ButtonActionProps>().toMatchTypeOf<{ render: typeof link }>();
    void (<Button.Root render={link} onClick={(event) => event.currentTarget.blur()} />);
    // A wrapper typed from ButtonRootProps, as the docs show, still passes its rest on.
    const Wrapper = ({ label, ...props }: Omit<ButtonRootProps, 'aria-label'> & { label: string }) => (
      <Button.Root {...props} aria-label={label} onClick={(event) => event.currentTarget.form?.reset()} />
    );
    void Wrapper;
    expectTypeOf<ComponentProps<typeof Button.Root>>().toEqualTypeOf<ButtonRootProps>();
    expectTypeOf<ComponentProps<typeof api.Toast.Action>>().toEqualTypeOf<api.ToastActionProps>();
    const ToastWrapper = (props: api.ToastActionProps) => <api.Toast.Action {...props} />;
    void ToastWrapper;
    void (<api.Toast.Action onClick={(event) => event.currentTarget.form?.reset()} />);
    void (<api.Toast.Action render={link} onClick={(event) => event.currentTarget.blur()} />);
    expectTypeOf<api.MenuItemRenderProps>().toHaveProperty('ref');
  });
});
