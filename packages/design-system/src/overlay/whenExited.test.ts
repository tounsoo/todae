import { afterEach, describe, expect, it, vi } from 'vitest';
import { whenExited } from './whenExited.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function fade(el: HTMLElement, ms: () => string) {
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((node: Element) => {
    const style = real(node);
    if (node !== el) return style;
    const duration = ms();
    return Object.assign(Object.create(style), {
      transitionProperty: duration === '0s' ? 'none' : 'opacity',
      transitionDuration: duration,
      transitionDelay: '0s',
    }) as CSSStyleDeclaration;
  });
}

const fire = (el: HTMLElement, type: string) =>
  el.dispatchEvent(Object.assign(new Event(type), { propertyName: 'opacity' }));

describe('whenExited', () => {
  it('ends at once with no exit', () => {
    const el = document.createElement('div');
    fade(el, () => '0s');
    const done = vi.fn();
    whenExited(el, 'opacity', done);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('ends when the exit ends, once', () => {
    vi.useFakeTimers();
    const el = document.createElement('div');
    fade(el, () => '0.16s');
    const done = vi.fn();
    whenExited(el, 'opacity', done);
    expect(done).not.toHaveBeenCalled();
    fire(el, 'transitionend');
    vi.advanceTimersByTime(500);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('ends when the exit is cut short and no exit is left', () => {
    const el = document.createElement('div');
    let duration = '0.16s';
    fade(el, () => duration);
    const done = vi.fn();
    whenExited(el, 'opacity', done);
    duration = '0s';
    fire(el, 'transitioncancel');
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('keeps waiting when a cancel only gives way to the exit', () => {
    vi.useFakeTimers();
    const el = document.createElement('div');
    fade(el, () => '0.16s');
    const done = vi.fn();
    whenExited(el, 'opacity', done);
    fire(el, 'transitioncancel');
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(160);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('never ends once cancelled', () => {
    vi.useFakeTimers();
    const el = document.createElement('div');
    fade(el, () => '0.16s');
    const done = vi.fn();
    whenExited(el, 'opacity', done)();
    fire(el, 'transitionend');
    vi.advanceTimersByTime(500);
    expect(done).not.toHaveBeenCalled();
  });
});
