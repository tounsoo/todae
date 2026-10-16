import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from './Button.js';
import { ToggleGroup } from './ToggleGroup.js';

afterEach(cleanup);

const button = (name: string) => screen.getByRole('button', { name });
const pressed = (name: string) => button(name).getAttribute('aria-pressed');

describe('Button.Root as a toggle', () => {
  it('is a plain button without pressed props', () => {
    render(<Button.Root>Save</Button.Root>);
    expect(button('Save').hasAttribute('aria-pressed')).toBe(false);
  });

  it('flips aria-pressed on click when uncontrolled', () => {
    const onPressedChange = vi.fn();
    render(
      <Button.Root defaultPressed={false} onPressedChange={onPressedChange}>
        Mute
      </Button.Root>,
    );
    expect(pressed('Mute')).toBe('false');
    fireEvent.click(button('Mute'));
    expect(pressed('Mute')).toBe('true');
    expect(onPressedChange).toHaveBeenLastCalledWith(true);
  });

  it('follows a controlled value, and lets onClick preventDefault skip the change', () => {
    const onPressedChange = vi.fn();
    const { rerender } = render(
      <Button.Root pressed onPressedChange={onPressedChange} onClick={(event) => event.preventDefault()}>
        Mute
      </Button.Root>,
    );
    fireEvent.click(button('Mute'));
    expect(onPressedChange).not.toHaveBeenCalled();
    rerender(
      <Button.Root pressed onPressedChange={onPressedChange}>
        Mute
      </Button.Root>,
    );
    fireEvent.click(button('Mute'));
    expect(onPressedChange).toHaveBeenCalledWith(false);
    expect(pressed('Mute')).toBe('true');
  });
});

describe('ToggleGroup', () => {
  it('presses one item at most in single mode, and clears it when pressed again', () => {
    const onChange = vi.fn();
    render(
      <ToggleGroup.Root aria-label="Align" defaultValue="left" onValueChange={onChange}>
        <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
        <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
      </ToggleGroup.Root>,
    );
    expect(screen.getByRole('group', { name: 'Align' })).toBeTruthy();
    expect([pressed('Left'), pressed('Center')]).toEqual(['true', 'false']);
    fireEvent.click(button('Center'));
    expect([pressed('Left'), pressed('Center')]).toEqual(['false', 'true']);
    expect(onChange).toHaveBeenLastCalledWith('center');
    fireEvent.click(button('Center'));
    expect(pressed('Center')).toBe('false');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('presses any number in multiple mode', () => {
    const onChange = vi.fn();
    render(
      <ToggleGroup.Root aria-label="Style" selectionMode="multiple" onValueChange={onChange}>
        <ToggleGroup.Item value="bold">Bold</ToggleGroup.Item>
        <ToggleGroup.Item value="italic">Italic</ToggleGroup.Item>
      </ToggleGroup.Root>,
    );
    fireEvent.click(button('Bold'));
    fireEvent.click(button('Italic'));
    expect(onChange).toHaveBeenLastCalledWith(['bold', 'italic']);
    fireEvent.click(button('Bold'));
    expect(onChange).toHaveBeenLastCalledWith(['italic']);
    expect([pressed('Bold'), pressed('Italic')]).toEqual(['false', 'true']);
  });

  it('has one tab stop, on the pressed item, and moves focus with arrow keys', () => {
    render(
      <ToggleGroup.Root aria-label="Align" defaultValue="center">
        <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
        <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
        <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
      </ToggleGroup.Root>,
    );
    expect([button('Left').tabIndex, button('Center').tabIndex, button('Right').tabIndex]).toEqual([-1, 0, -1]);
    button('Center').focus();
    fireEvent.keyDown(button('Center'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(button('Right'));
    expect(pressed('Right')).toBe('false');
  });

  it('moves the tab stop with focus inside, and back to the pressed item when focus leaves', async () => {
    render(
      <>
        <ToggleGroup.Root aria-label="Align" defaultValue="center">
          <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
          <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
          <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
        </ToggleGroup.Root>
        <button type="button">Out</button>
      </>,
    );
    button('Center').focus();
    fireEvent.keyDown(button('Center'), { key: 'ArrowRight' });
    expect([button('Center').tabIndex, button('Right').tabIndex]).toEqual([-1, 0]);
    button('Out').focus();
    await waitFor(() => expect([button('Center').tabIndex, button('Right').tabIndex]).toEqual([0, -1]));
  });

  it('puts the tab stop on the first item in multiple mode', () => {
    render(
      <ToggleGroup.Root aria-label="Style" selectionMode="multiple" defaultValue={['italic', 'bold']}>
        <ToggleGroup.Item value="bold">Bold</ToggleGroup.Item>
        <ToggleGroup.Item value="italic">Italic</ToggleGroup.Item>
        <ToggleGroup.Item value="code">Code</ToggleGroup.Item>
      </ToggleGroup.Root>,
    );
    expect([button('Bold').tabIndex, button('Italic').tabIndex, button('Code').tabIndex]).toEqual([0, -1, -1]);
  });

  it('disables every item from the root', () => {
    render(
      <ToggleGroup.Root aria-label="Align" disabled>
        <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
      </ToggleGroup.Root>,
    );
    expect((button('Left') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('ToggleGroup.Root types', () => {
  it('rejects the old onChange name', () => {
    expect(() => (
      <ToggleGroup.Root
        aria-label="Align"
        // @ts-expect-error onChange was renamed to onValueChange.
        onChange={() => undefined}
      >
        <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
      </ToggleGroup.Root>
    )).not.toThrow();
  });
});
