import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchScrollerParts } from './scrollerParts.js';

// jsdom lays nothing out, so each part gets the box a browser would give it.
function setup() {
  const scroller = document.createElement('div');
  const top = document.createElement('span');
  const bottom = document.createElement('span');
  scroller.append(top, bottom);
  document.body.append(scroller);
  const box = (y: number) => ({ left: 0, right: 100, top: y, bottom: y + 20, width: 100, height: 20, x: 0, y, toJSON: () => ({}) });
  top.getBoundingClientRect = () => box(0);
  bottom.getBoundingClientRect = () => box(80);
  const shown = new Set<HTMLElement>([top, bottom]);
  const rest = vi.fn();
  const leave = vi.fn();
  const stop = watchScrollerParts(scroller, [top, bottom], { shown: (part) => shown.has(part), rest, leave });
  // jsdom drops movementX and movementY, so the parts tell a move from where the pointer was: each move first goes
  // somewhere else.
  const move = (target: Element, clientY: number, init: PointerEventInit = {}) => {
    document.body.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', bubbles: true, clientX: 0, clientY: -50 }));
    target.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', bubbles: true, clientX: 50, clientY, ...init }));
  };
  return { scroller, top, bottom, shown, rest, leave, stop, move };
}

describe('watchScrollerParts', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('rests on a shown part a pointer moves onto, and not on a hidden one or for touch', () => {
    const { top, shown, rest, move } = setup();
    move(top, 10);
    expect(rest).toHaveBeenLastCalledWith(top);
    rest.mockClear();
    move(top, 10, { pointerType: 'touch' });
    shown.delete(top);
    move(top, 10);
    expect(rest).not.toHaveBeenCalled();
  });

  it('counts a move the scroller gets, as under an overlay scrollbar, by the shown part under it (#533)', () => {
    const { scroller, bottom, shown, rest, leave, move } = setup();
    move(scroller, 95);
    expect(rest).toHaveBeenLastCalledWith(bottom);
    move(scroller, 50);
    expect(leave).toHaveBeenCalledTimes(1);
    rest.mockClear();
    shown.delete(bottom);
    move(scroller, 95);
    expect(rest).not.toHaveBeenCalled();
  });

  it('starts nothing for a move with a button held, and leaves on a press on the scroller itself (#534)', () => {
    const { scroller, bottom, rest, leave, move } = setup();
    move(scroller, 95, { buttons: 1 });
    expect(rest).not.toHaveBeenCalled();
    bottom.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    expect(leave).not.toHaveBeenCalled();
    scroller.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('cancels a press on a part, and stays on a part left for the band of the scroller under it', () => {
    const { scroller, bottom, leave } = setup();
    const press = new PointerEvent('pointerdown', { bubbles: true, cancelable: true });
    bottom.dispatchEvent(press);
    expect(press.defaultPrevented).toBe(true);
    bottom.dispatchEvent(new PointerEvent('pointerleave', { relatedTarget: scroller, clientX: 50, clientY: 95 }));
    expect(leave).not.toHaveBeenCalled();
    bottom.dispatchEvent(new PointerEvent('pointerleave', { relatedTarget: scroller, clientX: 50, clientY: 50 }));
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('hears nothing once stopped', () => {
    const { scroller, top, rest, leave, stop, move } = setup();
    stop();
    move(top, 10);
    move(scroller, 95);
    scroller.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(rest).not.toHaveBeenCalled();
    expect(leave).not.toHaveBeenCalled();
  });
});
