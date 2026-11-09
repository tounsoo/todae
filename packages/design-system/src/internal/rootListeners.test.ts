import { afterEach, describe, expect, it, vi } from 'vitest';
import { listenOnRoot } from './rootListeners.js';

const stops: (() => void)[] = [];
const listen = (...args: Parameters<typeof listenOnRoot>) => {
  const stop = listenOnRoot(...args);
  stops.push(stop);
  return stop;
};

afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  vi.restoreAllMocks();
});

const fire = (target: EventTarget, type = 'reset') => target.dispatchEvent(new Event(type, { bubbles: true }));

describe('listenOnRoot', () => {
  it('adds one listener to the root however many handlers listen, and removes it with the last', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const all = Array.from({ length: 50 }, () => listen(document, 'reset', () => undefined));
    expect(add.mock.calls.filter(([type]) => type === 'reset')).toHaveLength(1);
    for (const stop of all.slice(1)) stop();
    expect(remove).not.toHaveBeenCalled();
    all[0]!();
    expect(remove.mock.calls.filter(([type]) => type === 'reset')).toHaveLength(1);
  });

  it('calls the handlers in the order they started, in the capture phase', () => {
    const heard: string[] = [];
    const form = document.body.appendChild(document.createElement('form'));
    form.addEventListener('reset', () => heard.push('form'));
    listen(document, 'reset', () => void heard.push('a'));
    listen(document, 'reset', () => void heard.push('b'));
    fire(form);
    expect(heard).toEqual(['a', 'b', 'form']);
    form.remove();
  });

  it('keeps a handler started during a dispatch for the next event, and skips one stopped during it', () => {
    const heard: string[] = [];
    let stopB: () => void = () => undefined;
    listen(document, 'reset', () => {
      heard.push('a');
      stopB();
      listen(document, 'reset', () => void heard.push('late'));
    });
    stopB = listen(document, 'reset', () => void heard.push('b'));
    fire(document);
    expect(heard).toEqual(['a']);
  });

  it("stops the event at a handler that returns 'stop', for shared and other listeners alike", () => {
    const heard: string[] = [];
    listen(document, 'submit', () => {
      heard.push('a');
      return 'stop';
    });
    listen(document, 'submit', () => void heard.push('b'));
    const other = () => heard.push('other');
    document.addEventListener('submit', other, true);
    fire(document, 'submit');
    document.removeEventListener('submit', other, true);
    expect(heard).toEqual(['a']);
  });

  it('lets the other handlers hear an event one of them throws on', () => {
    vi.useFakeTimers();
    const heard: string[] = [];
    listen(document, 'reset', () => {
      throw new Error('boom');
    });
    listen(document, 'reset', () => void heard.push('b'));
    fire(document);
    expect(heard).toEqual(['b']);
    expect(() => vi.runAllTimers()).toThrow('boom');
    vi.useRealTimers();
  });

  it('subscribes the same function twice as two handlers', () => {
    const handler = vi.fn();
    const stop = listen(document, 'reset', handler);
    listen(document, 'reset', handler);
    fire(document);
    expect(handler).toHaveBeenCalledTimes(2);
    stop();
    fire(document);
    expect(handler).toHaveBeenCalledTimes(3);
  });
});
