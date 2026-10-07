import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from './Button';
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
const tabbable = () => [...document.querySelectorAll<HTMLElement>('[tabindex="0"]')];

describe('Toolbar', () => {
  it('has the toolbar role and one tab stop on the first control', () => {
    render(<Editor />);
    expect(screen.getByRole('toolbar', { name: 'Format' }).hasAttribute('aria-orientation')).toBe(false);
    expect(tabbable()).toEqual([button('Bold')]);
    expect(button('Italic').tabIndex).toBe(-1);
    expect(screen.getByRole('textbox').tabIndex).toBe(-1);
  });

  it('moves focus with arrow keys, skipping disabled controls and following wrappers', () => {
    render(<Editor />);
    button('Bold').focus();
    fireEvent.keyDown(button('Bold'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(button('Italic'));
    fireEvent.keyDown(button('Italic'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
    expect(tabbable()).toEqual([screen.getByRole('textbox')]);
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

  it('keeps the tab stop on a control that was clicked, and moves it off one that goes away', () => {
    function Removable() {
      const [shown, setShown] = useState(true);
      return (
        <Toolbar.Root aria-label="t">
          <Button.Root>A</Button.Root>
          {shown ? <Button.Root onClick={() => setShown(false)}>B</Button.Root> : null}
        </Toolbar.Root>
      );
    }
    render(<Removable />);
    button('B').focus();
    expect(tabbable()).toEqual([button('B')]);
    fireEvent.click(button('B'));
    expect(tabbable()).toEqual([button('A')]);
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
    expect(tabbable()).toEqual([button('Left')]);
    button('Left').focus();
    fireEvent.keyDown(button('Left'), { key: 'ArrowRight' });
    fireEvent.keyDown(button('Right'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(button('More'));
  });
});
