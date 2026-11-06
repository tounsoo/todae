import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { observeMutations } from './sharedMutations.js';

let made = 0;
const NativeMutationObserver = globalThis.MutationObserver;
class CountedMutationObserver extends NativeMutationObserver {
  constructor(callback: MutationCallback) {
    super(callback);
    made++;
  }
}

beforeEach(() => {
  made = 0;
  vi.stubGlobal('MutationObserver', CountedMutationObserver);
});
afterEach(() => vi.unstubAllGlobals());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const kinds = (records: MutationRecord[]) =>
  records.map((record) => (record.type === 'attributes' ? `attr:${record.attributeName}` : record.type));

describe('observeMutations', () => {
  it('watches every target with one observer, and each listener hears its own tree only', async () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    document.body.append(a, b);
    const heard: string[] = [];
    const stops = [a, b].map(
      (target, index) =>
        observeMutations(target, { childList: true, subtree: true }, (records) =>
          heard.push(`${index}:${kinds(records).join()}`),
        ).stop,
    );
    expect(made).toBe(1);
    a.append(document.createElement('span'));
    await settle();
    expect(heard).toEqual(['0:childList']);
    for (const stop of stops) stop();
    a.remove();
    b.remove();
  });

  it('gives each listener only the records its own options ask for, on a target or nested inside another', async () => {
    const outer = document.createElement('div');
    const inner = document.createElement('div');
    const text = document.createTextNode('one');
    inner.append(text);
    outer.append(inner);
    const heard: Record<string, string[]> = { outer: [], inner: [], self: [] };
    const stops = [
      observeMutations(outer, { subtree: true, characterData: true }, (records) => heard.outer!.push(...kinds(records))),
      observeMutations(inner, { subtree: true, attributeFilter: ['hidden'] }, (records) =>
        heard.inner!.push(...kinds(records)),
      ),
      // Not subtree: only changes to the inner element itself.
      observeMutations(inner, { attributes: true }, (records) => heard.self!.push(...kinds(records))),
    ].map((watcher) => watcher.stop);
    text.data = 'two';
    inner.hidden = true;
    inner.title = 'x';
    const span = document.createElement('span');
    inner.append(span);
    span.className = 'c';
    await settle();
    expect(heard.outer).toEqual(['characterData']);
    expect(heard.inner).toEqual(['attr:hidden']);
    expect(heard.self).toEqual(['attr:hidden', 'attr:title']);
    for (const stop of stops) stop();
  });

  it('hears changes inside a subtree removed in the same batch, as an observer of its own would', async () => {
    const root = document.createElement('div');
    const parent = document.createElement('p');
    const text = document.createTextNode('one');
    parent.append(text);
    root.append(parent);
    const heard: MutationRecord[][] = [];
    const watcher = observeMutations(root, { subtree: true, childList: true, characterData: true }, (records) =>
      heard.push(records),
    );
    text.data = 'two';
    text.remove();
    parent.remove();
    await settle();
    expect(heard).toHaveLength(1);
    expect(heard[0]!.map((record) => record.type)).toEqual(['characterData', 'childList', 'childList']);
    expect(heard[0]![1]!.removedNodes[0]).toBe(text);
    watcher.stop();
  });

  it('hands a listener its records at once on flush, and the others theirs a microtask later', async () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    const heard: string[] = [];
    const first = observeMutations(a, { childList: true }, () => heard.push('a'));
    const second = observeMutations(b, { childList: true }, () => heard.push('b'));
    a.append(document.createElement('i'));
    b.append(document.createElement('i'));
    first.flush();
    expect(heard).toEqual(['a']);
    await Promise.resolve();
    expect(heard).toEqual(['a', 'b']);
    // Nothing is heard twice.
    await settle();
    expect(heard).toEqual(['a', 'b']);
    first.stop();
    second.stop();
  });

  it('keeps hearing the live targets after stops, and starts over once most targets are dropped', async () => {
    const lists = Array.from({ length: 4 }, () => document.createElement('div'));
    const observe = vi.spyOn(CountedMutationObserver.prototype, 'observe');
    const heard: number[] = [];
    const stops = lists.map(
      (list, index) => observeMutations(list, { childList: true }, () => heard.push(index)).stop,
    );
    expect(observe).toHaveBeenCalledTimes(4);
    stops[0]!();
    stops[1]!();
    expect(observe).toHaveBeenCalledTimes(4);
    // Three dropped against one live: the live one is observed afresh.
    stops[2]!();
    expect(observe).toHaveBeenCalledTimes(5);
    for (const list of lists) list.append(document.createElement('span'));
    await settle();
    expect(heard).toEqual([3]);
    stops[3]!();
    observe.mockRestore();
  });

  it('narrows a target’s options when a listener with wider ones stops', async () => {
    const el = document.createElement('div');
    const observe = vi.spyOn(CountedMutationObserver.prototype, 'observe');
    const wide = observeMutations(el, { attributes: true }, () => {});
    const narrow = observeMutations(el, { attributeFilter: ['hidden'] }, () => {});
    // Every attribute already covers the filter.
    expect(observe).toHaveBeenCalledTimes(1);
    wide.stop();
    expect(observe).toHaveBeenLastCalledWith(el, expect.objectContaining({ attributeFilter: ['hidden'] }));
    narrow.stop();
    observe.mockRestore();
  });

  it('reaches every other listener when one throws, and none stopped earlier in the same report', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      const a = document.createElement('div');
      const b = document.createElement('div');
      const c = document.createElement('div');
      const heard: string[] = [];
      let third = () => {};
      const stops = [
        observeMutations(a, { childList: true }, () => {
          heard.push('a');
          third();
          throw new Error('boom');
        }).stop,
        observeMutations(b, { childList: true }, () => heard.push('b')).stop,
      ];
      third = observeMutations(c, { childList: true }, () => heard.push('c')).stop;
      for (const el of [a, b, c]) el.append(document.createElement('i'));
      await Promise.resolve();
      expect(heard).toEqual(['a', 'b']);
      expect(() => vi.runAllTimers()).toThrow('boom');
      for (const stop of stops) stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does nothing where MutationObserver is missing', () => {
    vi.stubGlobal('MutationObserver', undefined);
    const watcher = observeMutations(document.createElement('div'), { childList: true }, () => {});
    expect(() => {
      watcher.flush();
      watcher.stop();
    }).not.toThrow();
  });
});
