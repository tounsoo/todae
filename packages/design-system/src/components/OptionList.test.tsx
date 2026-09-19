import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Option, OptionList } from './OptionList';

afterEach(cleanup);

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'OptionList.module.css'), 'utf8');

describe('OptionList', () => {
  it('exposes Option as OptionList.Option', () => {
    expect(OptionList.Option).toBe(Option);
  });

  it('renders a listbox with string options and activedescendant', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <OptionList value="pear" onChange={() => undefined} aria-label="Fruit">
        <Option value="apple">Apple</Option>
        <Option value="pear">Pear</Option>
        <Option value="bad">{['nope'] as unknown as string}</Option>
      </OptionList>,
    );
    const list = screen.getByRole('listbox', { name: 'Fruit' });
    expect(list.getAttribute('aria-multiselectable')).toBeNull();
    const options = screen.getAllByRole('option');
    expect(options.map((el) => el.textContent)).toEqual(['Apple', 'Pear', 'nope']);
    expect(options[1]?.getAttribute('aria-selected')).toBe('true');
    expect(list.getAttribute('aria-activedescendant')).toBe(options[1]?.id);
    expect(options.every((el) => el.getAttribute('tabindex') === null)).toBe(true);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('fires onChange(string) for single selection', () => {
    const onChange = vi.fn();
    render(
      <OptionList value={null} onChange={onChange} aria-label="Fruit">
        <Option value="apple">Apple</Option>
        <Option value="pear">Pear</Option>
      </OptionList>,
    );
    fireEvent.click(screen.getByRole('option', { name: 'Pear' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('pear');
  });

  it('toggles values for multiple selection', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <OptionList selectionMode="multiple" value={['apple']} onChange={onChange} aria-label="Fruit">
        <Option value="apple">Apple</Option>
        <Option value="pear">Pear</Option>
      </OptionList>,
    );
    expect(screen.getByRole('listbox').getAttribute('aria-multiselectable')).toBe('true');
    expect(screen.getByRole('listbox').getAttribute('data-selection-mode')).toBe('multiple');
    fireEvent.click(screen.getByRole('option', { name: 'Pear' }));
    expect(onChange).toHaveBeenCalledWith(['apple', 'pear']);
    rerender(
      <OptionList selectionMode="multiple" value={['apple', 'pear']} onChange={onChange} aria-label="Fruit">
        <Option value="apple">Apple</Option>
        <Option value="pear">Pear</Option>
      </OptionList>,
    );
    fireEvent.click(screen.getByRole('option', { name: 'Apple' }));
    expect(onChange).toHaveBeenLastCalledWith(['pear']);
  });

  it('moves with arrows home end and selects with enter or space', () => {
    const onChange = vi.fn();
    render(
      <OptionList value={null} onChange={onChange} aria-label="Fruit">
        <Option value="apple">Apple</Option>
        <Option value="skip" disabled>
          Skip
        </Option>
        <Option value="pear">Pear</Option>
      </OptionList>,
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
      <OptionList value={null} onChange={onChange} aria-label="Fruit">
        <Option value="apple">Apple</Option>
        <Option value="pear">Pear</Option>
      </OptionList>,
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
      <OptionList
        id="fruit"
        tabIndex={-1}
        activeValue="pear"
        value={null}
        onChange={() => undefined}
        aria-label="Fruit"
      >
        <Option value="apple">Apple</Option>
        <Option value="pear">Pear</Option>
      </OptionList>,
    );
    const list = screen.getByRole('listbox', { name: 'Fruit' });
    expect(list).toHaveProperty('id', 'fruit');
    expect(list).toHaveProperty('tabIndex', -1);
    expect(list.getAttribute('aria-activedescendant')).toBe('fruit-opt-pear');
    rerender(
      <OptionList
        id="fruit"
        tabIndex={-1}
        activeValue="apple"
        value={null}
        onChange={() => undefined}
        aria-label="Fruit"
      >
        <Option value="apple">Apple</Option>
        <Option value="pear">Pear</Option>
      </OptionList>,
    );
    expect(screen.getByRole('listbox').getAttribute('aria-activedescendant')).toBe('fruit-opt-apple');
    expect(screen.getByRole('option', { name: 'Apple' }).hasAttribute('data-highlighted')).toBe(true);
  });

  it('fires onActiveChange on arrow keys', () => {
    const onActiveChange = vi.fn();
    render(
      <OptionList
        id="fruit"
        activeValue="apple"
        onActiveChange={onActiveChange}
        value={null}
        onChange={() => undefined}
        aria-label="Fruit"
      >
        <Option value="apple">Apple</Option>
        <Option value="pear">Pear</Option>
      </OptionList>,
    );
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' });
    expect(onActiveChange).toHaveBeenCalledWith('pear');
  });

  it('lets Escape bubble', () => {
    const onChange = vi.fn();
    const onEscape = vi.fn();
    render(
      <div onKeyDown={(event) => event.key === 'Escape' && onEscape()}>
        <OptionList value={null} onChange={onChange} aria-label="Fruit">
          <Option value="apple">Apple</Option>
        </OptionList>
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
    expect(css).toMatch(/--todae-option-list-gap:\s*2px/);
    expect(css).toMatch(/-webkit-tap-highlight-color:\s*transparent/);
    expect(css).toMatch(/@media\s*\(hover:\s*hover\)/);
    expect(css).toMatch(/\.option\[data-selected\][^{]*\{[^}]*--todae-option-bg-selected/);
    expect(css).not.toMatch(/\.list:hover[^{]*\{[^}]*--todae-option-bg-hover/);
  });
});
