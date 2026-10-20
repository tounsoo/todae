import { useLayoutEffect, useState, type RefObject } from 'react';
import { firstTabbable } from '../overlay/tabbables.js';

/** The direction a scroll area scrolls in. */
export type ScrollAxis = 'block' | 'inline' | 'both';

// The attributes the tab-stop read depends on.
const TAB_ATTRIBUTES = [
  'class',
  'style',
  'hidden',
  'inert',
  'open',
  'disabled',
  'tabindex',
  'href',
  'type',
  'controls',
  'contenteditable',
  'aria-hidden',
];

function overflows(el: HTMLElement, axis: ScrollAxis): boolean {
  const block = el.scrollHeight > el.clientHeight;
  const inline = el.scrollWidth > el.clientWidth;
  return axis === 'block' ? block : axis === 'inline' ? inline : block || inline;
}

/**
 * Whether a scroller takes a Tab stop, so a keyboard can scroll it: while its
 * content overflows, and, unless `focusable` is true, only when nothing inside
 * can take focus. `focusable` false never takes one. Call `setFocused` from
 * the scroller's own focus and blur, so a resize never drops focus from it.
 */
export function useScrollTabStop(
  scroller: RefObject<HTMLElement | null>,
  content: RefObject<HTMLElement | null>,
  axis: ScrollAxis,
  focusable: boolean | undefined,
): [stop: boolean, setFocused: (focused: boolean) => void] {
  const [tabStop, setTabStop] = useState(false);
  const [focused, setFocused] = useState(false);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || focusable === false) {
      setTabStop(false);
      return;
    }
    // What is inside decides first, as it stops at the first control Tab
    // reaches, before the overflow read lays the page out.
    const measure = () => setTabStop((focusable === true || !firstTabbable(el)) && overflows(el, axis));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    if (content.current) resize.observe(content.current);
    // A focusable scroller's stop turns only on overflow, which a resize shows.
    if (focusable === true) return () => resize.disconnect();
    // Controls added, removed, or shown or hidden by an attribute inside the
    // scroller, a class or a <details> open among them, without a resize.
    // Not seen: a stylesheet rule or an ancestor outside the scroller hiding
    // one, short of a resize. Measured at most once a frame, as an animation
    // can change a class or style every frame.
    let frame = 0;
    const schedule = () => {
      frame ||= requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    const mutations = new MutationObserver(schedule);
    mutations.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: TAB_ATTRIBUTES });
    return () => {
      resize.disconnect();
      mutations.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [scroller, content, axis, focusable]);

  return [tabStop || focused, setFocused];
}
