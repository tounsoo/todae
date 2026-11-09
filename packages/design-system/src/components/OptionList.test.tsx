import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from '../index.js';
import { OptionList } from './OptionList.js';

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

  it('keeps an aria-disabled option reachable but never selects it', () => {
    const onChange = vi.fn();
    render(
      <OptionList.Root value={null} onValueChange={onChange} aria-label="Fruit">
        <OptionList.Option value="a">A</OptionList.Option>
        <OptionList.Option value="b" aria-disabled>
          B
        </OptionList.Option>
        <OptionList.Option value="c" aria-disabled="false">
          C
        </OptionList.Option>
      </OptionList.Root>,
    );
    const list = screen.getByRole('listbox');
    const b = screen.getByRole('option', { name: 'B' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(list.getAttribute('aria-activedescendant')).toBe(b.id);
    fireEvent.keyDown(list, { key: 'Enter' });
    fireEvent.keyDown(list, { key: ' ' });
    fireEvent.click(b);
    expect(onChange).not.toHaveBeenCalled();
    const c = screen.getByRole('option', { name: 'C' });
    expect(c.hasAttribute('aria-disabled')).toBe(false);
    fireEvent.click(c);
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('makes a clicked aria-disabled option active without selecting it, and ignores a click on a disabled one', () => {
    const onChange = vi.fn();
    const onActiveValueChange = vi.fn();
    render(
      <OptionList.Root value={null} onValueChange={onChange} onActiveValueChange={onActiveValueChange} aria-label="Fruit">
        <OptionList.Option value="a">A</OptionList.Option>
        <OptionList.Option value="b" aria-disabled>
          B
        </OptionList.Option>
        <OptionList.Option value="c" disabled>
          C
        </OptionList.Option>
      </OptionList.Root>,
    );
    const list = screen.getByRole('listbox');
    const b = screen.getByRole('option', { name: 'B' });
    fireEvent.click(b);
    expect(onChange).not.toHaveBeenCalled();
    expect(onActiveValueChange).toHaveBeenCalledWith('b');
    expect(list.getAttribute('aria-activedescendant')).toBe(b.id);
    onActiveValueChange.mockClear();
    fireEvent.click(screen.getByRole('option', { name: 'C' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(onActiveValueChange).not.toHaveBeenCalled();
    expect(list.getAttribute('aria-activedescendant')).toBe(b.id);
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

  describe('typeahead', () => {
    function Fruit({ onValueChange = () => undefined }: { onValueChange?: (value: string) => void }) {
      return (
        <OptionList.Root value={null} onValueChange={onValueChange} aria-label="Fruit">
          <OptionList.Option value="apple">Apple</OptionList.Option>
          <OptionList.Option value="banana">Banana</OptionList.Option>
          <OptionList.Option value="blackberry" disabled>
            Blackberry
          </OptionList.Option>
          <OptionList.Option value="blueberry">Blueberry</OptionList.Option>
          <OptionList.Option value="cherry">Cherry</OptionList.Option>
        </OptionList.Root>
      );
    }
    // A key pressed at `at` ms, so the search's timing is the test's.
    function type(list: HTMLElement, key: string, at: number, init: KeyboardEventInit = {}) {
      const event = createEvent.keyDown(list, { key, ...init });
      Object.defineProperty(event, 'timeStamp', { value: at });
      fireEvent(list, event);
      return event;
    }
    const active = (list: HTMLElement) => list.getAttribute('aria-activedescendant');
    const idOf = (name: string) => screen.getByRole('option', { name }).id;

    it('cycles through the options that start with a letter typed again, skipping disabled ones', () => {
      render(<Fruit />);
      const list = screen.getByRole('listbox');
      expect(type(list, 'b', 1000).defaultPrevented).toBe(true);
      expect(active(list)).toBe(idOf('Banana'));
      type(list, 'b', 1100);
      expect(active(list)).toBe(idOf('Blueberry'));
      type(list, 'b', 1200);
      expect(active(list)).toBe(idOf('Banana'));
    });

    it('matches a longer prefix, case aside, and starts over after a pause', () => {
      render(<Fruit />);
      const list = screen.getByRole('listbox');
      type(list, 'B', 1000);
      type(list, 'l', 1100);
      expect(active(list)).toBe(idOf('Blueberry'));
      type(list, 'c', 2000);
      expect(active(list)).toBe(idOf('Cherry'));
    });

    it('lets a Space join a search under way and otherwise select', () => {
      const onValueChange = vi.fn();
      render(<Fruit onValueChange={onValueChange} />);
      const list = screen.getByRole('listbox');
      type(list, 'c', 1000);
      expect(type(list, ' ', 1100).defaultPrevented).toBe(true);
      expect(onValueChange).not.toHaveBeenCalled();
      type(list, ' ', 2000);
      expect(onValueChange).toHaveBeenCalledWith('cherry');
    });

    it('keeps the active option on a letter nothing starts with', () => {
      render(<Fruit />);
      const list = screen.getByRole('listbox');
      type(list, 'c', 1000);
      expect(type(list, 'z', 3000).defaultPrevented).toBe(false);
      expect(active(list)).toBe(idOf('Cherry'));
    });
  });

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Meta', { metaKey: true }],
    ['Alt', { altKey: true }],
  ])('leaves keys with %s to the page', (_, modifier) => {
    const onChange = vi.fn();
    render(
      <OptionList.Root value={null} onValueChange={onChange} aria-label="Fruit">
        <OptionList.Option value="apple">Apple</OptionList.Option>
        <OptionList.Option value="pear">Pear</OptionList.Option>
      </OptionList.Root>,
    );
    const list = screen.getByRole('listbox');
    const first = list.getAttribute('aria-activedescendant');
    for (const key of ['ArrowDown', 'End', 'p', 'Enter']) {
      expect(fireEvent.keyDown(list, { key, ...modifier })).toBe(true);
    }
    expect(list.getAttribute('aria-activedescendant')).toBe(first);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves Shift with a move key to the owner, and still selects with Shift+Enter', () => {
    const onChange = vi.fn();
    render(
      <OptionList.Root value={null} onValueChange={onChange} aria-label="Fruit">
        <OptionList.Option value="apple">Apple</OptionList.Option>
        <OptionList.Option value="pear">Pear</OptionList.Option>
      </OptionList.Root>,
    );
    const list = screen.getByRole('listbox');
    const first = list.getAttribute('aria-activedescendant');
    expect(fireEvent.keyDown(list, { key: 'ArrowDown', shiftKey: true })).toBe(true);
    expect(list.getAttribute('aria-activedescendant')).toBe(first);
    fireEvent.keyDown(list, { key: 'Enter', shiftKey: true });
    expect(onChange).toHaveBeenCalledWith('apple');
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

describe('OptionList inline, with its requested option arriving after mount', () => {
  const ITEMS = Array.from({ length: 40 }, (_, i) => `Fruit ${i + 1}`);

  function Page({ items }: { items: string[] }) {
    return (
      <main data-testid="main" style={{ overflowY: 'auto' }}>
        <OptionList.Root value={null} onValueChange={() => undefined} activeValue="Fruit 30" aria-label="Fruit">
          {items.map((item) => (
            <OptionList.Option key={item} value={item}>
              {item}
            </OptionList.Option>
          ))}
        </OptionList.Root>
      </main>
    );
  }

  it('scrolls the page area around it neither on mount nor as its options load', () => {
    // The app's main area scrolls 1600px of content in 200px, each option 40px tall.
    const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.tagName === 'MAIN' ? 1600 : 0;
    });
    const client = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.tagName === 'MAIN' ? 200 : 0;
    });
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.tagName === 'MAIN') return new DOMRect(0, 0, 300, 200);
      if (this.getAttribute('role') === 'option') return new DOMRect(0, [...this.parentElement!.children].indexOf(this) * 40, 300, 40);
      return new DOMRect(0, 0, 0, 0);
    });
    try {
      const { rerender } = render(<Page items={[]} />);
      rerender(<Page items={ITEMS} />);
      expect(screen.getByTestId('main').scrollTop).toBe(0);
    } finally {
      height.mockRestore();
      client.mockRestore();
      rect.mockRestore();
    }
  });
  it('scrolls nothing when it mounts later inside a dialog already open', () => {
    // A wizard's second step: the dialog was open before the list mounted.
    function Step({ items }: { items: string[] }) {
      return (
        <dialog open>
          <main data-testid="main" style={{ overflowY: 'auto' }}>
            <OptionList.Root value={null} onValueChange={() => undefined} activeValue="Fruit 30" aria-label="Fruit">
              {items.map((item) => (
                <OptionList.Option key={item} value={item}>
                  {item}
                </OptionList.Option>
              ))}
            </OptionList.Root>
          </main>
        </dialog>
      );
    }
    const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.tagName === 'MAIN' ? 1600 : 0;
    });
    const client = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.tagName === 'MAIN' ? 200 : 0;
    });
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.tagName === 'MAIN') return new DOMRect(0, 0, 300, 200);
      if (this.getAttribute('role') === 'option') return new DOMRect(0, [...this.parentElement!.children].indexOf(this) * 40, 300, 40);
      return new DOMRect(0, 0, 0, 0);
    });
    try {
      const { rerender } = render(<Step items={[]} />);
      rerender(<Step items={ITEMS} />);
      expect(screen.getByTestId('main').scrollTop).toBe(0);
    } finally {
      height.mockRestore();
      client.mockRestore();
      rect.mockRestore();
    }
  });
});
