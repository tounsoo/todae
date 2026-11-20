import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from './Button.js';
import { ToggleGroup } from './ToggleGroup.js';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, 'ToggleGroup.module.css'), 'utf8');
const buttonCss = readFileSync(join(here, 'Button.module.css'), 'utf8');
const tokenSource = readFileSync(join(here, '../../tokens/components/toggle-group.json'), 'utf8');
const tokenCss = readFileSync(join(here, '../styles/tokens.generated.css'), 'utf8');

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

  it('keeps the pressed item pressed when required, and still moves to another item', () => {
    const onChange = vi.fn();
    render(
      <ToggleGroup.Root aria-label="Align" required defaultValue="left" onValueChange={onChange}>
        <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
        <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
      </ToggleGroup.Root>,
    );
    fireEvent.click(button('Left'));
    expect(pressed('Left')).toBe('true');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(button('Center'));
    expect([pressed('Left'), pressed('Center')]).toEqual(['false', 'true']);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith('center');
    fireEvent.click(button('Center'));
    expect(pressed('Center')).toBe('true');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls.some((call) => call[0] === null)).toBe(false);
  });

  it('rejects required on a multiple group, and null for a required value', () => {
    expect(() => (
      // @ts-expect-error required is single mode only.
      <ToggleGroup.Root aria-label="Style" selectionMode="multiple" required>
        <ToggleGroup.Item value="bold">Bold</ToggleGroup.Item>
      </ToggleGroup.Root>
    )).not.toThrow();
    expect(() => (
      // @ts-expect-error a required value is a string, so it cannot be null.
      <ToggleGroup.Root aria-label="Align" required value={null}>
        <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
      </ToggleGroup.Root>
    )).not.toThrow();
  });

  it('leaves an aria-disabled item unpressed on click, and keeps it focusable', () => {
    const onChange = vi.fn();
    render(
      <ToggleGroup.Root aria-label="Align" defaultValue="left" onValueChange={onChange}>
        <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
        <ToggleGroup.Item value="center" aria-disabled>
          Center
        </ToggleGroup.Item>
      </ToggleGroup.Root>,
    );
    fireEvent.click(button('Center'));
    expect([pressed('Left'), pressed('Center')]).toEqual(['true', 'false']);
    expect(onChange).not.toHaveBeenCalled();
    button('Center').focus();
    expect(document.activeElement).toBe(button('Center'));
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

describe('ToggleGroup layout and border token', () => {
  it('wraps a horizontal group and keeps each line a joined row', () => {
    expect(css).toContain('flex-wrap: wrap');
    expect(css).toContain('max-inline-size: 100%');
    expect(css).toContain('data-line-start');
    expect(css).toContain('data-line-end');
    expect(buttonCss).toContain('--_join-overlap');
    expect(buttonCss).toContain('--_join-radius-start-start');
  });

  it('gives an unpressed segment togglegroup.item.border.default, matching the secondary border', () => {
    const tokens = JSON.parse(tokenSource) as {
      togglegroup: { item: { border: { default: { $type: string; $value: { $ref: string } } } } };
    };
    expect(tokens.togglegroup.item.border.default).toEqual({
      $type: 'color',
      $value: { $ref: '#/button/secondary/border/default/$value' },
    });
    expect(tokenCss).toContain(
      '--todae-togglegroup-item-border-default: var(--_todae-togglegroup-item-border-default, var(--todae-button-secondary-border-default))',
    );
    expect(css).toContain('--_button-border-default: var(--todae-togglegroup-item-border-default)');
  });
});

describe('ToggleGroup read-only value', () => {
  it('with a read-only value, does not render on a press', () => {
    let commits = 0;
    render(
      <Profiler id="group" onRender={() => (commits += 1)}>
        <ToggleGroup.Root selectionMode="single" value="a" aria-label="Align">
          <ToggleGroup.Item value="a">A</ToggleGroup.Item>
          <ToggleGroup.Item value="b">B</ToggleGroup.Item>
        </ToggleGroup.Root>
      </Profiler>,
    );
    const before = commits;
    fireEvent.click(button('B'));
    fireEvent.click(button('A'));
    expect(commits).toBe(before);
    expect(button('A').getAttribute('aria-pressed')).toBe('true');
    expect(button('B').getAttribute('aria-pressed')).toBe('false');
  });
});
