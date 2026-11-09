import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchTabKey } from './tabKey.js';

afterEach(() => vi.restoreAllMocks());

describe('watchTabKey', () => {
  it('adds one window listener for every watcher, and removes it with the last', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const stops = Array.from({ length: 20 }, () => watchTabKey().stop);
    expect(add.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(1);
    for (const stop of stops.slice(1)) stop();
    stops[0]!();
    stops[0]!();
    expect(remove.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(1);
  });

  it('reads a Tab press as tabbing once its dispatch ends unprevented', () => {
    const watch = watchTabKey();
    const isTabbing = watch.tabbing;
    let during = true;
    const target = document.body.appendChild(document.createElement('button'));
    target.addEventListener('keydown', () => {
      during = isTabbing();
    });
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(during).toBe(false);
    expect(isTabbing()).toBe(true);
    const prevented = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    prevented.preventDefault();
    target.dispatchEvent(prevented);
    expect(isTabbing()).toBe(false);
    watch.stop();
    target.remove();
  });

  it('leaves out a Tab press already under way when a watch starts', () => {
    const first = watchTabKey();
    const target = document.body.appendChild(document.createElement('button'));
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    const late = watchTabKey();
    expect(first.tabbing()).toBe(true);
    expect(late.tabbing()).toBe(false);
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(late.tabbing()).toBe(true);
    late.stop();
    first.stop();
    target.remove();
  });
});
