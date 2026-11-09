import { afterEach, expect, it } from 'vitest';
import { clippedRings } from './clippedRings';

afterEach(() => {
  document.body.replaceChildren();
});

// A clip box around a scroll box around a tall focusable list, like the date and time picker
// recipe's popover around its time list. The list's ring is 2px wide with a 2px offset, so it needs 4px.
// Like the time list, the scroll box's scroll padding matches its padding, so focusing the list
// keeps that room rather than scrolling the list's top to the box's edge.
function mount({ scrollerPadding, scrollTop }: { scrollerPadding: number; scrollTop: number }) {
  document.body.innerHTML = `
    <div class="clip" style="overflow: hidden; padding: 2px; width: 200px">
      <div class="scroller" style="overflow-y: auto; height: 40px; padding: ${scrollerPadding}px; scroll-padding: ${scrollerPadding}px">
        <div class="list" tabindex="0" style="height: 100px; outline: 2px solid; outline-offset: 2px"></div>
      </div>
    </div>`;
  const scroller = document.querySelector<HTMLElement>('.scroller')!;
  scroller.scrollTop = scrollTop;
  return scroller;
}

it('passes a list whose scroll box leaves room for its ring', () => {
  mount({ scrollerPadding: 4, scrollTop: 0 });
  expect(clippedRings()).toEqual([]);
});

it('passes a list scrolled a little, whose top ring the scroll box already hides', () => {
  // The list's top sits 1px inside the clip box and 5px above the scroll box, so the clip box
  // would cut the ring's top edge if the scroll box didn't already hide it.
  const scroller = mount({ scrollerPadding: 4, scrollTop: 5 });
  expect(scroller.scrollTop).toBe(5);
  expect(clippedRings()).toEqual([]);
  expect(scroller.scrollTop, 'focusing the list scrolled it').toBe(5);
});

it('reports a ring the scroll box cuts while the list is in view', () => {
  mount({ scrollerPadding: 0, scrollTop: 0 });
  expect(clippedRings()).toContainEqual(expect.stringMatching(/^div\.list in div\.scroller: .*\btop\b/));
});

it('still reports a cut when a nearer overflow box does not clip the control', () => {
  // The button is absolute against the clip box, so the unpositioned scroll box between them
  // doesn't clip it, and can't hide its bottom ring from the clip box.
  document.body.innerHTML = `
    <div class="clip" style="position: relative; overflow: hidden; width: 200px; height: 100px">
      <div class="inner" style="overflow: hidden; height: 40px">
        <button class="ctrl" style="position: absolute; top: 90px; left: 20px; box-sizing: border-box; width: 20px; height: 8px; padding: 0; border: 0; outline: 2px solid; outline-offset: 2px"></button>
      </div>
    </div>`;
  expect(clippedRings()).toContainEqual(expect.stringMatching(/^button\.ctrl in div\.clip: .*\bbottom\b/));
});
