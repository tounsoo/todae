import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { Button, ButtonGroup, type ButtonIconProps, type ButtonRootProps } from './Button';
import * as api from '../index';

afterEach(cleanup);

describe('Button exports', () => {
  it('hard-cuts the flat Button and is not callable', () => {
    expect(api.Button).toEqual({
      Root: Button.Root,
      Icon: Button.Icon,
    });
    expect(typeof api.Button).toBe('object');
    expect(api.Button).not.toHaveProperty('Group');
    expect(api.ButtonGroup).toBe(ButtonGroup);
    expectTypeOf<typeof Button extends (...args: never[]) => unknown ? true : false>().toEqualTypeOf<false>();
    expectTypeOf<ButtonRootProps>().toHaveProperty('variant');
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
  });
});

describe('ButtonGroup', () => {
  it('is a named group of buttons with no pressed state', () => {
    render(
      <ButtonGroup aria-label="Align">
        <Button.Root variant="secondary" aria-label="Left">
          <Button.Icon>L</Button.Icon>
        </Button.Root>
        <Button.Root variant="secondary" aria-label="Center">
          <Button.Icon>C</Button.Icon>
        </Button.Root>
        <Button.Root variant="secondary" aria-label="Right">
          <Button.Icon>R</Button.Icon>
        </Button.Root>
      </ButtonGroup>,
    );
    const group = screen.getByRole('group', { name: 'Align' });
    const buttons = screen.getAllByRole('button');
    expect(group.contains(buttons[0] as Node)).toBe(true);
    expect(buttons).toHaveLength(3);
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(['Left', 'Center', 'Right']);
    expect(buttons.every((button) => button.getAttribute('aria-pressed') === null)).toBe(true);
    expect(group.getAttribute('role')).toBe('group');
  });
});
