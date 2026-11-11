import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { observeChildren, observeSize, watchScroller } from './sharedObservers.js';

const made: FakeResizeObserver[] = [];
class FakeResizeObserver {
  watched = new Set<Element>();
  constructor(public callback: ResizeObserverCallback) {
    made.push(this);
  }
  observe(target: Element) {
    this.watched.add(target);
  }
  unobserve(target: Element) {
    this.watched.delete(target);
  }
  disconnect() {
    this.watched.clear();
  }
  /** Reports a size for `targets`, as the browser would. */
  report(targets: Element[], inlineSize = 100) {
    const entries = targets.map((target) => ({
      target,
      contentRect: { width: inlineSize, height: 20 },
      contentBoxSize: [{ inlineSize, blockSize: 20 }],
    }));
    this.callback(entries as unknown as ResizeObserverEntry[], this as unknown as ResizeObserver);
  }
}

let mutationObservers = 0;
const NativeMutationObserver = globalThis.MutationObserver;
class CountedMutationObserver extends NativeMutationObserver {
  constructor(callback: MutationCallback) {
    super(callback);
    mutationObservers++;
  }
}

beforeEach(() => {
  made.length = 0;
  mutationObservers = 0;
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.stubGlobal('MutationObserver', CountedMutationObserver);
});
afterEach(() => vi.unstubAllGlobals());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('observeSize', () => {
  it('watches every target with one observer, and each target once', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    const heard: string[] = [];
    const stops = [
      observeSize(a, () => heard.push('a1')),
      observeSize(a, () => heard.push('a2')),
      observeSize(b, () => heard.push('b')),
    ];
    expect(made).toHaveLength(1);
    expect([...made[0]!.watched]).toEqual([a, b]);
    made[0]!.report([a, b]);
    expect(heard).toEqual(['a1', 'a2', 'b']);
    stops[0]!();
    expect(made[0]!.watched.has(a)).toBe(true);
    stops[1]!();
    expect(made[0]!.watched.has(a)).toBe(false);
    stops[2]!();
    expect(made[0]!.watched.size).toBe(0);
  });
});

describe('a shared report', () => {
  it('reaches every other listener when one throws, and none stopped earlier in the report', () => {
    vi.useFakeTimers();
    try {
      const a = document.createElement('div');
      const b = document.createElement('div');
      const heard: string[] = [];
      let stopLater = () => {};
      const stopThrowing = observeSize(a, () => {
        stopLater();
        throw new Error('boom');
      });
      stopLater = observeSize(a, () => heard.push('stopped'));
      const twice = () => heard.push('b');
      const stopFirst = observeSize(b, twice);
      const stopSecond = observeSize(b, twice);
      stopFirst();
      made[0]!.report([a, b]);
      expect(heard).toEqual(['b']);
      expect(() => vi.runAllTimers()).toThrow('boom');
      stopThrowing();
      stopSecond();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('observeChildren', () => {
  it('hears each target’s own child changes, and keeps hearing the live ones after stops', async () => {
    const lists = Array.from({ length: 4 }, () => document.createElement('div'));
    const heard: number[] = [];
    const stops = lists.map((list, index) => observeChildren(list, () => heard.push(index)));
    expect(mutationObservers).toBe(1);
    stops[0]!();
    stops[1]!();
    stops[2]!();
    for (const list of lists) list.append(document.createElement('span'));
    await settle();
    expect(heard).toEqual([3]);
    stops[3]!();
  });
});

describe('watchScroller', () => {
  it('shares one watch of a scroller and its children, and follows children that arrive', async () => {
    const list = document.createElement('div');
    const first = list.appendChild(document.createElement('button'));
    const one = { resized: vi.fn(), children: vi.fn() };
    const two = { resized: vi.fn() };
    const a = watchScroller(list, one);
    const b = watchScroller(list, two);
    const observer = made[0]!;
    expect([...observer.watched]).toEqual([list, first]);

    observer.report([list], 240.5);
    expect(one.resized).toHaveBeenCalledWith({ inline: 240.5, block: 20 });
    expect(two.resized).toHaveBeenCalledWith({ inline: 240.5, block: 20 });
    expect(b.box()).toEqual({ inline: 240.5, block: 20 });

    const second = list.appendChild(document.createElement('button'));
    first.remove();
    await settle();
    expect(one.children).toHaveBeenCalledTimes(1);
    expect([...observer.watched]).toEqual([list, second]);

    a.stop();
    expect(observer.watched.size).toBe(2);
    b.stop();
    expect(observer.watched.size).toBe(0);
  });
});
