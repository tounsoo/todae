import { afterEach, expect, it } from 'vitest';
import { clippedRings } from './clippedRings';

afterEach(() => {
  document.body.replaceChildren();
});

// A clip box around a scroll box around a tall focusable list, like the date-time picker's
// popover around its time list. The list's ring is 2px wide with a 2px offset, so it needs 4px.
function mount({ scrollerPadding, scrollTop }: { scrollerPadding: number; scrollTop: number }) {
  document.body.innerHTML = `
    <div class="clip" style="overflow: hidden; padding: 2px; width: 200px">
      <div class="scroller" style="overflow-y: auto; height: 40px; padding: ${scrollerPadding}px">
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
  expect(clippedRings()).toContainEqual(expect.stringMatching(/^div\.list in div\.scroller: top\b/));
});
