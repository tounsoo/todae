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
    // The browser moves focus while the Tab key is dispatched.
    fireEvent.keyDown(button('Before'), { key: 'Tab' });
    button('A').focus();
    expect(document.activeElement).toBe(button('B'));
  });

  it('lets focus from a click or a script land where it was aimed after Tab left', async () => {
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
    // A later focus, after that key press is over.
    await new Promise((resolve) => setTimeout(resolve));
    button('A').focus();
    expect(document.activeElement).toBe(button('A'));
  });

  it('gives selects, textareas, editable text and arrow-key widgets their own Tab stop', () => {
    render(
      <Toolbar.Root aria-label="t">
        <Button.Root>A</Button.Root>
        <select aria-label="Font">
          <option>Serif</option>
        </select>
        <Button.Root>B</Button.Root>
        <textarea aria-label="Note" />
        <Button.Root>C</Button.Root>
        <div role="listbox" tabIndex={0} aria-label="List" />
        <Button.Root>D</Button.Root>
        <div contentEditable suppressContentEditableWarning aria-label="Edit">
          x
        </div>
        <Button.Root>E</Button.Root>
      </Toolbar.Root>,
    );
    for (const [from, to] of [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'D'],
      ['D', 'E'],
    ]) {
      button(from!).focus();
      // Each control ends a run, so Tab stays on the button and the browser moves on to it.
      fireEvent.keyDown(button(from!), { key: 'Tab' });
      expect(document.activeElement).toBe(button(from!));
      fireEvent.keyDown(button(from!), { key: 'ArrowRight' });
      expect(document.activeElement).toBe(button(to!));
    }
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

  it('leaves Up and Down to a menu trigger portaled out of a vertical toolbar', async () => {
    render(
      <Toolbar.Root aria-label="t" orientation="vertical">
        <Button.Root>A</Button.Root>
        {createPortal(
          <Menu.Root>
            <Menu.Trigger>More</Menu.Trigger>
            <Menu.Content>
              <Menu.Item>One</Menu.Item>
            </Menu.Content>
          </Menu.Root>,
          document.body,
        )}
      </Toolbar.Root>,
    );
    const more = button('More');
    more.focus();
    // The trigger notices it is outside the toolbar after mounting.
    await waitFor(() => {
      fireEvent.keyDown(more, { key: 'ArrowDown' });
      expect(more.getAttribute('aria-expanded')).toBe('true');
    });
  });

  it('treats the items of an outside tablist or radiogroup as their own stop', () => {
    render(
      <Toolbar.Root aria-label="t">
        <Button.Root>A</Button.Root>
        <div role="tablist" aria-label="Views">
          <button type="button" role="tab" aria-selected="true">
            One
          </button>
          <button type="button" role="tab" aria-selected="false" tabIndex={-1}>
            Two
          </button>
        </div>
        <Button.Root>B</Button.Root>
      </Toolbar.Root>,
    );
    button('A').focus();
    fireEvent.keyDown(button('A'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(button('B'));
  });

  it('forgets the control Tab left from once focus comes back another way', async () => {
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
    button('C').focus();
    fireEvent.keyDown(button('C'), { key: 'Tab', shiftKey: true });
    button('Before').focus();
    await new Promise((resolve) => setTimeout(resolve));
    // A script or screen reader moves focus in, then focus leaves again.
    button('B').focus();
    button('Before').focus();
    fireEvent.keyDown(button('Before'), { key: 'Tab' });
    button('A').focus();
    expect(document.activeElement).toBe(button('A'));
  });

  it('keeps a focus target with tabindex -1 out of the arrow keys', () => {
    render(
      <Toolbar.Root aria-label="t">
        <Button.Root>A</Button.Root>
        <div tabIndex={-1} data-testid="scroller">
          <Button.Root>B</Button.Root>
        </div>
      </Toolbar.Root>,
    );
    button('A').focus();
    fireEvent.keyDown(button('A'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(button('B'));
  });

  it('ends a run at an open layer inside it, so Tab reaches the layer', () => {
    render(
      <Toolbar.Root aria-label="t">
        <Button.Root>A</Button.Root>
        <div popover="manual" data-testid="layer">
          <button type="button">Save</button>
        </div>
        <Button.Root>B</Button.Root>
      </Toolbar.Root>,
    );
    button('A').focus();
    fireEvent.keyDown(button('A'), { key: 'Tab' });
    // jsdom renders the layer, so it counts as open.
    expect(document.activeElement).toBe(button('A'));
  });

  it('does not split a run at a control Tab skips', () => {
    render(
      <Toolbar.Root aria-label="t">
        <Button.Root>A</Button.Root>
        <Button.Root>B</Button.Root>
        <input aria-label="Size" tabIndex={-1} readOnly />
        <Button.Root>C</Button.Root>
      </Toolbar.Root>,
    );
    button('A').focus();
    fireEvent.keyDown(button('A'), { key: 'Tab' });
    expect(document.activeElement).toBe(button('C'));
  });

  it('keeps a button with tabindex -1 out of the arrow keys', () => {
    render(
      <Toolbar.Root aria-label="t">
        <Button.Root>A</Button.Root>
        <Button.Root tabIndex={-1}>Clear</Button.Root>
        <Button.Root>B</Button.Root>
      </Toolbar.Root>,
    );
    button('A').focus();
    fireEvent.keyDown(button('A'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(button('B'));
  });

  it('lets a vertical toolbar menu trigger move into its menu once open', async () => {
    render(
      <Toolbar.Root aria-label="t" orientation="vertical">
        <Menu.Root open onOpenChange={() => undefined}>
          <Menu.Trigger>Insert</Menu.Trigger>
          <Menu.Content>
            <Menu.Item>Image</Menu.Item>
          </Menu.Content>
        </Menu.Root>
        <Button.Root>Redo</Button.Root>
      </Toolbar.Root>,
    );
    const insert = screen.getByRole('button', { name: 'Insert' });
    insert.focus();
    fireEvent.keyDown(insert, { key: 'ArrowDown' });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Image', hidden: true })));
  });

  it('counts a Tab whose propagation was stopped, but not one that was prevented', () => {
    function Page() {
      return (
        <>
          <button type="button" onKeyDown={(event) => event.stopPropagation()}>
            Stops
          </button>
          <button type="button" onKeyDown={(event) => event.preventDefault()}>
            Prevents
          </button>
          <Toolbar.Root aria-label="t">
            <Button.Root>A</Button.Root>
            <Button.Root>B</Button.Root>
          </Toolbar.Root>
        </>
      );
    }
    render(<Page />);
    button('B').focus();
    fireEvent.keyDown(button('B'), { key: 'Tab', shiftKey: true });
    button('Stops').focus();
    fireEvent.keyDown(button('Stops'), { key: 'Tab' });
    button('A').focus();
    expect(document.activeElement).toBe(button('B'));
    fireEvent.keyDown(button('B'), { key: 'Tab', shiftKey: true });
    button('Prevents').focus();
    fireEvent.keyDown(button('Prevents'), { key: 'Tab' });
    // A script moves focus after preventing Tab: it lands where it was aimed.
    button('A').focus();
    expect(document.activeElement).toBe(button('A'));
  });

  it('returns to the control Tab left from most recently, past an older one that comes back', async () => {
    function Page({ off }: { off: boolean }) {
      return (
        <>
          <button type="button">Before</button>
          <Toolbar.Root aria-label="t">
            <Button.Root>A</Button.Root>
            <Button.Root disabled={off}>B</Button.Root>
            <Button.Root>C</Button.Root>
          </Toolbar.Root>
        </>
      );
    }
    const { rerender } = render(<Page off={false} />);
    const tick = () => new Promise((resolve) => setTimeout(resolve));
    button('B').focus();
    fireEvent.keyDown(button('B'), { key: 'Tab', shiftKey: true });
    button('Before').focus();
    await tick();
    rerender(<Page off />);
    button('C').focus();
    await tick();
    fireEvent.keyDown(button('C'), { key: 'Tab', shiftKey: true });
    button('Before').focus();
    await tick();
    rerender(<Page off={false} />);
    fireEvent.keyDown(button('Before'), { key: 'Tab' });
    button('A').focus();
    expect(document.activeElement).toBe(button('C'));
  });

  it('leaves a toggle group inside a plain role=toolbar its own roving focus', async () => {
    render(
      <Toolbar.Root aria-label="t">
        <Button.Root>A</Button.Root>
        <div role="toolbar" aria-label="inner">
          <ToggleGroup.Root aria-label="Align" defaultValue="left">
            <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
            <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
          </ToggleGroup.Root>
        </div>
      </Toolbar.Root>,
    );
    await waitFor(() => expect([button('Left').tabIndex, button('Right').tabIndex]).toEqual([0, -1]));
  });

  it('moves on with the arrow keys from a control that became disabled while focused', () => {
    function Page({ off }: { off: boolean }) {
      return (
        <Toolbar.Root aria-label="t">
          <Button.Root>A</Button.Root>
          <Button.Root disabled={off}>Undo</Button.Root>
          <Button.Root>Redo</Button.Root>
        </Toolbar.Root>
      );
    }
    const { rerender } = render(<Page off={false} />);
    button('Undo').focus();
    rerender(<Page off />);
    fireEvent.keyDown(button('Undo'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(button('Redo'));
    button('Undo').focus();
    fireEvent.keyDown(button('Undo'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(button('A'));
  });
});
