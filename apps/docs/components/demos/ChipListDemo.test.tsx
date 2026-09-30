// @vitest-environment jsdom
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Field } from '@tounsoo/todae';
import { ChipListDemo } from './ChipListDemo';

const require = createRequire(import.meta.url);
const EIGHT = ['aa', 'bb', 'cc', 'dd', 'ee', 'ff', 'gg', 'hh'];
const ROW = 'calc(var(--todae-chip-font-size) * 1.25 + 2 * var(--todae-chip-padding-y) + 2px)';

function rect(width: number, height = 24) {
  return { width, height, top: 0, left: 0, bottom: height, right: width, x: 0, y: 0, toJSON() {} };
}

function live(container: HTMLElement, selector: string) {
  return [...container.querySelectorAll(selector)].filter((el) => !el.closest('[inert]'));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
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
    if (this.querySelector?.(':scope > input') || this.getAttribute('role') === 'list') return rect(400, 32);
    if (this.tagName === 'SPAN' && this.querySelector?.('button, [aria-hidden]')) return rect(100);
    return rect(0, 0);
  });
});

describe('chip list recipe', () => {
  it('matches Field.ChipInput row counts at maxRows 1 and 2', () => {
    for (const [maxRows, labels, more] of [
      [1, ['aa', 'bb', 'cc'], '5 more'],
      [2, ['aa', 'bb', 'cc', 'dd', 'ee', 'ff'], '2 more'],
    ] as const) {
      const recipe = render(<ChipListDemo maxRows={maxRows} initialChips={EIGHT} />);
      const recipeNames = live(recipe.container, 'button').map((el) => el.getAttribute('aria-label'));
      const recipeMore = live(recipe.container, '[data-overflow]')[0]?.textContent ?? '';
      recipe.unmount();
      const row = render(
        <Field.Root>
          <Field.ChipInput
            chipLayout="row"
            chips={[...EIGHT]}
            maxRows={maxRows}
            inputValue=""
            onInputValueChange={() => undefined}
            onCommit={() => undefined}
            onChipRemove={() => undefined}
          />
        </Field.Root>,
      );
      expect(recipeNames).toEqual(labels.map((label) => `Remove ${label}`));
      expect(live(row.container, 'button').map((el) => el.getAttribute('aria-label'))).toEqual(recipeNames);
      expect(recipeMore).toContain(more);
      expect(live(row.container, '[data-overflow]')[0]?.textContent).toContain(more);
      row.unmount();
    }
  });

  it('makes every list child a listitem, including +N', () => {
    render(<ChipListDemo maxRows={1} initialChips={EIGHT} />);
    const list = screen.getByRole('list', { name: 'Tags' });
    expect(list.childElementCount).toBeGreaterThan(1);
    for (const child of list.children) expect(child.getAttribute('role')).toBe('listitem');
    expect(list.querySelector('[data-overflow]')?.getAttribute('role')).toBe('listitem');
  });

  it('truncates with max-width and ellipsis CSS, and names the full label', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('data-overflow') != null) return rect(40);
      if (this.getAttribute('role') === 'list' || this.querySelector?.(':scope > input')) return rect(250, 32);
      const text = this.textContent ?? '';
      const width = text.startsWith('…') ? 60 : text.startsWith('a-very-long-tag-that-truncates') ? 150 : 80;
      if (this.tagName === 'SPAN' && this.querySelector?.('button, [aria-hidden]')) return rect(width);
      return rect(0, 0);
    });
    const full = 'a-very-long-tag-that-truncates';
    render(<ChipListDemo maxRows={1} initialChips={['design', full, 'react']} />);
    const list = screen.getByRole('list', { name: 'Tags' });
    const truncated = [...list.children].find((el) => (el as HTMLElement).style.maxWidth !== '') as HTMLElement;
    expect(truncated.style.maxWidth).toBe('114px');
    expect(truncated.textContent).toContain(full);
    expect(truncated.textContent).not.toContain(`${full.slice(0, 8)}…`);
    const label = truncated.querySelector('span');
    expect(label?.textContent).toBe(full);
    const css = readFileSync(require.resolve('@tounsoo/todae/todae.css'), 'utf8');
    const cls = [...(label?.classList ?? [])].find((name) => name.includes('label'));
    expect(cls).toBeTruthy();
    const rule = css.slice(css.indexOf(`.${cls}`), css.indexOf('}', css.indexOf(`.${cls}`)));
    expect(rule).toMatch(/text-overflow:\s*ellipsis/);
    expect(screen.getByRole('button', { name: `Remove ${full}` })).toBe(truncated.querySelector('button'));
    expect(screen.getByText('1 more')).toBeTruthy();
  });

  it('names Remove {label} and N more, and hides the measure row', () => {
    render(<ChipListDemo maxRows={1} initialChips={EIGHT} />);
    expect(screen.getByRole('button', { name: 'Remove aa' }).textContent).toBe('×');
    expect(screen.getByText('5 more')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove hh' })).toBeNull();
    const measure = document.querySelector('[inert][aria-hidden]');
    expect(measure?.getAttribute('aria-hidden')).toBe('true');
    expect(measure?.hasAttribute('inert')).toBe(true);
    expect(measure?.querySelector('[aria-label="Remove hh"]')).not.toBeNull();
    expect(screen.getByRole('list').contains(measure)).toBe(false);
  });

  it('focuses a chip revealed by the remeasure, not the list', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('data-overflow') != null) return rect(50);
      if (this.getAttribute('role') === 'list' || this.querySelector?.(':scope > input')) return rect(160, 32);
      if (this.tagName === 'SPAN' && this.querySelector?.('button, [aria-hidden]')) return rect(100);
      return rect(0, 0);
    });
    render(<ChipListDemo maxRows={1} initialChips={['aa', 'bb', 'cc']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove aa' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove bb' }));
    expect(document.activeElement).not.toBe(screen.getByRole('list', { name: 'Tags' }));
  });

  it('focuses the next chip, else the previous, else the list', () => {
    render(<ChipListDemo maxRows={2} initialChips={['aa', 'bb', 'cc']} />);
    const list = screen.getByRole('list', { name: 'Tags' });
    expect(list.tabIndex).toBe(-1);
    fireEvent.click(screen.getByRole('button', { name: 'Remove bb' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove cc' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove cc' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove aa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove aa' }));
    expect(document.activeElement).toBe(list);
    expect(document.activeElement).not.toBe(document.body);
    expect(list.tabIndex).toBe(-1);
    expect(list.style.minHeight).toBe(ROW);
    expect(list.style.outline).toContain('--todae-chip-ring-focus');
    expect(list.style.outlineOffset).toBe('-2px');
    expect(list.childElementCount).toBe(0);
    expect(list.textContent).toBe('');
    expect(document.querySelector('[inert][aria-hidden]')).not.toBeNull();
  });

  it('keeps an empty list mounted and focusable', () => {
    render(<ChipListDemo maxRows={1} initialChips={[]} />);
    const list = screen.getByRole('list', { name: 'Tags' });
    expect(list.isConnected).toBe(true);
    expect(list.tabIndex).toBe(-1);
    expect(list.style.minHeight).toBe(ROW);
    expect(list.textContent).toBe('');
    act(() => {
      list.focus();
    });
    expect(document.activeElement).toBe(list);
    expect(list.style.outline).toContain('--todae-chip-ring-focus');
    expect(list.style.outlineOffset).toBe('-2px');
  });

  it('server-renders the list hidden until measured', () => {
    const html = renderToString(<ChipListDemo maxRows={1} initialChips={EIGHT} />);
    expect(html).toContain('visibility:hidden');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('inert');
  });
});
