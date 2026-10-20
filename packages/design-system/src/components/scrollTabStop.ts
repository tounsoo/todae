import { useLayoutEffect, useState, type RefObject } from 'react';
import { isTabbable, TABBABLE_CANDIDATES } from '../overlay/tabbables.js';

/** The direction a scroll area scrolls in. */
export type ScrollAxis = 'block' | 'inline' | 'both';

function hasTabbable(el: HTMLElement): boolean {
  return [...el.querySelectorAll<HTMLElement>(TABBABLE_CANDIDATES)].some((node) => isTabbable(node, el));
}

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
    const measure = () => setTabStop(overflows(el, axis) && (focusable === true || !hasTabbable(el)));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    if (content.current) resize.observe(content.current);
    const mutations = new MutationObserver(measure);
    mutations.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'href', 'tabindex'] });
    return () => {
      resize.disconnect();
      mutations.disconnect();
    };
  }, [scroller, content, axis, focusable]);

  return [tabStop || focused, setFocused];
}
