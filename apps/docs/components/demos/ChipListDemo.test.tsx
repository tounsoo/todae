// @vitest-environment jsdom
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { StrictMode, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChipList, Field } from '@tounsoo/todae';
import { ChipListDemo } from './ChipListDemo';

const require = createRequire(import.meta.url);
const EIGHT = ['aa', 'bb', 'cc', 'dd', 'ee', 'ff', 'gg', 'hh'];
const ROW =
  'calc(var(--todae-chip-font-size) * var(--todae-chip-leading) + 2 * var(--todae-chip-padding-y) + 2 * var(--todae-chip-border-width))';
const GAP = 'var(--todae-space-inline-gap)';
const PAD = 'calc(var(--todae-chip-ring-width) + var(--todae-chip-ring-offset))';

// The built stylesheet's rules that name one of el's classes.
function rulesFor(el: HTMLElement) {
  const css = readFileSync(require.resolve('@tounsoo/todae/todae.css'), 'utf8');
  return css
    .split('}')
    .filter((part) => [...el.classList].some((cls) => new RegExp(`\\.${cls}(?![\\w-])`).test(part)))
    .join('}');
}

function rect(width: number, height = 24) {
  return { width, height, top: 0, left: 0, bottom: height, right: width, x: 0, y: 0, toJSON() {} };
}

function live(container: HTMLElement, selector: string) {
  return [...container.querySelectorAll(selector)].filter((el) => !el.closest('[inert]'));
}

function removes(root: ParentNode) {
  return [...root.querySelectorAll('button')].filter((button) => button.getAttribute('aria-label')?.startsWith('Remove'));
}

function polyfillPopover() {
  const proto = HTMLElement.prototype as HTMLElement & {
    showPopover?: () => void;
    hidePopover?: () => void;
  };
  if (typeof proto.showPopover === 'function') return;
  proto.showPopover = function showPopover(this: HTMLElement) {
    this.setAttribute('data-popover-open', '');
  };
  proto.hidePopover = function hidePopover(this: HTMLElement) {
    this.removeAttribute('data-popover-open');
  };
}

function watchBody() {
  const seen: Element[] = [];
  let nullOut = false;
  function onIn() {
    if (document.activeElement) seen.push(document.activeElement);
  }
  function onOut(event: FocusEvent) {
    if (event.relatedTarget == null) nullOut = true;
  }
  document.addEventListener('focusin', onIn);
  document.addEventListener('focusout', onOut);
  return {
    assert() {
      expect(seen.includes(document.body)).toBe(false);
      expect(nullOut).toBe(false);
      expect(document.activeElement).not.toBe(document.body);
    },
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.querySelectorAll(':scope > button, :scope > [role="dialog"]').forEach((node) => node.remove());
});

beforeEach(() => {
  polyfillPopover();
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
        display: 'inline',
        visibility: 'visible',
        content: 'none',
        getPropertyValue(name: string) {
          if (name === 'min-width') return minWidth;
          if (name === 'column-gap' || name === 'gap') return '8px';
          if (name === 'display') return 'inline';
          if (name === 'visibility') return 'visible';
          if (name === 'content') return 'none';
          return '';
        },
    } as CSSStyleDeclaration;
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.getAttribute('data-overflow') != null) return rect(50);
    if (this.querySelector?.(':scope > input') || this.getAttribute('role') === 'list') return rect(400, 32);
    if (this.tagName === 'SPAN' && this.querySelector?.('button, [aria-hidden], span')) return rect(100);
    return rect(0, 0);
  });
});

describe('chip list recipe', () => {
  it('matches Field.ChipInput row counts at maxRows 1 and 2', () => {
    for (const [maxRows, labels, more] of [
      [1, ['aa', 'bb', 'cc'], '+5 more'],
      [2, ['aa', 'bb', 'cc', 'dd', 'ee', 'ff'], '+2 more'],
    ] as const) {
      const recipe = render(<ChipListDemo maxRows={maxRows} initialChips={EIGHT} />);
      const list = recipe.getByRole('list', { name: 'Tags' });
      const recipeNames = removes(list).map((el) => el.getAttribute('aria-label'));
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
      expect(live(row.container, '[data-overflow]')[0]?.textContent).toContain(more.replace('+', ''));
      row.unmount();
    }
  });

  it('pins the 18rem demo inside the clip wrapper', () => {
    const widths: Record<string, number> = {
      design: 78.11,
      tokens: 78.28,
      accessibility: 111.88,
      'a-very-long-tag-that-stays-put': 230.11,
      react: 67.05,
      density: 81.69,
      'dark mode': 105.45,
      docs: 64.53,
    };
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('data-overflow') != null) return rect(34.03);
      if (this.getAttribute('role') === 'list') return rect(288, 32);
      const text = this.textContent ?? '';
      if (text.startsWith('…')) return rect(45.09);
      if (this.tagName === 'SPAN' && this.querySelector?.('button, [aria-hidden]')) {
        const label = Object.keys(widths).find((key) => text.includes(key));
        return rect(widths[label ?? ''] ?? 0);
      }
      return rect(0, 0);
    });
    for (const [maxRows, visibleCount, more] of [
      [1, 2, '+6 more'],
      [2, 4, '+4 more'],
    ] as const) {
      const view = render(<ChipListDemo maxRows={maxRows} />);
      const list = view.getByRole('list', { name: 'Tags' });
      const wrapper = list.parentElement as HTMLElement;
      expect(wrapper.hasAttribute('data-rows')).toBe(true);
      expect(wrapper.style.getPropertyValue('--_rows')).toBe(String(maxRows));
      expect(list.style.overflow).toBe('');
      expect(list.style.maxHeight).toBe('');
      expect(removes(list)).toHaveLength(visibleCount);
      expect(live(view.container, '[data-overflow]')[0]?.textContent).toContain(more);
      const truncated = [...list.children].filter((el) => (el as HTMLElement).style.maxWidth !== '');
      expect(truncated).toEqual([]);
      view.unmount();
    }
  });

  it('clips to maxRows in the wrapper, leaving room for focus rings', () => {
    render(<ChipListDemo maxRows={2} initialChips={EIGHT} />);
    const list = screen.getByRole('list', { name: 'Tags' });
    // The built stylesheet is minified: no space after a colon.
    const clip = rulesFor(list.parentElement as HTMLElement);
    expect(clip).toContain('overflow:hidden');
    expect(clip).toContain('padding:var(--_pad)');
    expect(clip).toContain('margin:calc(var(--_pad) * -1)');
    expect(clip).toContain('min-block-size:calc(var(--_row) + 2 * var(--_pad))');
    expect(clip).toContain(
      'max-block-size:calc(var(--_row) * var(--_rows) + var(--_gap) * (var(--_rows) - 1) + 2 * var(--_pad))',
    );
    // Custom properties keep their own whitespace, so compare without any.
    const bare = (text: string) => text.replace(/\s+/g, '');
    const root = bare(rulesFor(list.parentElement!.parentElement as HTMLElement));
    expect(root).toContain(bare(`--_row:${ROW}`));
    expect(root).toContain(bare(`--_gap:${GAP}`));
    expect(root).toContain(bare(`--_pad:${PAD}`));
    expect(rulesFor(list)).toContain('min-block-size:var(--_row)');
  });

  it('makes every list child a listitem, including +N', () => {
    render(<ChipListDemo maxRows={1} initialChips={EIGHT} />);
    const list = screen.getByRole('list', { name: 'Tags' });
    expect(list.childElementCount).toBeGreaterThan(1);
    for (const child of list.children) expect(child.getAttribute('role')).toBe('listitem');
    const overflow = list.querySelector('[data-overflow]');
    expect(overflow?.getAttribute('role')).not.toBe('listitem');
    expect(overflow?.closest('[role="listitem"]')?.querySelector('button')?.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('truncates only a chip wider than the row and keeps its full name', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('data-overflow') != null) return rect(40);
      if (this.getAttribute('role') === 'list' || this.querySelector?.(':scope > input')) return rect(200, 32);
      const text = this.textContent ?? '';
      const width = text.startsWith('…') ? 60 : text.startsWith('a-very-long-tag-that-stays-put') ? 400 : 80;
      if (this.tagName === 'SPAN' && this.querySelector?.('button, [aria-hidden]')) return rect(width);
      return rect(0, 0);
    });
    const full = 'a-very-long-tag-that-stays-put';
    render(<ChipListDemo maxRows={1} initialChips={[full, 'react']} />);
    const list = screen.getByRole('list', { name: 'Tags' });
    const truncated = [...list.children].find((el) => (el as HTMLElement).style.maxWidth !== '') as HTMLElement;
    expect(truncated.style.maxWidth).toBe('152px');
    expect(truncated.textContent).toContain(full);
    expect(truncated.textContent).not.toContain(`${full.slice(0, 8)}…`);
    expect(truncated.getAttribute('aria-label')).toBeNull();
    expect(truncated.getAttribute('title')).toBeNull();
    const label = truncated.querySelector('span');
    expect(label?.textContent).toBe(full);
    const css = readFileSync(require.resolve('@tounsoo/todae/todae.css'), 'utf8');
    const cls = [...(label?.classList ?? [])].find((name) => name.includes('label'));
    expect(cls).toBeTruthy();
    const rule = css.slice(css.indexOf(`.${cls}`), css.indexOf('}', css.indexOf(`.${cls}`)));
    expect(rule).toMatch(/text-overflow:\s*ellipsis/);
    expect(screen.getByRole('button', { name: `Remove ${full}` })).toBe(truncated.querySelector('button'));
    expect(screen.getByRole('button', { name: '+1 more' })).toBeTruthy();
    expect(removes(list).map((button) => button.getAttribute('aria-label'))).toEqual([`Remove ${full}`]);

    cleanup();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('data-overflow') != null) return rect(40);
      if (this.getAttribute('role') === 'list') return rect(240, 32);
      const text = this.textContent ?? '';
      const width = text.startsWith('…') ? 60 : text.includes(full) ? 230 : 80;
      if (this.tagName === 'SPAN' && this.querySelector?.('button, [aria-hidden], span')) return rect(width);
      return rect(0, 0);
    });
    render(<ChipListDemo maxRows={1} initialChips={[full, 'react', 'density']} />);
    const narrow = screen.getByRole('list', { name: 'Tags' });
    const alone = [...narrow.children].find((el) => (el as HTMLElement).style.maxWidth !== '') as HTMLElement;
    expect(alone.style.maxWidth).toBe('192px');
    expect(alone.textContent).toContain(full);
    expect(alone.querySelector('button')?.getAttribute('aria-label')).toBe(`Remove ${full}`);
    expect(screen.getByRole('button', { name: '+2 more' })).toBeTruthy();

    cleanup();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('data-overflow') != null) return rect(40);
      if (this.getAttribute('role') === 'list' || this.querySelector?.(':scope > input')) return rect(200, 32);
      const text = this.textContent ?? '';
      const width = text.startsWith('…') ? 60 : text.startsWith(full) ? 400 : 80;
      if (this.tagName === 'SPAN' && this.querySelector?.('button, [aria-hidden], span')) return rect(width);
      return rect(0, 0);
    });
    render(<ChipListDemo maxRows={1} initialChips={[full, 'react']} readOnly />);
    const readOnlyList = screen.getByRole('list', { name: 'Tags' });
    const readOnlyChip = [...readOnlyList.children].find((el) => el.textContent === full) as HTMLElement;
    expect(readOnlyChip.style.maxWidth).toBe('152px');
    expect(readOnlyChip.getAttribute('aria-label')).toBeNull();
    expect(readOnlyChip.getAttribute('title')).toBeNull();
    expect(readOnlyChip.querySelector('span')?.textContent).toBe(full);
  });

  it('names +N more, and hides the measure row', () => {
    render(<ChipListDemo maxRows={1} initialChips={EIGHT} />);
    const list = screen.getByRole('list', { name: 'Tags' });
    // No glyph ships: the stylesheet draws the cross.
    expect(screen.getByRole('button', { name: 'Remove aa' }).textContent).toBe('');
    expect(screen.getByRole('button', { name: '+5 more' })).toBeTruthy();
    expect(list.querySelector('[aria-label="Remove hh"]')).toBeNull();
    const measure = document.querySelector('[inert][aria-hidden]');
    expect(measure?.getAttribute('aria-hidden')).toBe('true');
    expect(measure?.hasAttribute('inert')).toBe(true);
    expect(measure?.querySelector('[aria-label="Remove hh"]')).not.toBeNull();
    expect(list.contains(measure)).toBe(false);
  });

  it('names +N as a dialog trigger and drops it when nothing is hidden', async () => {
    const body = watchBody();
    render(<ChipListDemo maxRows={1} initialChips={EIGHT} />);
    const more = screen.getByRole('button', { name: '+5 more' });
    expect(more.closest('[role="listitem"]')).toBeTruthy();
    expect(more.getAttribute('aria-haspopup')).toBe('dialog');
    expect(more.getAttribute('aria-expanded')).toBe('false');
    const id = more.getAttribute('aria-controls');
    expect(id).toBeTruthy();
    expect(document.getElementById(id ?? '')?.getAttribute('role')).toBe('dialog');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove aa' }));
    });
    expect(screen.getByRole('button', { name: '+4 more' }).getAttribute('aria-expanded')).toBe('false');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+4 more' }));
    });
    expect(screen.getByRole('button', { name: '+4 more' }).getAttribute('aria-expanded')).toBe('true');
    body.assert();
    cleanup();
    render(<ChipListDemo maxRows={2} initialChips={['aa', 'bb', 'cc']} />);
    expect(screen.queryByRole('button', { name: /\+.*more/ })).toBeNull();
  });

  it('opens the hidden chips and returns focus on Escape and outside click', async () => {
    const body = watchBody();
    render(<ChipListDemo maxRows={1} initialChips={EIGHT} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+5 more' }));
    });
    const dialog = screen.getByRole('dialog', { name: '5 more tags' });
    expect([...dialog.querySelectorAll('button')].map((button) => button.getAttribute('aria-label'))).toEqual(
      EIGHT.slice(3).map((label) => `Remove ${label}`),
    );
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove dd' }));
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    const more = screen.getByRole('button', { name: '+5 more' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(more);
    await act(async () => {
      fireEvent.click(more);
    });
    await act(async () => {
      fireEvent.pointerDown(document.body);
    });
    expect(screen.getByRole('button', { name: '+5 more' }).getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '+5 more' }));
    body.assert();
  });

  it('tabs out of a portaled popover to the control after +N', async () => {
    const body = watchBody();
    render(
      <>
        <ChipListDemo maxRows={1} initialChips={EIGHT} />
        <button>After</button>
      </>,
    );
    const end = document.createElement('button');
    end.textContent = 'End';
    document.body.appendChild(end);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+5 more' }));
    });
    const dialog = screen.getByRole('dialog');
    document.body.appendChild(dialog);
    const last = screen.getByRole('button', { name: 'Remove hh' });
    last.focus();
    let prevented = false;
    await act(async () => {
      prevented = !fireEvent.keyDown(last, { key: 'Tab' });
    });
    expect(prevented).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'After' }));
    expect(document.activeElement).not.toBe(end);
    expect(screen.getByRole('button', { name: '+5 more' }).getAttribute('aria-expanded')).toBe('false');
    body.assert();
  });

  it('skips a control in a closed popover when tabbing out', async () => {
    // jsdom has no checkVisibility: report anything under data-closed as not rendered.
    const proto = HTMLElement.prototype as HTMLElement & { checkVisibility?: () => boolean };
    const had = proto.checkVisibility;
    proto.checkVisibility = function (this: HTMLElement) {
      return !this.closest('[data-closed]');
    };
    try {
      render(
        <>
          <ChipListDemo maxRows={1} initialChips={EIGHT} />
          <div data-closed>
            <button>Hidden</button>
          </div>
          <button>After</button>
        </>,
      );
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '+5 more' }));
      });
      const last = screen.getByRole('button', { name: 'Remove hh' });
      last.focus();
      await act(async () => {
        fireEvent.keyDown(last, { key: 'Tab' });
      });
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'After' }));
    } finally {
      if (had) proto.checkVisibility = had;
      else Reflect.deleteProperty(proto, 'checkVisibility');
    }
  });

  it('tabs out of a read-only panel to the control after +N', async () => {
    const body = watchBody();
    render(
      <>
        <ChipListDemo maxRows={1} initialChips={EIGHT} readOnly />
        <button>After</button>
      </>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+5 more' }));
    });
    const dialog = screen.getByRole('dialog', { name: '5 more tags' });
    expect(dialog.tabIndex).toBe(-1);
    expect(dialog.querySelector('button')).toBeNull();
    expect(document.activeElement).toBe(dialog);
    document.body.appendChild(dialog);
    if (document.activeElement !== dialog) dialog.focus();
    await act(async () => {
      fireEvent.keyDown(dialog, { key: 'Tab' });
    });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'After' }));
    expect(screen.getByRole('button', { name: '+5 more' }).getAttribute('aria-expanded')).toBe('false');
    body.assert();
  });

  it('shift-tabs from the first chip and the read-only panel back to +N', async () => {
    const body = watchBody();
    const view = render(<ChipListDemo maxRows={1} initialChips={EIGHT} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+5 more' }));
    });
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('button', { name: 'Remove dd' }), { key: 'Tab', shiftKey: true });
    });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '+5 more' }));
    expect(screen.getByRole('button', { name: '+5 more' }).getAttribute('aria-expanded')).toBe('false');
    view.unmount();
    render(<ChipListDemo maxRows={1} initialChips={EIGHT} readOnly />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+5 more' }));
    });
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true });
    });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '+5 more' }));
    expect(screen.getByRole('button', { name: '+5 more' }).getAttribute('aria-expanded')).toBe('false');
    body.assert();
  });

  it('treats a popover dismiss as inside the popover', async () => {
    render(<ChipListDemo maxRows={1} initialChips={EIGHT} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+5 more' }));
    });
    const chip = screen.getByRole('button', { name: 'Remove ee' });
    fireEvent.pointerDown(chip);
    expect(screen.getByRole('dialog', { name: '5 more tags' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '+5 more' }).getAttribute('aria-expanded')).toBe('true');
    await act(async () => {
      fireEvent.click(chip);
    });
    expect(screen.queryByRole('button', { name: 'Remove ee' })).toBeNull();
    expect(screen.getByRole('button', { name: '+4 more' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('moves focus to the next popover chip, else the previous', async () => {
    const body = watchBody();
    render(<ChipListDemo maxRows={1} initialChips={EIGHT} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+5 more' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove ff' }));
    });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove gg' }));
    expect(screen.getByRole('button', { name: '+4 more' })).toBeTruthy();
    expect(screen.getByRole('dialog', { name: '4 more tags' })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove hh' }));
    });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove gg' }));
    body.assert();
  });

  it('closes when the popover empties and focuses the last visible chip', async () => {
    const body = watchBody();
    render(<ChipListDemo maxRows={1} initialChips={['aa', 'bb', 'cc', 'dd']} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+1 more' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove dd' }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: /\+.*more/ })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove cc' }));
    body.assert();
  });

  it('focuses the chip that fills the slot after a remeasure', async () => {
    const body = watchBody();
    render(<ChipListDemo maxRows={1} initialChips={EIGHT} />);
    const list = screen.getByRole('list', { name: 'Tags' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove cc' }));
    });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove dd' }));
    expect(screen.getByRole('button', { name: '+4 more' })).toBeTruthy();
    expect(list.style.outline).toBe('');
    body.assert();
  });

  it('keeps wrapper height when the popover opens', async () => {
    render(<ChipListDemo maxRows={1} initialChips={EIGHT} />);
    const list = screen.getByRole('list', { name: 'Tags' });
    const wrapper = list.parentElement as HTMLElement;
    const min = wrapper.style.minHeight;
    const max = wrapper.style.maxHeight;
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+5 more' }));
    });
    expect(wrapper.style.minHeight).toBe(min);
    expect(wrapper.style.maxHeight).toBe(max);
    const dialog = screen.getByRole('dialog');
    expect(dialog.hasAttribute('popover')).toBe(true);
    expect(wrapper.contains(dialog)).toBe(false);
  });

  function stubListWidth(width: { current: number }) {
    const ros: ResizeObserverCallback[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: ResizeObserverCallback) {
          ros.push(cb);
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('data-overflow') != null) return rect(50);
      if (this.getAttribute('role') === 'list') return rect(width.current, 32);
      if (this.tagName === 'SPAN' && this.querySelector?.('button, [aria-hidden], span')) return rect(100);
      return rect(0, 0);
    });
    return ros;
  }

  async function resizeTo(ros: ResizeObserverCallback[]) {
    await act(async () => {
      for (const cb of ros) cb([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
    });
  }

  it('moves focus to the chip that entered the list before the popover unmounts when hidden drops to 0', async () => {
    const body = watchBody();
    const width = { current: 400 };
    const ros = stubListWidth(width);
    render(<ChipListDemo maxRows={1} initialChips={EIGHT} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+5 more' }));
    });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove dd' }));
    width.current = 4000;
    await resizeTo(ros);
    expect(screen.queryByRole('dialog')).toBeNull();
    const active = document.activeElement as HTMLElement;
    expect(active.getAttribute('aria-label')).toBe('Remove dd');
    expect(active.closest('[role="list"]')).toBe(screen.getByRole('list', { name: 'Tags' }));
    body.assert();
  });

  it('moves focus to the list before a read-only popover unmounts when hidden drops to 0', async () => {
    const body = watchBody();
    const width = { current: 400 };
    const ros = stubListWidth(width);
    render(<ChipListDemo maxRows={1} initialChips={EIGHT} readOnly />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+5 more' }));
    });
    expect(document.activeElement).toBe(screen.getByRole('dialog', { name: '5 more tags' }));
    width.current = 4000;
    await resizeTo(ros);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('list', { name: 'Tags' }));
    expect(screen.getByRole('list', { name: 'Tags' }).hasAttribute('data-ring')).toBe(true);
    body.assert();
  });

  it('moves focus to the same chip in the list when it leaves the popover', async () => {
    const body = watchBody();
    const width = { current: 400 };
    const ros = stubListWidth(width);
    render(<ChipListDemo maxRows={1} initialChips={EIGHT} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+5 more' }));
    });
    const inPopover = screen.getByRole('button', { name: 'Remove dd' });
    expect(document.activeElement).toBe(inPopover);
    expect(inPopover.closest('[role="dialog"]')).toBeTruthy();
    width.current = 500;
    await resizeTo(ros);
    const active = document.activeElement as HTMLElement;
    expect(active.getAttribute('aria-label')).toBe('Remove dd');
    expect(active.closest('[role="dialog"]')).toBeNull();
    expect(active.closest('[role="list"]')).toBeTruthy();
    expect(screen.getByRole('dialog', { name: '4 more tags' })).toBeTruthy();
    body.assert();
  });

  it('follows the moved chip, not an earlier chip with the same value', async () => {
    const body = watchBody();
    const width = { current: 400 };
    const ros = stubListWidth(width);
    render(<ChipListDemo maxRows={1} initialChips={['aa', 'bb', 'cc', 'aa', 'ee', 'ff', 'gg', 'hh']} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+5 more' }));
    });
    expect((document.activeElement as HTMLElement).closest('[role="dialog"]')).toBeTruthy();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Remove aa');
    width.current = 500;
    await resizeTo(ros);
    const item = (document.activeElement as HTMLElement).closest('[role="listitem"]');
    expect(item?.closest('[role="list"]')).toBeTruthy();
    expect(item?.getAttribute('data-index')).toBe('3');
    body.assert();
  });

  it('keeps focus on the remove button until the owner drops the chip, then moves on', async () => {
    const body = watchBody();
    let drop: () => void = () => undefined;
    let touch: () => void = () => undefined;
    function Later() {
      const [tags, setTags] = useState(['aa', 'bb', 'cc']);
      const [, setTick] = useState(0);
      drop = () => setTags((current) => current.filter((tag) => tag !== 'bb'));
      touch = () => setTick((n) => n + 1);
      // A new array each render, as a derived prop would be.
      return <ChipList.Root aria-label="Tags" chips={[...tags]} maxRows={2} onRemove={() => undefined} />;
    }
    render(<Later />);
    const button = screen.getByRole('button', { name: 'Remove bb' });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(document.activeElement).toBe(button);
    await act(async () => touch());
    expect(document.activeElement).toBe(button);
    await act(async () => drop());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove cc' }));
    body.assert();
  });

  // An owner that updates chips only when the test says so.
  function owner(initial: string[], maxRows = 2) {
    const api = { set: (_next: (tags: string[]) => string[]) => undefined as void };
    function Owner() {
      const [tags, setTags] = useState(initial);
      api.set = (next) => setTags(next);
      return (
        <ChipList.Root
          aria-label="Tags"
          chips={tags}
          maxRows={maxRows}
          onRemove={() => undefined}
          removeLabel={(value) => `Remove ${value}`}
          overflowLabel={(n) => `+${n} more`}
        />
      );
    }
    render(<Owner />);
    return api;
  }

  it('treats an insert before a chip awaiting removal as a move, not the removal', async () => {
    const body = watchBody();
    const tags = owner(['aa', 'bb', 'cc']);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove bb' }));
    });
    await act(async () => tags.set((current) => ['zz', ...current]));
    const active = document.activeElement as HTMLElement;
    expect(active.getAttribute('aria-label')).toBe('Remove bb');
    expect(active.closest('[role="listitem"]')?.getAttribute('data-index')).toBe('2');
    await act(async () => tags.set((current) => current.filter((tag) => tag !== 'bb')));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove cc' }));
    body.assert();
  });

  it('treats a chip the owner never dropped as moved when it later leaves the row', async () => {
    const body = watchBody();
    const width = { current: 500 };
    const ros = stubListWidth(width);
    owner(EIGHT, 1);
    await resizeTo(ros);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove dd' }));
    });
    width.current = 400;
    await resizeTo(ros);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '+5 more' }));
    body.assert();
  });

  it('keeps focus on the slot when the removed chip had a twin right after it', async () => {
    const body = watchBody();
    const tags = owner(['aa', 'bb', 'bb', 'cc']);
    const [pressed] = screen.getAllByRole('button', { name: 'Remove bb' }) as [HTMLElement];
    await act(async () => {
      fireEvent.click(pressed);
    });
    await act(async () => tags.set((current) => current.filter((_, index) => index !== 1)));
    const active = document.activeElement as HTMLElement;
    expect(active.getAttribute('aria-label')).toBe('Remove bb');
    expect(active.closest('[role="listitem"]')?.getAttribute('data-index')).toBe('1');
    body.assert();
  });

  it('closes the panel when the owner later drops its last chip', async () => {
    const body = watchBody();
    const tags = owner(['aa', 'bb', 'cc', 'dd'], 1);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+1 more' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove dd' }));
    });
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Remove dd');
    await act(async () => tags.set((current) => current.filter((tag) => tag !== 'dd')));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove cc' }));
    body.assert();
  });

  it('treats a focused chip the owner replaces as removed, focusing its slot', async () => {
    const body = watchBody();
    const tags = owner(['aa', 'bb']);
    act(() => screen.getByRole('button', { name: 'Remove bb' }).focus());
    await act(async () => tags.set(() => ['aa', 'BB']));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove BB' }));
    body.assert();
  });

  it('keeps focus in the open panel when the row above it changes', async () => {
    const body = watchBody();
    const tags = owner(EIGHT, 1);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+5 more' }));
    });
    const button = screen.getByRole('button', { name: 'Remove ff' });
    act(() => button.focus());
    await act(async () => tags.set((current) => ['zz', ...current]));
    expect(document.activeElement).toBe(button);
    expect(button.closest('[role="dialog"]')).toBeTruthy();
    body.assert();
  });

  // Chips with ids, keyed by getKey.
  function keyed(initial: { id: string; label: string }[], maxRows = 2) {
    const api = { set: (_next: (items: { id: string; label: string }[]) => { id: string; label: string }[]) => undefined as void };
    function Owner() {
      const [items, setItems] = useState(initial);
      api.set = (next) => setItems(next);
      return (
        <ChipList.Root
          aria-label="Tags"
          chips={items.map((item) => item.label)}
          getKey={(_, index) => items[index]!.id}
          maxRows={maxRows}
          onRemove={() => undefined}
          overflowLabel={(n) => `+${n} more`}
        />
      );
    }
    render(<Owner />);
    return api;
  }

  it('follows a chip by its key past a twin with the same value', async () => {
    const body = watchBody();
    const items = keyed([
      { id: '1', label: 'aa' },
      { id: '2', label: 'aa' },
    ]);
    const button = screen.getAllByRole('button', { name: 'Remove aa' })[1] as HTMLElement;
    act(() => button.focus());
    await act(async () => items.set((current) => [{ id: '0', label: 'zz' }, ...current]));
    expect(document.activeElement).toBe(button);
    expect(button.closest('[role="listitem"]')?.getAttribute('data-index')).toBe('2');
    body.assert();
  });

  it('follows a chip whose removal the owner refused when a twin is dropped later', async () => {
    const body = watchBody();
    const items = keyed([
      { id: '1', label: 'dd' },
      { id: '2', label: 'x' },
      { id: '3', label: 'dd' },
      { id: '4', label: 'y' },
    ]);
    const button = screen.getAllByRole('button', { name: 'Remove dd' })[1] as HTMLElement;
    await act(async () => {
      fireEvent.click(button);
    });
    await act(async () => items.set((current) => current.slice(1)));
    expect(document.activeElement).toBe(button);
    expect(button.closest('[role="listitem"]')?.getAttribute('data-index')).toBe('1');
    body.assert();
  });

  it('focuses the slot when a pressed chip has a later twin, without getKey', async () => {
    const body = watchBody();
    const tags = owner(['bb', 'aa', 'bb']);
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Remove bb' })[0]!);
    });
    await act(async () => tags.set((current) => current.filter((_, index) => index !== 0)));
    const active = document.activeElement as HTMLElement;
    expect(active).toBe(screen.getByRole('button', { name: 'Remove aa' }));
    expect(active.closest('[role="listitem"]')?.getAttribute('data-index')).toBe('0');
    body.assert();
  });

  it('focuses the panel slot when a pressed panel chip has a later twin', async () => {
    const body = watchBody();
    const tags = owner(['aa', 'bb', 'cc', 'dd', 'xx', 'ee', 'xx', 'ff'], 1);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+5 more' }));
    });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Remove xx' })[0]!);
    });
    await act(async () => tags.set((current) => current.filter((_, index) => index !== 4)));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove ee' }));
    expect((document.activeElement as HTMLElement).closest('[role="dialog"]')).toBeTruthy();
    body.assert();
  });

  it('keeps focus on a keyed chip when the owner reverses the row', async () => {
    const body = watchBody();
    const items = keyed([
      { id: '1', label: 'aa' },
      { id: '2', label: 'bb' },
      { id: '3', label: 'cc' },
    ]);
    const button = screen.getByRole('button', { name: 'Remove aa' });
    act(() => button.focus());
    await act(async () => items.set((current) => [...current].reverse()));
    expect(document.activeElement).toBe(button);
    expect(button.closest('[role="listitem"]')?.getAttribute('data-index')).toBe('2');
    body.assert();
  });

  it('keeps focus on a keyed chip when the owner reorders the open panel', async () => {
    const body = watchBody();
    const items = keyed(
      EIGHT.map((label, index) => ({ id: String(index), label })),
      1,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+5 more' }));
    });
    const button = screen.getByRole('button', { name: 'Remove ff' });
    act(() => button.focus());
    await act(async () => items.set((current) => [...current.slice(0, 3), ...current.slice(3).reverse()]));
    expect(document.activeElement).toBe(button);
    expect(button.closest('[role="dialog"]')).toBeTruthy();
    body.assert();
  });

  it('moves focus to +N when a reorder sends the focused chip into the closed panel', async () => {
    const body = watchBody();
    const items = keyed(
      EIGHT.map((label, index) => ({ id: String(index), label })),
      1,
    );
    act(() => screen.getByRole('button', { name: 'Remove aa' }).focus());
    await act(async () => items.set((current) => [...current.slice(1), current[0]!]));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '+5 more' }));
    body.assert();
  });

  it('leaves focus alone when a chip is added after the focused one', async () => {
    const tags = owner(['aa', 'bb', 'cc']);
    const button = screen.getByRole('button', { name: 'Remove bb' });
    act(() => button.focus());
    const events: string[] = [];
    const log = (event: Event) => events.push(event.type);
    document.addEventListener('focusin', log);
    document.addEventListener('focusout', log);
    await act(async () => tags.set((current) => [...current, 'dd']));
    document.removeEventListener('focusin', log);
    document.removeEventListener('focusout', log);
    expect(events).toEqual([]);
    expect(document.activeElement).toBe(button);
  });

  it('gives every default key its own slot, even for a value that looks numbered', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<ChipList.Root aria-label="Tags" chips={['a', 'a', '1:a', 'a#1']} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('moves focus to the slot under StrictMode', async () => {
    const body = watchBody();
    function Strict() {
      const [tags, setTags] = useState(['aa', 'bb', 'cc']);
      return (
        <StrictMode>
          <ChipList.Root
            aria-label="Tags"
            chips={tags}
            maxRows={2}
            onRemove={(index) => setTags((current) => current.filter((_, i) => i !== index))}
          />
        </StrictMode>
      );
    }
    render(<Strict />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove bb' }));
    });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove cc' }));
    body.assert();
  });

  it('leaves focus on another chip when an old press is dropped later', async () => {
    const body = watchBody();
    const tags = owner(['aa', 'bb', 'cc']);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove aa' }));
    });
    const button = screen.getByRole('button', { name: 'Remove cc' });
    act(() => button.focus());
    await act(async () => tags.set((current) => current.slice(1)));
    expect(document.activeElement).toBe(button);
    body.assert();
  });

  it('follows a keyed chip when only the keys change', async () => {
    const body = watchBody();
    const labels = ['xx', 'xx'];
    let swap = () => undefined as void;
    function Owner() {
      const [ids, setIds] = useState(['1', '2']);
      swap = () => setIds((current) => [...current].reverse());
      return <ChipList.Root aria-label="Tags" chips={labels} getKey={(_, index) => ids[index]!} onRemove={() => undefined} />;
    }
    render(<Owner />);
    const [first] = screen.getAllByRole('button', { name: 'Remove xx' }) as [HTMLElement];
    act(() => first.focus());
    await act(async () => swap());
    expect(document.activeElement).toBe(first);
    expect(first.closest('[role="listitem"]')?.getAttribute('data-index')).toBe('1');
    body.assert();
  });

  it('leaves focus outside alone when the open panel empties on a resize', async () => {
    const width = { current: 400 };
    const ros = stubListWidth(width);
    render(
      <>
        <ChipListDemo maxRows={1} initialChips={EIGHT} />
        <input aria-label="Elsewhere" />
      </>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+5 more' }));
    });
    const input = screen.getByRole('textbox', { name: 'Elsewhere' });
    act(() => input.focus());
    width.current = 4000;
    await resizeTo(ros);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(input);
  });

  it('forgets a press once focus leaves the pressed chip', async () => {
    const tags = owner(['aa', 'aa']);
    const [first, second] = screen.getAllByRole('button', { name: 'Remove aa' }) as [HTMLElement, HTMLElement];
    await act(async () => {
      fireEvent.click(second);
    });
    act(() => first.focus());
    await act(async () => tags.set((current) => current.slice(1)));
    const items = screen.getAllByRole('listitem').filter((item) => item.hasAttribute('data-key'));
    expect(items.map((item) => item.getAttribute('data-key'))).toEqual(['1:aa']);
  });

  it('names a panel with one chip in the singular by default', async () => {
    render(<ChipList.Root aria-label="Tags" chips={['aa', 'bb', 'cc', 'dd']} maxRows={1} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /1/ }));
    });
    expect(screen.getByRole('dialog', { name: '1 more chip' })).toBeTruthy();
  });

  it('defines chip geometry tokens and uses them on Chip', () => {
    render(<ChipListDemo maxRows={1} initialChips={EIGHT} />);
    const css = readFileSync(require.resolve('@tounsoo/todae/todae.css'), 'utf8');
    expect(css).toMatch(/--todae-chip-leading:\s*var\(--_todae-chip-leading,\s*var\(--todae-font-leading-tight\)\)/);
    expect(css).toMatch(/--todae-chip-border-width:\s*var\(--_todae-chip-border-width,\s*var\(--todae-border-width\)\)/);
    expect(css).toMatch(/--todae-chip-ring-width:\s*var\(--_todae-chip-ring-width,\s*var\(--todae-focus-ring-width\)\)/);
    expect(css).toMatch(/--todae-chip-ring-offset:\s*var\(--_todae-chip-ring-offset,\s*var\(--todae-focus-ring-offset\)\)/);
    const root = screen.getByRole('button', { name: 'Remove aa' }).parentElement as HTMLElement;
    const cls = [...root.classList][0];
    const joined = css
      .split('}')
      .filter((part) => part.includes(`.${cls}`))
      .join('}');
    expect(joined).toContain('var(--todae-chip-border-width)');
    expect(joined).toContain('var(--todae-chip-leading)');
    expect(joined).toContain('var(--todae-chip-ring-width)');
    expect(joined).toContain('var(--todae-chip-ring-offset)');
    expect(joined).not.toMatch(/1px solid/);
    expect(joined).not.toMatch(/line-height:\s*1\.25/);
    expect(joined).not.toMatch(/2px solid/);
  });

  it('focuses a chip revealed by the remeasure, not the list', async () => {
    const body = watchBody();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('data-overflow') != null) return rect(50);
      if (this.getAttribute('role') === 'list' || this.querySelector?.(':scope > input')) return rect(160, 32);
      if (this.tagName === 'SPAN' && this.querySelector?.('button, [aria-hidden]')) return rect(100);
      return rect(0, 0);
    });
    render(<ChipListDemo maxRows={1} initialChips={['aa', 'bb', 'cc']} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove aa' }));
    });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove bb' }));
    expect(document.activeElement).not.toBe(screen.getByRole('list', { name: 'Tags' }));
    body.assert();
  });

  it('focuses the next chip, else the previous, else the list', async () => {
    const body = watchBody();
    render(<ChipListDemo maxRows={2} initialChips={['aa', 'bb', 'cc']} />);
    const list = screen.getByRole('list', { name: 'Tags' });
    expect(list.tabIndex).toBe(-1);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove bb' }));
    });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove cc' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove cc' }));
    });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove aa' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove aa' }));
    });
    expect(document.activeElement).toBe(list);
    expect(document.activeElement).not.toBe(document.body);
    expect(list.tabIndex).toBe(-1);
    expect(list.hasAttribute('data-ring')).toBe(true);
    expect(list.childElementCount).toBe(0);
    expect(list.textContent).toBe('');
    expect(document.querySelector('[inert][aria-hidden]')).not.toBeNull();
    body.assert();
  });

  it('keeps an empty list mounted and focusable', () => {
    render(<ChipListDemo maxRows={1} initialChips={[]} />);
    const list = screen.getByRole('list', { name: 'Tags' });
    expect(list.isConnected).toBe(true);
    expect(list.tabIndex).toBe(-1);
    expect(list.textContent).toBe('');
    act(() => {
      list.focus();
    });
    expect(document.activeElement).toBe(list);
    expect(list.hasAttribute('data-ring')).toBe(true);
    expect(rulesFor(list)).toContain('outline:var(--todae-chip-ring-width) solid var(--todae-chip-ring-focus)');
  });

  function mockSoakWidths() {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('data-overflow') != null) return rect(50);
      if (this.getAttribute('role') === 'list') return rect(250, 32);
      const text = this.textContent ?? '';
      if (text.startsWith('…')) return rect(60);
      if (text.includes('Beta')) return rect(150);
      if (this.tagName === 'SPAN' && this.querySelector?.('button, [aria-hidden], span')) return rect(80);
      return rect(0, 0);
    });
  }

  it('moves a chip into the popover instead of shrinking it', () => {
    mockSoakWidths();
    render(<ChipListDemo maxRows={1} initialChips={['Alpha', 'Beta', 'Gamma']} />);
    const list = screen.getByRole('list', { name: 'Tags' });
    expect(removes(list).map((button) => button.getAttribute('aria-label'))).toEqual(['Remove Alpha']);
    expect([...list.querySelectorAll<HTMLElement>('[role="listitem"]')].some((item) => item.style.maxWidth)).toBe(
      false,
    );
    const dialog = screen.getByRole('dialog', { name: '2 more tags' });
    expect(dialog.textContent).toContain('Beta');
    expect(removes(dialog).map((button) => button.getAttribute('aria-label'))).toContain('Remove Beta');

    cleanup();
    mockSoakWidths();
    render(<ChipListDemo maxRows={1} initialChips={['Alpha', 'Beta', 'Gamma']} readOnly />);
    const readOnlyList = screen.getByRole('list', { name: 'Tags' });
    const labels = [...readOnlyList.querySelectorAll<HTMLElement>('[role="listitem"]')]
      .filter((item) => !item.querySelector('button[aria-haspopup]'))
      .map((item) => item.textContent);
    expect(labels).toEqual(['Alpha']);
  });

  it('moves focus from +N to the first chip it held once nothing is folded', async () => {
    const body = watchBody();
    const width = { current: 400 };
    const ros = stubListWidth(width);
    render(<ChipListDemo maxRows={1} initialChips={EIGHT} />);
    act(() => screen.getByRole('button', { name: '+5 more' }).focus());
    width.current = 4000;
    await resizeTo(ros);
    expect(screen.queryByRole('button', { name: /more/ })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove dd' }));
    body.assert();
  });

  it('moves focus from +N to the list once a read-only list has nothing folded', async () => {
    const body = watchBody();
    const width = { current: 400 };
    const ros = stubListWidth(width);
    render(<ChipListDemo maxRows={1} initialChips={EIGHT} readOnly />);
    act(() => screen.getByRole('button', { name: '+5 more' }).focus());
    width.current = 4000;
    await resizeTo(ros);
    const list = screen.getByRole('list', { name: 'Tags' });
    expect(document.activeElement).toBe(list);
    expect(list.hasAttribute('data-ring')).toBe(true);
    body.assert();
  });

  it('leaves focus on a twin the person moved to when the pressed twin is dropped later', async () => {
    const body = watchBody();
    const tags = owner(['aa', 'x', 'aa', 'y']);
    const [first, second] = screen.getAllByRole('button', { name: 'Remove aa' }) as [HTMLElement, HTMLElement];
    await act(async () => {
      fireEvent.click(first);
    });
    act(() => second.focus());
    await act(async () => tags.set((current) => current.filter((_, index) => index !== 0)));
    expect(document.activeElement).toBe(second);
    expect(second.closest('[role="listitem"]')?.getAttribute('data-index')).toBe('1');
    body.assert();
  });

  it('leaves focus on a chip when the owner drops an earlier twin', async () => {
    const body = watchBody();
    const tags = owner(['aa', 'x', 'aa', 'y']);
    const second = screen.getAllByRole('button', { name: 'Remove aa' })[1] as HTMLElement;
    act(() => second.focus());
    await act(async () => tags.set((current) => current.slice(1)));
    expect(document.activeElement).toBe(second);
    body.assert();
  });

  it('leaves focus on a chip when a twin is added before it', async () => {
    const body = watchBody();
    const tags = owner(['x', 'aa']);
    const button = screen.getByRole('button', { name: 'Remove aa' });
    act(() => button.focus());
    await act(async () => tags.set((current) => ['aa', ...current]));
    expect(document.activeElement).toBe(button);
    expect(button.closest('[role="listitem"]')?.getAttribute('data-index')).toBe('2');
    body.assert();
  });

  it('returns focus to +N when Escape closes the panel', async () => {
    const body = watchBody();
    render(<ChipListDemo maxRows={1} initialChips={EIGHT} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+5 more' }));
    });
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('button', { name: 'Remove ee' }), { key: 'Escape' });
    });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '+5 more' }));
    body.assert();
  });

  it('moves focus to the list when the owner takes the remove buttons away', async () => {
    const body = watchBody();
    let lock = () => undefined as void;
    function Owner() {
      const [locked, setLocked] = useState(false);
      lock = () => setLocked(true);
      return <ChipList.Root aria-label="Tags" chips={['aa', 'bb']} onRemove={locked ? undefined : () => undefined} />;
    }
    render(<Owner />);
    act(() => screen.getByRole('button', { name: 'Remove bb' }).focus());
    await act(async () => lock());
    expect(document.activeElement).toBe(screen.getByRole('list', { name: 'Tags' }));
    body.assert();
  });

  // Random owner changes, resizes and key presses. Wherever focus starts in
  // the component, it stays there, and a keyed chip that can still take
  // focus keeps it.
  it('keeps focus in the component through random changes', { timeout: 30000 }, async () => {
    const width = { current: 400 };
    const ros = stubListWidth(width);
    let seed = 7;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    type Item = { id: string; label: string };
    for (let run = 0; run < 60; run++) {
      const keyed = run % 2 === 0;
      let next = 0;
      const make = (): Item => ({ id: `id${next++}`, label: ['aa', 'bb', 'cc'][rand(3)]! });
      const api = { set: (_: (items: Item[]) => Item[]) => undefined as void, pending: [] as number[] };
      let sync = false;
      function Owner() {
        const [items, setItems] = useState<Item[]>(() => Array.from({ length: 6 }, make));
        api.set = setItems;
        return (
          <ChipList.Root
            aria-label="Tags"
            chips={items.map((item) => item.label)}
            getKey={keyed ? (_, index) => items[index]!.id : undefined}
            maxRows={1}
            overflowLabel={(n) => `+${n} more`}
            onRemove={(index) => {
              if (sync) setItems((current) => current.filter((_, i) => i !== index));
              else api.pending.push(index);
            }}
          />
        );
      }
      width.current = 400;
      const view = render(
        run % 4 < 2 ? (
          <Owner />
        ) : (
          <StrictMode>
            <Owner />
          </StrictMode>
        ),
      );
      const list = screen.getByRole('list', { name: 'Tags' });
      const panelOf = () => view.container.querySelector<HTMLElement>('[role="dialog"]');
      const focusables = () => {
        const panel = panelOf();
        const open = panel?.hasAttribute('data-popover-open') ? [...panel.querySelectorAll<HTMLElement>('button')] : [];
        return [...list.querySelectorAll<HTMLElement>('button'), ...open];
      };
      act(() => focusables()[0]?.focus());
      for (let step = 0; step < 40; step++) {
        const before = document.activeElement as HTMLElement | null;
        const inside = before != null && (list.contains(before) || !!panelOf()?.contains(before));
        const beforeKey = before?.closest('[data-key]')?.getAttribute('data-key') ?? null;
        const op = rand(9);
        sync = rand(2) === 0;
        const where = `run ${run} step ${step} op ${op}`;
        await act(async () => {
          if (op === 0) {
            const removable = focusables().filter((b) => b.getAttribute('aria-label')?.startsWith('Remove'));
            const button = removable[rand(Math.max(removable.length, 1))];
            if (button) fireEvent.click(button);
          } else if (op === 1) {
            const index = api.pending.shift();
            api.pending.length = 0;
            if (index != null) api.set((current) => current.filter((_, i) => i !== index));
          } else if (op === 2) {
            api.set((current) => (current.length ? current.filter((_, i) => i !== rand(current.length)) : current));
          } else if (op === 3) {
            api.set((current) => {
              const copy = [...current];
              copy.splice(rand(copy.length + 1), 0, make());
              return copy;
            });
            api.pending.length = 0;
          } else if (op === 4) {
            api.set((current) => [...current].reverse());
            api.pending.length = 0;
          } else if (op === 5) {
            width.current = [150, 300, 400, 600, 4000][rand(5)]!;
            for (const cb of ros) cb([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
          } else if (op === 6) {
            const more = list.querySelector<HTMLElement>('button[aria-haspopup]');
            if (more) fireEvent.click(more);
          } else if (op === 7) {
            if (document.activeElement) fireEvent.keyDown(document.activeElement, { key: 'Escape' });
          } else {
            const all = focusables();
            all[rand(Math.max(all.length, 1))]?.focus();
          }
        });
        const active = document.activeElement as HTMLElement;
        const panel = panelOf();
        // A click on +N or a focus on purpose may move focus anywhere.
        const moves = op === 6 || op === 8;
        if (inside && !moves) {
          expect(active, where).not.toBe(document.body);
          expect(list.contains(active) || !!panel?.contains(active), where).toBe(true);
        }
        if (panel?.contains(active)) expect(panel.hasAttribute('data-popover-open'), where).toBe(true);
        if (active === list && before !== list) expect(list.querySelectorAll('button'), where).toHaveLength(0);
        if (keyed && inside && !moves && op !== 0 && beforeKey != null) {
          const own = [list, panel].flatMap((box) =>
            box ? [...box.children].filter((el) => el.getAttribute('data-key') === beforeKey) : [],
          );
          const button = own.map((el) => el.querySelector('button')).find((b) => b != null && focusables().includes(b));
          if (button) expect(active, where).toBe(button);
        }
      }
      view.unmount();
    }
  });

  it('server-renders the list hidden until measured', () => {
    const html = renderToString(<ChipListDemo maxRows={1} initialChips={EIGHT} />);
    expect(html).toContain('data-measuring=""');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('inert');
    expect(html).not.toContain('aria-haspopup');
  });
});
