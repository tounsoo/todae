import { useLayoutEffect, type RefObject } from 'react';

/**
 * Keeps a `fit` popover on the fit try it was placed by, once placed, so it
 * keeps its scroll. `--todae-popover-fit` stretches a popover too tall for
 * either side of its anchor to the room on one side, where it scrolls. Each
 * time its style changes, as when a scroll arrow inside shows and its
 * scroll-padding grows, Chromium and WebKit place it again from its first
 * try, which lays it out whole, as tall as its content and with nothing to
 * scroll, and its scroll falls back to the top before the fit try takes it
 * again. A person's scroll down it showed the arrow at its start, and the
 * list jumped back up, so its end was out of reach. Pinned with
 * `data-todae-fit`, `above` or `below`, it has no other try to lay out.
 *
 * It places it again, unpinned, when what it was placed for changes: the
 * window resizes, a page around it scrolls and moves its anchor, or its
 * content changes size, as when a calendar shows its years. A scroll inside
 * it moves nothing. Unpinned, it falls back to the top, as it moves anyway.
 * A browser without `position-area`, or a popover whole on one side, never
 * takes the fit try and is never pinned.
 */
export function usePopoverFit(
  popoverRef: RefObject<HTMLElement | null>,
  anchorRef: RefObject<Element | null>,
  open: boolean,
): void {
  useLayoutEffect(() => {
    const el = popoverRef.current;
    if (!open || !el) return;
    const win = el.ownerDocument.defaultView;
    if (!win) return;
    let frame = 0;
    const pin = () => {
      frame = 0;
      const anchor = anchorRef.current;
      if (!anchor || el.hasAttribute('data-todae-fit')) return;
      // Only the fit try stretches it.
      if (win.getComputedStyle(el).alignSelf !== 'stretch') return;
      const p = el.getBoundingClientRect();
      const a = anchor.getBoundingClientRect();
      el.setAttribute('data-todae-fit', p.top + p.bottom < a.top + a.bottom ? 'above' : 'below');
    };
    const later = () => {
      if (!frame) frame = win.requestAnimationFrame(pin);
    };
    const replace = () => {
      el.removeAttribute('data-todae-fit');
      later();
    };
    // Its first frame, and again once its opening transition ends, after
    // which WebKit places it again.
    later();
    const ended = (event: TransitionEvent) => {
      if (event.target === el) later();
    };
    const scrolled = (event: Event) => {
      if (!(event.target instanceof Node) || !el.contains(event.target)) replace();
    };
    // Sizes as first seen are where it was placed; only a change places it again.
    const sizes = new WeakMap<Element, number>();
    const Observer = win.ResizeObserver;
    const resized = Observer ? new Observer((entries) => {
      let changed = false;
      for (const entry of entries) {
        const height = entry.contentRect.height;
        const was = sizes.get(entry.target);
        sizes.set(entry.target, height);
        if (was !== undefined && Math.abs(was - height) > 0.5) changed = true;
      }
      if (changed) replace();
    }) : null;
    for (const child of el.children) resized?.observe(child);
    // A child put in or taken out while it is open changes its size too.
    const Mutations = win.MutationObserver;
    const changed = Mutations
      ? new Mutations((records) => {
          for (const record of records) {
            for (const node of record.addedNodes) {
              if (node instanceof win.Element) resized?.observe(node);
            }
          }
          replace();
        })
      : null;
    changed?.observe(el, { childList: true });
    el.addEventListener('transitionend', ended);
    win.addEventListener('resize', replace);
    el.ownerDocument.addEventListener('scroll', scrolled, { capture: true, passive: true });
    return () => {
      if (frame) win.cancelAnimationFrame(frame);
      resized?.disconnect();
      changed?.disconnect();
      el.removeEventListener('transitionend', ended);
      win.removeEventListener('resize', replace);
      el.ownerDocument.removeEventListener('scroll', scrolled, { capture: true });
      el.removeAttribute('data-todae-fit');
    };
  }, [anchorRef, open, popoverRef]);
}
