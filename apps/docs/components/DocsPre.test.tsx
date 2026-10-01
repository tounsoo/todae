// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocsPre } from './DocsPre';
import { ScrollRegion } from './OverflowRegion';

const observers: Array<{ cb: ResizeObserverCallback }> = [];
let wide = true;

beforeEach(() => {
  wide = true;
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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollWidth');
  Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
});

function remeasure() {
  act(() => {
    for (const observer of observers) observer.cb([] as unknown as ResizeObserverEntry[], observer as unknown as ResizeObserver);
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

  it('keeps the region focusable until blur when it stops overflowing', () => {
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
    remeasure();
    expect(pre.getAttribute('tabindex')).toBe('0');
    expect(pre.getAttribute('role')).toBe('region');
    expect(pre.getAttribute('aria-label')).toBe('Code example, Popover');
    expect(document.activeElement).toBe(pre);
    fireEvent.blur(pre);
    expect(pre.getAttribute('tabindex')).toBeNull();
    expect(pre.getAttribute('role')).toBeNull();

    wide = true;
    remeasure();
    act(() => {
      table.focus();
    });
    wide = false;
    remeasure();
    expect(table.getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(table);
    fireEvent.blur(table);
    expect(table.getAttribute('tabindex')).toBeNull();
    expect(table.getAttribute('role')).toBeNull();
  });
});
