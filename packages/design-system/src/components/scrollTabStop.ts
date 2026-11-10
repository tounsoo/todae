import { useLayoutEffect, useState, type RefObject } from 'react';
import { firstTabbable, getTabOrder } from '../overlay/tabbables.js';
import { cancelLayout, queueLayout, STAGE } from '../internal/layoutBatch.js';
import { observeMutations } from '../internal/sharedMutations.js';
import { observeSize } from '../internal/sharedObservers.js';

/** The direction a scroll area scrolls in. */
export type ScrollAxis = 'block' | 'inline' | 'both';

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
    // While an ancestor hides the scroller, nothing inside is reachable, and
    // showing it again is not seen; so judge by what it holds once shown.
    const holdsControl = () =>
      el.checkVisibility?.({ visibilityProperty: true, checkVisibilityCSS: true }) === false
        ? getTabOrder(el).some((node) => !node.matches(':disabled'))
        : firstTabbable(el) !== null;
    // What is inside decides first, as it stops at the first control Tab
    // reaches, before the overflow read lays the page out.
    const judge = () => (focusable === true || !holdsControl()) && overflows(el, axis);
    const measure = () => setTabStop(judge());
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    // Every scroller's sizes and changes share one ResizeObserver and one
    // MutationObserver (sharedObservers.ts). The scroller and its content
    // resizing in one report measure once, beside every other part's reads
    // (layoutBatch.ts).
    const key = {};
    let next = false;
    const job = {
      read: () => {
        next = judge();
      },
      write: () => setTabStop(next),
    };
    const resized = () => queueLayout(key, STAGE.measure, job);
    const stops = [observeSize(el, resized)];
    if (content.current) stops.push(observeSize(content.current, resized));
    const stop = () => {
      for (const own of stops) own();
      cancelLayout(key);
    };
    // A focusable scroller's stop turns only on overflow, which a resize shows.
    if (focusable === true) return stop;
    // Controls added, removed, or shown or hidden by any attribute inside the
    // scroller, such as a class, a data attribute a stylesheet keys on, or a
    // <details> open, without a resize.
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
    const mutations = observeMutations(el, { childList: true, subtree: true, attributes: true }, schedule);
    return () => {
      stop();
      mutations.stop();
      cancelAnimationFrame(frame);
    };
  }, [scroller, content, axis, focusable]);

  return [tabStop || focused, setFocused];
}
