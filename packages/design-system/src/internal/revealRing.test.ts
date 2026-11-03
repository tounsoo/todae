import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeFrame } from '../test/frame.js';
import { revealRing } from './revealRing.js';

afterEach(() => {
  for (const frame of document.querySelectorAll('iframe')) frame.remove();
  document.body.replaceChildren();
});

const rect = (top: number, height: number, width: number) =>
  ({ top, bottom: top + height, left: 0, right: width, height, width, x: 0, y: top, toJSON() {} }) as DOMRect;

/** A 100px scroll port over 1000px of content, with a control showing a ring at 500px, in `doc`. */
function scrollArea(doc: Document) {
  const area = doc.body.appendChild(doc.createElement('div'));
  area.style.overflow = 'auto';
  const target = area.appendChild(doc.createElement('button'));
  for (const [name, value] of [
    ['scrollHeight', 1000],
    ['clientHeight', 100],
    ['scrollWidth', 100],
    ['clientWidth', 100],
  ] as const) {
    Object.defineProperty(area, name, { value, configurable: true });
  }
  area.getBoundingClientRect = () => rect(0, 100, 100);
  target.getBoundingClientRect = () => rect(500, 30, 30);
  const scrollBy = vi.fn();
  area.scrollBy = scrollBy;
  // jsdom has no :focus-visible, so stand in for a keyboard focus.
  const matches = target.matches.bind(target);
  target.matches = ((selector: string) => selector === ':focus-visible' || matches(selector)) as typeof target.matches;
  // Not in a popover or dialog. jsdom is slow to match :popover-open.
  target.closest = (() => null) as typeof target.closest;
  target.style.outline = '2px solid';
  return { area, target, scrollBy };
}

describe('revealRing', () => {
  it('scrolls a ring into view on the page', () => {
    const { area, target, scrollBy } = scrollArea(document);
    revealRing(area, target);
    expect(scrollBy).toHaveBeenCalled();
  });

  it('scrolls a ring into view in an iframe', () => {
    const { area, target, scrollBy } = scrollArea(makeFrame());
    revealRing(area, target);
    expect(scrollBy).toHaveBeenCalled();
  });
});
