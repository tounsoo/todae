import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChipField } from './ChipField';

afterEach(cleanup);

function renderField(
  props: Partial<ComponentProps<typeof ChipField>> & {
    chips?: string[];
    inputValue?: string;
  } = {},
) {
  const onInputValueChange = props.onInputValueChange ?? vi.fn();
  const onCommit = props.onCommit ?? vi.fn();
  const onChipRemove = props.onChipRemove ?? vi.fn();
  const result = render(
    <ChipField
      chips={props.chips ?? ['Alpha', 'Beta', 'Gamma']}
      inputValue={props.inputValue ?? ''}
      onInputValueChange={onInputValueChange}
      onCommit={onCommit}
      onChipRemove={onChipRemove}
      {...props}
    />,
  );
  return { ...result, onInputValueChange, onCommit, onChipRemove };
}

describe('ChipField', () => {
  it('renders one chip per value plus a controlled input', () => {
    renderField({ chips: ['Alpha', 'Beta'], inputValue: 'x' });
    expect(screen.getByRole('button', { name: 'Remove Alpha' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove Beta' })).toBeTruthy();
    expect(screen.getByRole('textbox')).toHaveProperty('value', 'x');
  });

  it('forwards typing and commits a trimmed value without mutating chips', () => {
    const { onInputValueChange, onCommit } = renderField({
      chips: ['Alpha'],
      inputValue: '  foo ',
    });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'z' } });
    expect(onInputValueChange).toHaveBeenCalledWith('z');
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('foo');
    expect(screen.getAllByRole('button', { name: /Remove / })).toHaveLength(1);
    expect(screen.getByRole('textbox')).toHaveProperty('value', '  foo ');
  });

  it('does not commit or prevent default on empty Enter', () => {
    const { onCommit } = renderField({ inputValue: '   ' });
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    screen.getByRole('textbox').dispatchEvent(event);
    expect(onCommit).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('honors commitKeys and drops unknown keys', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const comma = vi.fn();
    const { rerender, onCommit } = renderField({
      inputValue: 'tag',
      commitKeys: [','],
      onCommit: comma,
    });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(comma).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('textbox'), { key: ',' });
    expect(comma).toHaveBeenCalledWith('tag');

    rerender(
      <ChipField
        chips={['Alpha']}
        inputValue="tag"
        onInputValueChange={() => undefined}
        onCommit={onCommit}
        onChipRemove={() => undefined}
        commitKeys={['Escape' as 'Enter']}
      />,
    );
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith('tag');
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('ignores composing keydowns', () => {
    const { onCommit } = renderField({ inputValue: 'tag' });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', isComposing: true });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Process' });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('removes the last chip on empty Backspace', () => {
    const { onChipRemove, rerender } = renderField({
      chips: ['Alpha', 'Beta', 'Gamma'],
      inputValue: '',
    });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Backspace' });
    expect(onChipRemove).toHaveBeenCalledWith(2, 'Gamma');

    rerender(
      <ChipField
        chips={['Alpha', 'Beta', 'Gamma']}
        inputValue="x"
        onInputValueChange={() => undefined}
        onCommit={() => undefined}
        onChipRemove={onChipRemove}
      />,
    );
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Backspace' });
    expect(onChipRemove).toHaveBeenCalledTimes(1);

    rerender(
      <ChipField
        chips={['Alpha']}
        inputValue=""
        onInputValueChange={() => undefined}
        onCommit={() => undefined}
        onChipRemove={onChipRemove}
        removeOnBackspace={false}
      />,
    );
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Backspace' });
    expect(onChipRemove).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the input after dismiss', () => {
    const { onChipRemove } = renderField({ chips: ['Alpha'] });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Alpha' }));
    expect(onChipRemove).toHaveBeenCalledWith(0, 'Alpha');
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
  });

  it('disables input and dismiss, and marks invalid', () => {
    const { onChipRemove, onCommit } = renderField({ disabled: true, invalid: true, inputValue: 'x' });
    const input = screen.getByRole('textbox');
    expect(input).toHaveProperty('disabled', true);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('button', { name: 'Remove Alpha' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Alpha' }));
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(onChipRemove).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('leaves the no-maxRows flow unmarked', () => {
    const { container } = renderField({ chips: ['Alpha', 'Beta'] });
    expect(container.querySelector('[data-max-rows]')).toBeNull();
    expect(container.querySelector('[data-measured]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove Alpha' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove Beta' })).toBeTruthy();
  });

  it('renders adornment parts in the same shell', () => {
    render(
      <ChipField
        chips={['Alpha']}
        inputValue=""
        onInputValueChange={() => undefined}
        onCommit={() => undefined}
        onChipRemove={() => undefined}
      >
        <ChipField.IconEnd>
          <span>chevron</span>
        </ChipField.IconEnd>
      </ChipField>,
    );
    expect(screen.getByText('chevron')).toBeTruthy();
  });
});

describe('ChipField overflow', () => {
  const observers: Array<{ cb: ResizeObserverCallback }> = [];

  beforeEach(() => {
    observers.length = 0;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        cb: ResizeObserverCallback;
        constructor(cb: ResizeObserverCallback) {
          this.cb = cb;
          observers.push(this);
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
      const minWidth = el instanceof HTMLInputElement ? '80px' : '0px';
      return {
        columnGap: '8px',
        gap: '8px',
        minWidth,
        getPropertyValue(name: string) {
          if (name === 'min-width') return minWidth;
          if (name === 'column-gap' || name === 'gap') return '8px';
          return '';
        },
      } as CSSStyleDeclaration;
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('data-overflow') != null) {
        return { width: 50, height: 24, top: 0, left: 0, bottom: 24, right: 50, x: 0, y: 0, toJSON() {} };
      }
      if (this.querySelector?.(':scope > input')) {
        return { width: 400, height: 32, top: 0, left: 0, bottom: 32, right: 400, x: 0, y: 0, toJSON() {} };
      }
      if (this.tagName === 'SPAN' && this.querySelector?.('button, [aria-hidden]')) {
        return { width: 100, height: 24, top: 0, left: 0, bottom: 24, right: 100, x: 0, y: 0, toJSON() {} };
      }
      return { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0, x: 0, y: 0, toJSON() {} };
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function liveNodes(container: HTMLElement) {
    const flow = container.querySelector('input')?.parentElement;
    return [...(flow?.children ?? [])].filter((el) => !el.hasAttribute('inert'));
  }

  it('folds earliest chips into +N and keeps hidden dismiss out of the a11y tree', () => {
    const { container, onChipRemove } = renderField({
      chips: ['Alpha', 'Beta', 'Gamma', 'Delta'],
      maxRows: 1,
    });
    const live = liveNodes(container);
    const html = live.map((el) => el.outerHTML).join('');
    expect(container.querySelector('[data-max-rows]')).not.toBeNull();
    expect(container.querySelector('[data-measured]')).not.toBeNull();
    expect(html).toContain('2 more');
    expect(html).not.toContain('Remove Alpha');
    expect(html).not.toContain('Remove Beta');
    expect(html).toContain('Remove Gamma');
    expect(html).toContain('Remove Delta');
    expect(container.querySelector('[inert][aria-hidden] [aria-label="Remove Alpha"]')).not.toBeNull();

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Backspace' });
    expect(onChipRemove).toHaveBeenCalledWith(3, 'Delta');
  });

  it('remeasures when ResizeObserver fires and does not loop', () => {
    const { container } = renderField({
      chips: ['Alpha', 'Beta', 'Gamma', 'Delta'],
      maxRows: 1,
    });
    expect(observers.length).toBeGreaterThan(0);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('data-overflow') != null) {
        return { width: 50, height: 24, top: 0, left: 0, bottom: 24, right: 50, x: 0, y: 0, toJSON() {} };
      }
      if (this.querySelector?.(':scope > input')) {
        return { width: 800, height: 32, top: 0, left: 0, bottom: 32, right: 800, x: 0, y: 0, toJSON() {} };
      }
      if (this.tagName === 'SPAN' && this.querySelector?.('button, [aria-hidden]')) {
        return { width: 100, height: 24, top: 0, left: 0, bottom: 24, right: 100, x: 0, y: 0, toJSON() {} };
      }
      return { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0, x: 0, y: 0, toJSON() {} };
    });
    act(() => {
      const ro = observers.at(-1);
      ro?.cb([] as unknown as ResizeObserverEntry[], ro as unknown as ResizeObserver);
    });
    const live = liveNodes(container).map((el) => el.outerHTML).join('');
    expect(live).not.toContain('data-overflow');
    expect(live).toContain('Remove Alpha');
  });
});

describe('ChipField maxRows SSR', () => {
  const shared = {
    chips: ['Alpha', 'Beta', 'Gamma', 'Delta'],
    inputValue: '',
    onInputValueChange: () => undefined,
    onCommit: () => undefined,
    onChipRemove: () => undefined,
  };

  it('SSR maxRows has data-max-rows and no data-measured', () => {
    const html = renderToString(<ChipField {...shared} maxRows={1} />);
    expect(html).toContain('data-max-rows');
    expect(html).not.toContain('data-measured');
    expect(html).toContain('--todae-chipfield-rows');
  });

  it('SSR without maxRows stays unmarked', () => {
    const html = renderToString(<ChipField {...shared} />);
    expect(html).not.toContain('data-max-rows');
    expect(html).not.toContain('data-measured');
    expect(html).not.toContain('--todae-chipfield-rows');
  });
});
