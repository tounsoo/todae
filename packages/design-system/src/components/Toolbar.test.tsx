import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from './Button';
import { Menu } from './Menu';
import { ToggleGroup } from './ToggleGroup';
import { Toolbar } from './Toolbar';

afterEach(cleanup);

function Editor({ orientation }: { orientation?: 'horizontal' | 'vertical' }) {
  return (
    <Toolbar.Root aria-label="Format" orientation={orientation}>
      <Toolbar.Group aria-label="Style">
        <Button.Root variant="ghost">Bold</Button.Root>
        <span>
          <Button.Root variant="ghost">Italic</Button.Root>
        </span>
      </Toolbar.Group>
      <Toolbar.Separator data-testid="sep" />
      <Button.Root variant="ghost" disabled>
        Undo
      </Button.Root>
      <input aria-label="Font size" defaultValue="12" />
      <Button.Root variant="ghost">Link</Button.Root>
    </Toolbar.Root>
  );
}

const button = (name: string) => screen.getByRole('button', { name });

describe('Toolbar', () => {
  it('has the toolbar role and writes no tabindex', () => {
    render(<Editor />);
    expect(screen.getByRole('toolbar', { name: 'Format' }).hasAttribute('aria-orientation')).toBe(false);
    expect(document.querySelectorAll('[role="toolbar"] [tabindex]')).toHaveLength(0);
  });

  it('moves focus to the end of the run on Tab and the start on Shift+Tab, so the browser leaves from there', () => {
    render(<Editor />);
    button('Bold').focus();
    fireEvent.keyDown(button('Bold'), { key: 'Tab' });
    // The text input ends the first run and keeps its own Tab stop.
    expect(document.activeElement).toBe(button('Italic'));
    button('Italic').focus();
    fireEvent.keyDown(button('Italic'), { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(button('Bold'));
  });

  it('returns focus coming back from outside to the item Tab left from', () => {
    render(
      <>
        <button type="button">Before</button>
        <Toolbar.Root aria-label="t">
          <Button.Root>A</Button.Root>
          <Button.Root>B</Button.Root>
          <Button.Root>C</Button.Root>
        </Toolbar.Root>
      </>,
    );
    button('B').focus();
    fireEvent.keyDown(button('B'), { key: 'Tab', shiftKey: true });
    button('Before').focus();
    button('A').focus();
    expect(document.activeElement).toBe(button('B'));
  });

  it('lets a press land where it was aimed after Tab left', () => {
    render(
      <>
        <button type="button">Before</button>
        <Toolbar.Root aria-label="t">
          <Button.Root>A</Button.Root>
          <Button.Root>B</Button.Root>
        </Toolbar.Root>
      </>,
    );
    button('B').focus();
    fireEvent.keyDown(button('B'), { key: 'Tab', shiftKey: true });
    button('Before').focus();
    fireEvent.pointerDown(button('A'));
    button('A').focus();
    expect(document.activeElement).toBe(button('A'));
  });
  it('moves focus with arrow keys, skipping disabled controls and text inputs, and following wrappers', () => {
    render(<Editor />);
    button('Bold').focus();
    fireEvent.keyDown(button('Bold'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(button('Italic'));
    fireEvent.keyDown(button('Italic'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(button('Link'));
  });

  it('skips controls disabled by a fieldset, and composites with their own arrow keys', () => {
    render(
      <Toolbar.Root aria-label="t">
        <Button.Root>A</Button.Root>
        <fieldset disabled>
          <Button.Root>Off</Button.Root>
        </fieldset>
        <button type="button" data-todae-roving="x" tabIndex={0}>
          Own
        </button>
        <Button.Root>B</Button.Root>
      </Toolbar.Root>,
    );
    button('A').focus();
    fireEvent.keyDown(button('A'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(button('B'));
    expect(button('Own').tabIndex).toBe(0);
  });

  it('leaves arrow keys in a text input to the input', () => {
    render(<Editor />);
    const input = screen.getByRole('textbox');
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(input);
  });

  it('jumps with Home and End and wraps by default', () => {
    render(<Editor />);
    button('Bold').focus();
    fireEvent.keyDown(button('Bold'), { key: 'End' });
    expect(document.activeElement).toBe(button('Link'));
    fireEvent.keyDown(button('Link'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(button('Bold'));
    fireEvent.keyDown(button('Bold'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(button('Link'));
    fireEvent.keyDown(button('Link'), { key: 'Home' });
    expect(document.activeElement).toBe(button('Bold'));
  });

  it('stops at the ends when loop is off', () => {
    render(
      <Toolbar.Root aria-label="t" loop={false}>
        <Button.Root>A</Button.Root>
        <Button.Root>B</Button.Root>
      </Toolbar.Root>,
    );
    button('B').focus();
    fireEvent.keyDown(button('B'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(button('B'));
  });

  it('uses Up and Down when vertical, and turns the separator across', () => {
    render(<Editor orientation="vertical" />);
    expect(screen.getByRole('toolbar').getAttribute('aria-orientation')).toBe('vertical');
    expect(screen.getByTestId('sep').getAttribute('aria-orientation')).toBe('horizontal');
    button('Bold').focus();
    fireEvent.keyDown(button('Bold'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(button('Bold'));
    fireEvent.keyDown(button('Bold'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(button('Italic'));
  });

  it('draws a vertical separator in a horizontal toolbar', () => {
    render(<Editor />);
    const sep = screen.getByTestId('sep');
    expect(sep.getAttribute('role')).toBe('separator');
    expect(sep.getAttribute('aria-orientation')).toBe('vertical');
  });

  it('skips controls inside a popover that opens from it', () => {
    render(
      <Toolbar.Root aria-label="t">
        <Button.Root>A</Button.Root>
        <div popover="manual">
          <button type="button">Inside</button>
        </div>
        <Button.Root>B</Button.Root>
      </Toolbar.Root>,
    );
    expect(screen.getByRole('button', { name: 'Inside', hidden: true }).hasAttribute('tabindex')).toBe(false);
    button('A').focus();
    fireEvent.keyDown(button('A'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(button('B'));
  });

  it('owns the arrow keys for a toggle group inside it', () => {
    render(
      <Toolbar.Root aria-label="t">
        <ToggleGroup.Root aria-label="Align" defaultValue="left">
          <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
          <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
        </ToggleGroup.Root>
        <Button.Root>More</Button.Root>
      </Toolbar.Root>,
    );
    expect(button('Left').hasAttribute('tabindex')).toBe(false);
    button('Left').focus();
    fireEvent.keyDown(button('Left'), { key: 'ArrowRight' });
    fireEvent.keyDown(button('Right'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(button('More'));
  });

  it('leaves native radios their own arrow keys and tab stop', () => {
    render(
      <Toolbar.Root aria-label="t">
        <Button.Root>A</Button.Root>
        <input type="radio" name="size" aria-label="Small" defaultChecked />
        <input type="radio" name="size" aria-label="Large" />
        <Button.Root>B</Button.Root>
      </Toolbar.Root>,
    );
    expect(screen.getByRole('radio', { name: 'Small' }).hasAttribute('tabindex')).toBe(false);
    button('A').focus();
    fireEvent.keyDown(button('A'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(button('B'));
  });

  it('leaves a toggle group inside a popover from the toolbar its own roving focus', async () => {
    render(
      <Toolbar.Root aria-label="t">
        <Button.Root>A</Button.Root>
        <div popover="manual">
          <ToggleGroup.Root aria-label="Align" defaultValue="left">
            <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
            <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
          </ToggleGroup.Root>
        </div>
      </Toolbar.Root>,
    );
    const left = screen.getByRole('button', { name: 'Left', hidden: true });
    const right = screen.getByRole('button', { name: 'Right', hidden: true });
    await waitFor(() => expect([left.tabIndex, right.tabIndex]).toEqual([0, -1]));
    left.focus();
    fireEvent.keyDown(left, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(right);
  });

  it('gives a toggle group portaled out of the toolbar its own roving focus', async () => {
    render(
      <Toolbar.Root aria-label="t">
        <Button.Root>A</Button.Root>
        {createPortal(
          <ToggleGroup.Root aria-label="Align" defaultValue="left">
            <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
            <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
          </ToggleGroup.Root>,
          document.body,
        )}
      </Toolbar.Root>,
    );
    const left = screen.getByRole('button', { name: 'Left' });
    const right = screen.getByRole('button', { name: 'Right' });
    await waitFor(() => expect([left.tabIndex, right.tabIndex]).toEqual([0, -1]));
    left.focus();
    fireEvent.keyDown(left, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(right);
  });

  it('moves past a menu trigger with Up and Down in a vertical toolbar', () => {
    render(
      <Toolbar.Root aria-label="t" orientation="vertical">
        <Button.Root>Undo</Button.Root>
        <Menu.Root>
          <Menu.Trigger>Insert</Menu.Trigger>
          <Menu.Content>
            <Menu.Item>Image</Menu.Item>
          </Menu.Content>
        </Menu.Root>
        <Button.Root>Redo</Button.Root>
      </Toolbar.Root>,
    );
    const insert = button('Insert');
    insert.focus();
    fireEvent.keyDown(insert, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(button('Redo'));
    expect(insert.getAttribute('aria-expanded')).not.toBe('true');
    fireEvent.keyDown(button('Redo'), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(insert);
  });

  it('takes in a control that becomes focusable later', () => {
    function Late() {
      const [focusable, setFocusable] = useState(false);
      return (
        <Toolbar.Root aria-label="t">
          <Button.Root onClick={() => setFocusable(true)}>A</Button.Root>
          <span data-testid="late" tabIndex={focusable ? 0 : undefined}>
            Late
          </span>
        </Toolbar.Root>
      );
    }
    render(<Late />);
    fireEvent.click(button('A'));
    button('A').focus();
    fireEvent.keyDown(button('A'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByTestId('late'));
  });
  it('leaves Shift with an arrow key to the control', () => {
    render(<Editor />);
    button('Bold').focus();
    fireEvent.keyDown(button('Bold'), { key: 'ArrowRight', shiftKey: true });
    expect(document.activeElement).toBe(button('Bold'));
  });

  it('marks a group and a nested separator with the toolbar orientation', () => {
    render(
      <Toolbar.Root aria-label="t" orientation="vertical">
        <Toolbar.Group aria-label="g" data-testid="group">
          <Button.Root>A</Button.Root>
          <Toolbar.Separator data-testid="sep" />
        </Toolbar.Group>
      </Toolbar.Root>,
    );
    expect(screen.getByTestId('group').getAttribute('data-orientation')).toBe('vertical');
    expect(screen.getByTestId('sep').getAttribute('aria-orientation')).toBe('horizontal');
  });
});
