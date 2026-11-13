// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Code } from '@tounsoo/todae/code';
import { DocsPre } from './DocsPre';
import { ScrollRegion } from './ScrollRegion';

const path = vi.hoisted(() => ({ current: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => path.current }));

const observers: Array<{ cb: ResizeObserverCallback; targets: Set<Element> }> = [];
let wide = true;

beforeEach(() => {
  wide = true;
  observers.length = 0;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      cb: ResizeObserverCallback;
      targets = new Set<Element>();
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
        observers.push(this);
      }
      observe(target: Element) {
        this.targets.add(target);
      }
      disconnect() {
        this.targets.clear();
      }
      unobserve(target: Element) {
        this.targets.delete(target);
      }
    },
  );
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get() {
      return wide ? 800 : 100;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return 320;
    },
  });
});

afterEach(() => {
  cleanup();
  path.current = '/';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollWidth');
  Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
});

async function remeasure() {
  // The measure runs in the shared layout batch, a microtask after the report.
  await act(async () => {
    // Reports every observed target, as a browser does after a resize.
    for (const observer of observers) {
      const entries = [...observer.targets].map((target) => ({ target, contentRect: target.getBoundingClientRect() }));
      observer.cb(entries as unknown as ResizeObserverEntry[], observer as unknown as ResizeObserver);
    }
  });
}

describe('overflow regions', () => {
  it('names code and table regions from the nearest heading, numbered when they repeat', () => {
    render(
      <>
        <h2>Props</h2>
        <DocsPre>
          <code>one</code>
        </DocsPre>
        <DocsPre>
          <code>two</code>
        </DocsPre>
        <h2>Tokens</h2>
        <ScrollRegion>
          <table>
            <tbody>
              <tr>
                <td>a</td>
              </tr>
            </tbody>
          </table>
        </ScrollRegion>
        <ScrollRegion>
          <table>
            <tbody>
              <tr>
                <td>b</td>
              </tr>
            </tbody>
          </table>
        </ScrollRegion>
      </>,
    );
    const pres = screen.getAllByRole('region');
    expect(pres.map((el) => el.getAttribute('aria-label'))).toEqual([
      'Code example, Props 1',
      'Code example, Props 2',
      'Table, Tokens 1',
      'Table, Tokens 2',
    ]);
    for (const el of pres) expect(el.tabIndex).toBe(0);
  });

  it('names regions in the page language', () => {
    path.current = '/ko/button';
    render(
      <>
        <h2>Props</h2>
        <DocsPre>
          <code>one</code>
        </DocsPre>
        <ScrollRegion>
          <table>
            <tbody>
              <tr>
                <td>a</td>
              </tr>
            </tbody>
          </table>
        </ScrollRegion>
      </>,
    );
    expect(screen.getAllByRole('region').map((el) => el.getAttribute('aria-label'))).toEqual(['코드 예시, Props', '표, Props']);
  });

  it('keeps the region focusable until blur when it stops overflowing', async () => {
    render(
      <>
        <h2>Popover</h2>
        <DocsPre>
          <code>const example = true</code>
        </DocsPre>
        <ScrollRegion>
          <table>
            <tbody>
              <tr>
                <td>wide</td>
              </tr>
            </tbody>
          </table>
        </ScrollRegion>
      </>,
    );
    const pre = screen.getByRole('region', { name: 'Code example, Popover' });
    const table = screen.getByRole('region', { name: 'Table, Popover' });
    act(() => {
      pre.focus();
    });
    wide = false;
    await remeasure();
    expect(pre.getAttribute('tabindex')).toBe('0');
    expect(pre.getAttribute('role')).toBe('region');
    expect(pre.getAttribute('aria-label')).toBe('Code example, Popover');
    expect(document.activeElement).toBe(pre);
    fireEvent.blur(pre);
    expect(pre.getAttribute('tabindex')).toBeNull();
    expect(pre.getAttribute('role')).toBeNull();

    wide = true;
    await remeasure();
    act(() => {
      table.focus();
    });
    wide = false;
    await remeasure();
    expect(table.getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(table);
    fireEvent.blur(table);
    expect(table.getAttribute('tabindex')).toBeNull();
    expect(table.getAttribute('role')).toBeNull();
  });
});

describe('long code blocks', () => {
  // MDX hands the block its text with a closing newline, inside the Code.Root that mdx-components maps `code` to.
  const fence = (count: number) => `${Array.from({ length: count }, (_, index) => `const line${index + 1} = ${index + 1};`).join('\n')}\n`;

  it('shows a block of 40 lines whole, with no button', () => {
    const { container } = render(
      <DocsPre>
        <Code.Root className="language-ts">{fence(40)}</Code.Root>
      </DocsPre>,
    );
    expect(container.querySelector('code')?.textContent).toBe(fence(40));
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the first 20 lines of a longer block, and the rest on Show all code', () => {
    const text = fence(41);
    // Records whether scroll anchoring was off when the page scrolled.
    const scrollBy = vi.fn((_: ScrollToOptions) => document.documentElement.style.overflowAnchor);
    vi.stubGlobal('scrollBy', scrollBy);
    const { container } = render(
      <>
        <h2>Recipe</h2>
        <DocsPre>
          <Code.Root className="language-tsx">{text}</Code.Root>
        </DocsPre>
      </>,
    );
    const code = container.querySelector('code');
    const button = screen.getByRole('button', { name: 'Show all code' });
    const rest = document.getElementById(button.getAttribute('aria-controls') ?? '');
    expect(code?.classList.contains('language-tsx')).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(rest?.hasAttribute('hidden')).toBe(true);
    expect(code?.contains(rest)).toBe(true);
    // The rest stays in the page, for find in page and for anything that reads the HTML, and the two parts are
    // the fence's text, so selecting and copying the open block gives the whole code.
    expect(code?.textContent).toBe(text);
    expect(code?.firstChild?.textContent).toBe(text.split('\n').slice(0, 20).join('\n'));
    expect(screen.getByRole('region', { name: 'Code example, Recipe' })).not.toBeNull();

    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.textContent).toBe('Show less code');
    expect(rest?.hasAttribute('hidden')).toBe(false);
    expect(scrollBy).not.toHaveBeenCalled();

    // Folding keeps the button where it was in the viewport: it sat 500px down, and the shorter block puts it at 100px.
    vi.spyOn(button, 'getBoundingClientRect').mockImplementation(() =>
      DOMRect.fromRect({ y: button.getAttribute('aria-expanded') === 'true' ? 500 : 100, height: 40 }),
    );
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(rest?.hasAttribute('hidden')).toBe(true);
    expect(scrollBy).toHaveBeenCalledExactlyOnceWith({ top: -400, behavior: 'instant' });
    expect(scrollBy).toHaveReturnedWith('none');
    expect(document.documentElement.style.overflowAnchor).toBe('');
  });

  it('opens when find in page reveals the rest', () => {
    render(
      <DocsPre>
        <Code.Root className="language-tsx">{fence(60)}</Code.Root>
      </DocsPre>,
    );
    const button = screen.getByRole('button', { name: 'Show all code' });
    const rest = document.getElementById(button.getAttribute('aria-controls') ?? '');
    act(() => {
      rest?.dispatchEvent(new Event('beforematch'));
      rest?.removeAttribute('hidden');
    });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(rest?.hasAttribute('hidden')).toBe(false);
  });

  it('names the button in the page language', () => {
    path.current = '/ko/recipes/kanban';
    render(
      <DocsPre>
        <Code.Root className="language-tsx">{fence(41)}</Code.Root>
      </DocsPre>,
    );
    fireEvent.click(screen.getByRole('button', { name: '코드 전체 보기' }));
    expect(screen.getByRole('button', { name: '코드 접기' }).getAttribute('aria-expanded')).toBe('true');
  });
});
