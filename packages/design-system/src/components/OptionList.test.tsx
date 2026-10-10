import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from '../index';
import { OptionList } from './OptionList';

afterEach(cleanup);

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'OptionList.module.css'), 'utf8');

describe('OptionList', () => {
  it('skips disabled options wrapped in fragments during keyboard navigation', () => {
    const onChange = vi.fn();
    render(
      <OptionList.Root value={null} onValueChange={onChange} aria-label="Fruit">
        <OptionList.Option value="a">A</OptionList.Option>
        <>
          <OptionList.Option value="b" disabled>
            B
          </OptionList.Option>
          {['c', 'd'].map((v) => (
            <OptionList.Option key={v} value={v}>
              {v.toUpperCase()}
            </OptionList.Option>
          ))}
        </>
      </OptionList.Root>,
    );
    const list = screen.getByRole('listbox');
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('names OptionList.Root when an option renders outside it', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<OptionList.Option value="a">A</OptionList.Option>)).toThrow(
      'OptionList.Option must render inside OptionList.Root',
    );
    spy.mockRestore();
  });

  it('exposes Option only as OptionList.Option', () => {
    expect(typeof OptionList.Option).toBe('function');
    expect('Option' in api).toBe(false);
  });

  it('renders a listbox with string options and activedescendant', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <OptionList.Root value="pear" onValueChange={() => undefined} aria-label="Fruit">
        <OptionList.Option value="apple">Apple</OptionList.Option>
        <OptionList.Option value="pear">Pear</OptionList.Option>
        <OptionList.Option value="bad">{['nope'] as unknown as string}</OptionList.Option>
      </OptionList.Root>,
    );
    const list = screen.getByRole('listbox', { name: 'Fruit' });
    expect(list.getAttribute('aria-multiselectable')).toBeNull();
    const options = screen.getAllByRole('option');
    expect(options.map((el) => el.textContent)).toEqual(['Apple', 'Pear', 'nope']);
    expect(options[1]?.getAttribute('aria-selected')).toBe('true');
    expect(list.getAttribute('aria-activedescendant')).toBe(options[1]?.id);
    expect(options.every((el) => el.getAttribute('tabindex') === null)).toBe(true);
    expect(error).toHaveBeenCalledWith('OptionList.Option children must be a string');
    error.mockRestore();
  });

  it('fires onChange(string) for single selection', () => {
    const onChange = vi.fn();
    render(
      <OptionList.Root value={null} onValueChange={onChange} aria-label="Fruit">
        <OptionList.Option value="apple">Apple</OptionList.Option>
        <OptionList.Option value="pear">Pear</OptionList.Option>
      </OptionList.Root>,
    );
    fireEvent.click(screen.getByRole('option', { name: 'Pear' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('pear');
  });

  it('toggles values for multiple selection', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <OptionList.Root selectionMode="multiple" value={['apple']} onValueChange={onChange} aria-label="Fruit">
        <OptionList.Option value="apple">Apple</OptionList.Option>
        <OptionList.Option value="pear">Pear</OptionList.Option>
      </OptionList.Root>,
    );
    expect(screen.getByRole('listbox').getAttribute('aria-multiselectable')).toBe('true');
    expect(screen.getByRole('listbox').getAttribute('data-selection-mode')).toBe('multiple');
    fireEvent.click(screen.getByRole('option', { name: 'Pear' }));
    expect(onChange).toHaveBeenCalledWith(['apple', 'pear']);
    rerender(
      <OptionList.Root selectionMode="multiple" value={['apple', 'pear']} onValueChange={onChange} aria-label="Fruit">
        <OptionList.Option value="apple">Apple</OptionList.Option>
        <OptionList.Option value="pear">Pear</OptionList.Option>
      </OptionList.Root>,
    );
    fireEvent.click(screen.getByRole('option', { name: 'Apple' }));
    expect(onChange).toHaveBeenLastCalledWith(['pear']);
  });

  it('moves with arrows home end and selects with enter or space', () => {
    const onChange = vi.fn();
    render(
      <OptionList.Root value={null} onValueChange={onChange} aria-label="Fruit">
        <OptionList.Option value="apple">Apple</OptionList.Option>
        <OptionList.Option value="skip" disabled>
          Skip
        </OptionList.Option>
        <OptionList.Option value="pear">Pear</OptionList.Option>
      </OptionList.Root>,
    );
    const list = screen.getByRole('listbox');
    list.focus();
    fireEvent.keyDown(list, { key: 'End' });
    expect(list.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Pear' }).id);
    fireEvent.keyDown(list, { key: 'Home' });
    expect(list.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Apple' }).id);
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(list.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Pear' }).id);
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('pear');
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    fireEvent.keyDown(list, { key: ' ' });
    expect(onChange).toHaveBeenLastCalledWith('apple');
    fireEvent.click(screen.getByRole('option', { name: 'Skip' }));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('highlights only the keyboard row and clears after pointer select', () => {
    const onChange = vi.fn();
    render(
      <OptionList.Root value={null} onValueChange={onChange} aria-label="Fruit">
        <OptionList.Option value="apple">Apple</OptionList.Option>
        <OptionList.Option value="pear">Pear</OptionList.Option>
      </OptionList.Root>,
    );
    const list = screen.getByRole('listbox');
    expect(screen.getByRole('option', { name: 'Apple' }).hasAttribute('data-highlighted')).toBe(false);
    list.focus();
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: 'Pear' }).hasAttribute('data-highlighted')).toBe(true);
    fireEvent.click(screen.getByRole('option', { name: 'Apple' }));
    expect(onChange).toHaveBeenCalledWith('apple');
    expect(screen.getByRole('option', { name: 'Apple' }).hasAttribute('data-highlighted')).toBe(false);
  });

  it('honors controlled activeValue, id, and tabIndex', () => {
    const { rerender } = render(
      <OptionList.Root
        id="fruit"
        tabIndex={-1}
        activeValue="pear"
        value={null}
        onValueChange={() => undefined}
        aria-label="Fruit"
      >
        <OptionList.Option value="apple">Apple</OptionList.Option>
        <OptionList.Option value="pear">Pear</OptionList.Option>
      </OptionList.Root>,
    );
    const list = screen.getByRole('listbox', { name: 'Fruit' });
    expect(list).toHaveProperty('id', 'fruit');
    expect(list).toHaveProperty('tabIndex', -1);
    expect(list.getAttribute('aria-activedescendant')).toBe('fruit-opt-pear');
    rerender(
      <OptionList.Root
        id="fruit"
        tabIndex={-1}
        activeValue="apple"
        value={null}
        onValueChange={() => undefined}
        aria-label="Fruit"
      >
        <OptionList.Option value="apple">Apple</OptionList.Option>
        <OptionList.Option value="pear">Pear</OptionList.Option>
      </OptionList.Root>,
    );
    expect(screen.getByRole('listbox').getAttribute('aria-activedescendant')).toBe('fruit-opt-apple');
    expect(screen.getByRole('option', { name: 'Apple' }).hasAttribute('data-highlighted')).toBe(true);
  });

  it('fires onActiveValueChange on arrow keys', () => {
    const onActiveValueChange = vi.fn();
    render(
      <OptionList.Root
        id="fruit"
        activeValue="apple"
        onActiveValueChange={onActiveValueChange}
        value={null}
        onValueChange={() => undefined}
        aria-label="Fruit"
      >
        <OptionList.Option value="apple">Apple</OptionList.Option>
        <OptionList.Option value="pear">Pear</OptionList.Option>
      </OptionList.Root>,
    );
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' });
    expect(onActiveValueChange).toHaveBeenCalledWith('pear');
  });

  it('lets Escape bubble', () => {
    const onChange = vi.fn();
    const onEscape = vi.fn();
    render(
      <div onKeyDown={(event) => event.key === 'Escape' && onEscape()}>
        <OptionList.Root value={null} onValueChange={onChange} aria-label="Fruit">
          <OptionList.Option value="apple">Apple</OptionList.Option>
        </OptionList.Root>
      </div>,
    );
    const list = screen.getByRole('listbox');
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    list.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps selected weight at the regular token and paints selected fill', () => {
    expect(css).toMatch(/font-weight:\s*var\(--todae-option-font-weight\)/);
    expect(css).not.toMatch(/data-selected[^{]*\{[^}]*font-weight/);
    expect(css).toMatch(/gap:\s*var\(--todae-option-list-gap\)/);
    expect(css).toMatch(/-webkit-tap-highlight-color:\s*transparent/);
    expect(css).toMatch(/@media\s*\(hover:\s*hover\)/);
    expect(css).toMatch(/\.option\[data-selected\][^{]*\{[^}]*--todae-option-bg-selected/);
    expect(css).not.toMatch(/\.list:hover[^{]*\{[^}]*--todae-option-bg-hover/);
  });
});

describe('OptionList.Root types', () => {
  it('rejects the old onChange name', () => {
    expect(() => (
      <OptionList.Root
        value={null}
        onValueChange={() => undefined}
        // @ts-expect-error onChange was renamed to onValueChange.
        onChange={() => undefined}
        aria-label="Fruit"
      >
        <OptionList.Option value="apple">Apple</OptionList.Option>
      </OptionList.Root>
    )).not.toThrow();
  });
});
