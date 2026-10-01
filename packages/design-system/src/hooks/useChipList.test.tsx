import { act, cleanup, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Field } from '../components/Field';
import * as api from '../index';
import { useChipList } from './useChipList';

const EIGHT = ['aa', 'bb', 'cc', 'dd', 'ee', 'ff', 'gg', 'hh'];
const observers: Array<{ cb: ResizeObserverCallback }> = [];
let box = 400;
const over: number[] = [];

function rect(width: number, height = 24) {
  return { width, height, top: 0, left: 0, bottom: height, right: width, x: 0, y: 0, toJSON() {} };
}

function Host({
  chips,
  maxRows,
  reserve,
}: {
  chips: readonly string[];
  maxRows?: number;
  reserve?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const list = useChipList({ chips, maxRows, reserveWidth: reserve ? inputRef : undefined });
  if (list.hidden > chips.length) over.push(list.hidden);
  return (
    <div ref={list.listRef} role="list">
      <span data-testid="count">{list.visible.length}</span>
      <span data-testid="hidden">{list.hidden}</span>
      {list.visible.map((chip) => (
        <span
          key={chip.key}
          data-chip=""
          data-ellipsis={chip.ellipsis ? '' : undefined}
          style={chip.maxWidth != null ? { maxWidth: chip.maxWidth } : undefined}
        >
          {chip.value}
        </span>
      ))}
      {reserve ? <input ref={inputRef} /> : null}
      <div ref={list.measureRef}>
        {chips.map((value) => (
          <span key={value}>
            {value}
            <button type="button">x</button>
          </span>
        ))}
        <span>
          …
          <button type="button">x</button>
        </span>
        <span data-overflow="">+</span>
      </div>
    </div>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

beforeEach(() => {
  observers.length = 0;
  over.length = 0;
  box = 400;
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
    if (this.getAttribute('data-overflow') != null) return rect(50);
    if (this.querySelector?.(':scope > input') || this.getAttribute('role') === 'list') return rect(box, 32);
    if (this.tagName === 'SPAN' && this.querySelector?.('button, [aria-hidden]')) return rect(100);
    return rect(0, 0);
  });
});

describe('useChipList', () => {
  it('exports the hook and not the private planner or a ChipList component', () => {
    expect(typeof api.useChipList).toBe('function');
    expect(api).not.toHaveProperty('useChipMeasure');
    expect(api).not.toHaveProperty('planChipOverflow');
    expect(api).not.toHaveProperty('ChipList');
    expect(api).not.toHaveProperty('ChipListProps');
  });

  it('shows every chip when maxRows is unset', () => {
    render(<Host chips={['a', 'b', 'c']} />);
    expect(screen.getByTestId('hidden').textContent).toBe('0');
    expect(screen.getByTestId('count').textContent).toBe('3');
    expect(document.querySelector('[data-ellipsis]')).toBeNull();
  });

  it('matches main inline ChipInput counts for 8 chips', () => {
    for (const [maxRows, visible, more] of [
      [1, 2, '6 more'],
      [2, 5, '3 more'],
    ] as const) {
      const { container, unmount } = render(
        <Field.Root>
          <Field.ChipInput
            chips={[...EIGHT]}
            maxRows={maxRows}
            inputValue=""
            onInputValueChange={() => undefined}
            onCommit={() => undefined}
            onChipRemove={() => undefined}
          />
        </Field.Root>,
      );
      const live = [...container.querySelectorAll('button, [data-overflow]')].filter((el) => !el.closest('[inert]'));
      const names = live.filter((el) => el.tagName === 'BUTTON').map((el) => el.getAttribute('aria-label'));
      expect(names).toEqual(EIGHT.slice(0, visible).map((label) => `Remove ${label}`));
      expect(live.some((el) => el.getAttribute('data-overflow') != null && el.textContent?.includes(more))).toBe(true);
      unmount();
    }
  });

  it('reserves input min-width by folding one more chip', () => {
    const open = render(<Host chips={EIGHT} maxRows={1} />);
    expect(open.getByTestId('count').textContent).toBe('3');
    open.unmount();
    render(<Host chips={EIGHT} maxRows={1} reserve />);
    expect(screen.getByTestId('count').textContent).toBe('2');
  });

  it('folds a chip that does not fit at full width instead of shrinking it', () => {
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
      const minWidth = el instanceof HTMLInputElement ? '40px' : '0px';
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
      if (this.getAttribute('data-overflow') != null) return rect(40);
      if (this.querySelector?.(':scope > input') || this.getAttribute('role') === 'list') return rect(300, 32);
      const text = this.textContent ?? '';
      const width = text.startsWith('…') ? 60 : text.startsWith('Beta') ? 150 : 80;
      if (this.tagName === 'SPAN' && this.querySelector?.('button, [aria-hidden]')) return rect(width);
      return rect(0, 0);
    });
    render(<Host chips={['Alpha', 'Beta', 'Gamma']} maxRows={1} reserve />);
    const chips = [...document.querySelectorAll('[data-chip]')] as HTMLElement[];
    expect(chips.map((el) => el.textContent)).toEqual(['Alpha']);
    expect(document.querySelector('[data-ellipsis]')).toBeNull();
    expect(screen.getByTestId('hidden').textContent).toBe('2');
  });

  it('measures minChip as the ellipsis probe plus one character', () => {
    const proto = Range.prototype as unknown as { getBoundingClientRect?: () => { width: number } };
    const previous = proto.getBoundingClientRect;
    proto.getBoundingClientRect = () => rect(12);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('data-overflow') != null) return rect(30);
      if (this.querySelector?.(':scope > input') || this.getAttribute('role') === 'list') return rect(box, 32);
      const text = this.textContent ?? '';
      if (text.startsWith('…')) return rect(40);
      if (this.tagName === 'SPAN' && this.querySelector?.('button')) return rect(80);
      return rect(0, 0);
    });
    try {
      box = 90;
      const fit = render(<Host chips={['Alpha', 'Beta']} maxRows={1} />);
      const chip = fit.container.querySelector('[data-chip]') as HTMLElement;
      expect(chip.textContent).toBe('Alpha');
      expect(chip.getAttribute('data-ellipsis')).toBe('');
      expect(chip.style.maxWidth).toBe('52px');
      expect(fit.getByTestId('hidden').textContent).toBe('1');
      fit.unmount();
      box = 89.9;
      render(<Host chips={['Alpha', 'Beta']} maxRows={1} />);
      expect(screen.getByTestId('count').textContent).toBe('0');
      expect(screen.getByTestId('hidden').textContent).toBe('2');
      expect(document.querySelector('[data-chip]')).toBeNull();
    } finally {
      proto.getBoundingClientRect = previous;
    }
  });

  it('truncates a chip wider than the row and keeps its full label', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('data-overflow') != null) return rect(40);
      if (this.querySelector?.(':scope > input') || this.getAttribute('role') === 'list') return rect(200, 32);
      const text = this.textContent ?? '';
      const width = text.startsWith('…') ? 60 : text.startsWith('a-very-long-tag') ? 400 : 80;
      if (this.tagName === 'SPAN' && this.querySelector?.('button, [aria-hidden]')) return rect(width);
      return rect(0, 0);
    });
    const full = 'a-very-long-tag';
    render(<Host chips={[full]} maxRows={1} />);
    const chip = document.querySelector('[data-chip]') as HTMLElement;
    expect(chip.textContent).toBe(full);
    expect(chip.getAttribute('data-ellipsis')).toBe('');
    expect(chip.style.maxWidth).toBe('200px');
  });

  it('re-plans from ResizeObserver without adding observers', () => {
    render(<Host chips={EIGHT} maxRows={1} />);
    expect(screen.getByTestId('count').textContent).toBe('3');
    const before = observers.length;
    box = 2000;
    act(() => {
      const ro = observers.at(-1);
      ro?.cb([] as unknown as ResizeObserverEntry[], ro as unknown as ResizeObserver);
    });
    expect(observers.length).toBe(before);
    expect(screen.getByTestId('count').textContent).toBe('8');
  });

  it('caps hidden at chips.length when the plan is stale', () => {
    box = 0;
    const { rerender } = render(<Host chips={['a', 'b']} maxRows={1} />);
    expect(screen.getByTestId('hidden').textContent).toBe('2');
    rerender(<Host chips={['a']} maxRows={1} />);
    expect(screen.getByTestId('hidden').textContent).toBe('1');
    expect(over).toEqual([]);
  });
});
