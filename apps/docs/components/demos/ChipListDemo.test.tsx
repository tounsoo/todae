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
const ROW =
  'calc(var(--todae-chip-font-size) * var(--todae-chip-leading) + 2 * var(--todae-chip-padding-y) + 2 * var(--todae-chip-border-width))';
const GAP = 'var(--todae-space-inline-gap)';
const PAD = 'calc(var(--todae-chip-ring-width) + var(--todae-chip-ring-offset))';

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
    for (const [maxRows, visibleCount, more, ellipsis] of [
      [1, 3, '+5 more', 'accessibility'],
      [2, 4, '+4 more', null],
    ] as const) {
      const view = render(<ChipListDemo maxRows={maxRows} />);
      const list = view.getByRole('list', { name: 'Tags' });
      const wrapper = list.parentElement as HTMLElement;
      expect(wrapper.style.overflow).toBe('hidden');
      expect(wrapper.style.padding).toBe(PAD);
      expect(wrapper.style.margin).toBe(`calc(${PAD} * -1)`);
      expect(wrapper.style.minHeight).toBe(`calc(${ROW} + 2 * ${PAD})`);
      expect(wrapper.style.maxHeight).toBe(`calc(${ROW} * ${maxRows} + ${GAP} * ${maxRows - 1} + 2 * ${PAD})`);
      expect(list.style.overflow).toBe('');
      expect(list.style.maxHeight).toBe('');
      expect(list.style.minHeight).toBe(ROW);
      expect(removes(list)).toHaveLength(visibleCount);
      expect(live(view.container, '[data-overflow]')[0]?.textContent).toContain(more);
      const truncated = [...list.children].filter((el) => (el as HTMLElement).style.maxWidth !== '');
      expect(truncated.map((el) => el.textContent)).toEqual(ellipsis ? [expect.stringContaining(ellipsis)] : []);
      view.unmount();
    }
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

  it('truncates with max-width and ellipsis CSS, and names the full label', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('data-overflow') != null) return rect(40);
      if (this.getAttribute('role') === 'list' || this.querySelector?.(':scope > input')) return rect(250, 32);
      const text = this.textContent ?? '';
      const width = text.startsWith('…') ? 60 : text.startsWith('a-very-long-tag-that-stays-put') ? 150 : 80;
      if (this.tagName === 'SPAN' && this.querySelector?.('button, [aria-hidden]')) return rect(width);
      return rect(0, 0);
    });
    const full = 'a-very-long-tag-that-stays-put';
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
    expect(screen.getByRole('button', { name: '+1 more' })).toBeTruthy();
  });

  it('names +N more, and hides the measure row', () => {
    render(<ChipListDemo maxRows={1} initialChips={EIGHT} />);
    const list = screen.getByRole('list', { name: 'Tags' });
    expect(screen.getByRole('button', { name: 'Remove aa' }).textContent).toBe('×');
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
    expect(dialog.classList.contains('chip-list-panel')).toBe(true);
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

  it('defines chip geometry tokens and uses them on Chip', () => {
    render(<ChipListDemo maxRows={1} initialChips={EIGHT} />);
    const css = readFileSync(require.resolve('@tounsoo/todae/todae.css'), 'utf8');
    expect(css).toMatch(/--todae-chip-leading:\s*1\.25/);
    expect(css).toMatch(/--todae-chip-border-width:\s*1px/);
    expect(css).toMatch(/--todae-chip-ring-width:\s*2px/);
    expect(css).toMatch(/--todae-chip-ring-offset:\s*2px/);
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
    expect(list.style.minHeight).toBe(ROW);
    expect(list.style.outline).toContain('--todae-chip-ring-focus');
    expect(list.style.outlineOffset).toBe('var(--todae-chip-ring-offset)');
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
    expect(list.style.minHeight).toBe(ROW);
    expect(list.textContent).toBe('');
    act(() => {
      list.focus();
    });
    expect(document.activeElement).toBe(list);
    expect(list.style.outline).toContain('--todae-chip-ring-focus');
    expect(list.style.outlineOffset).toBe('var(--todae-chip-ring-offset)');
  });

  it('server-renders the list hidden until measured', () => {
    const html = renderToString(<ChipListDemo maxRows={1} initialChips={EIGHT} />);
    expect(html).toContain('visibility:hidden');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('inert');
    expect(html).not.toContain('chip-list-more');
  });
});
