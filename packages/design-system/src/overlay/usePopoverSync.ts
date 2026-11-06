import { useLayoutEffect, useRef, type RefObject } from 'react';
import { focusWithoutScroll } from '../internal/revealRing.js';
import { whenExited } from './whenExited.js';

export function isPopoverOpen(el: HTMLElement): boolean {
  return el.matches(':popover-open') || el.hasAttribute('data-popover-open');
}

// The popovers React holds open, so a layer shown again can show them again
// in front of it.
const held = /* @__PURE__ */ new WeakSet<HTMLElement>();

// The popovers this hook made inert for their exit, so an inert the owner
// set stays.
const madeInert = /* @__PURE__ */ new WeakSet<HTMLElement>();

// The exit each closing popover waits on, so one whose anchor went away as it closed can end it at once.
const exitsUnderWay = /* @__PURE__ */ new WeakMap<HTMLElement, () => void>();

/** Ends `el`'s exit fade now, if one runs: its anchor went away as it closed. */
export function endExitNow(el: HTMLElement): void {
  exitsUnderWay.get(el)?.();
}

/**
 * Ends the fade of every popover still fading inside `el`, deepest first, as
 * `el` hides. Each fades on its own clock, as a submenu does beside its menu,
 * so without this a fade could outlast the popover it sits in. One its owner
 * keeps open is left alone.
 */
function endExitsInside(el: HTMLElement): void {
  for (const inner of el.querySelectorAll<HTMLElement>('[popover]')) endExitNow(inner);
}

function setExitInert(el: HTMLElement, on: boolean): void {
  if (on) {
    if (el.inert) return;
    el.inert = true;
    madeInert.add(el);
  } else if (madeInert.delete(el)) {
    el.inert = false;
  }
}

/** A popover that moves in and out, as Popover and Menu do. */
export type PopoverPresence = {
  /** Runs once a close finishes: its exit fade ended, or there was none. */
  onExited?: () => void;
};

/**
 * Shows and hides `contentRef`'s popover as `open` changes. With `presence`
 * it moves in and out the way Dialog and Drawer do: `data-entered` lands two
 * frames after it shows, so its closed style is drawn first and it
 * transitions in, and `data-todae-entering` marks those frames, so a tooltip
 * inside waits for the growth that is about to start, and as it closes it takes `data-todae-exiting` and stays
 * shown, inert, until its opacity fade ends, then hides. A popover still
 * fading inside it ends its fade whenever it hides, so it never outlasts the
 * popover it sits in. Opening again inside the fade turns it back where it is.
 * Unmounting drops the wait.
 *
 * Once its fade in ends it takes `data-todae-settled`, which drops its
 * transition until it closes. Safari re-resolves an open popover's position
 * fallbacks right after its opening transition ends and starts that
 * transition again, now and then from halfway, so the popover dipped and
 * faded in a second time. With no transition left, there is nothing to run
 * again.
 *
 * Future: this stands in for the newer CSS, where a popover opens from
 * `@starting-style` and stays drawn as it closes with `display` and `overlay`
 * transitions under `transition-behavior: allow-discrete`. Safari has no
 * `overlay`, so it hid a closing popover at once, and it ran the opening
 * transition again as it re-resolved the popover's position fallbacks. Move
 * back once Safari supports `overlay`:
 * https://developer.mozilla.org/en-US/docs/Web/CSS/overlay
 */
export function usePopoverSync(
  contentRef: RefObject<HTMLElement | null>,
  open: boolean,
  presence?: PopoverPresence,
): void {
  const animated = presence !== undefined;
  const onExitedRef = useRef(presence?.onExited);
  onExitedRef.current = presence?.onExited;
  const wasOpen = useRef(false);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const closing = wasOpen.current && !open;
    wasOpen.current = open;
    if (!open) {
      if (!isPopoverOpen(el)) {
        // One that was never open has nothing fading inside it to end.
        if (closing) {
          endExitsInside(el);
          onExitedRef.current?.();
        }
        return;
      }
      // One that closes inside its first frames was never drawn: nothing
      // to fade.
      if (!animated || !el.hasAttribute('data-entered')) {
        endExitsInside(el);
        el.hidePopover();
        if (animated && closing) onExitedRef.current?.();
        return;
      }
      el.removeAttribute('data-entered');
      el.removeAttribute('data-todae-settled');
      el.setAttribute('data-todae-exiting', '');
      // Still shown while it fades, but out of reach: no press, focus or
      // screen reader lands in it.
      setExitInert(el, true);
      let ended = false;
      const end = () => {
        if (ended) return;
        ended = true;
        exitsUnderWay.delete(el);
        endExitsInside(el);
        el.removeAttribute('data-todae-exiting');
        setExitInert(el, false);
        if (isPopoverOpen(el)) el.hidePopover();
        onExitedRef.current?.();
      };
      const stopWaiting = whenExited(el, 'opacity', end);
      if (!ended) {
        exitsUnderWay.set(el, () => {
          stopWaiting();
          end();
        });
      }
      return () => {
        exitsUnderWay.delete(el);
        stopWaiting();
      };
    }
    const returning = el.hasAttribute('data-todae-exiting');
    if (returning) {
      el.removeAttribute('data-todae-exiting');
      // A close that lost its anchor turns back with its fade.
      el.removeAttribute('data-todae-unanchored');
      setExitInert(el, false);
    }
    if (!isPopoverOpen(el)) {
      // A close that lost its anchor went at once; this open fades in again.
      el.removeAttribute('data-todae-unanchored');
      el.removeAttribute('data-entered');
      el.removeAttribute('data-todae-settled');
      el.showPopover();
    }
    held.add(el);
    let raf = 0;
    let stopSettling = () => {};
    // Its fade in ends, or there was none: it holds still until it closes.
    const settle = () => {
      stopSettling = whenExited(el, 'opacity', () => {
        if (el.hasAttribute('data-entered')) el.setAttribute('data-todae-settled', '');
      });
    };
    if (animated && !el.hasAttribute('data-entered')) {
      // Already drawn inside its fade: turn back from where it is.
      if (returning) {
        el.setAttribute('data-entered', '');
        settle();
      } else {
        el.setAttribute('data-todae-entering', '');
        raf = requestAnimationFrame(() => {
          raf = requestAnimationFrame(() => {
            raf = 0;
            el.removeAttribute('data-todae-entering');
            el.setAttribute('data-entered', '');
            settle();
          });
        });
      }
    }
    return () => {
      if (raf) {
        cancelAnimationFrame(raf);
        el.removeAttribute('data-todae-entering');
      }
      stopSettling();
      held.delete(el);
    };
  }, [animated, contentRef, open]);
}

/**
 * Shows every popover React holds open inside `layer` again, in DOM order,
 * so each is back in front of `layer` after it was shown again or moved.
 * Showing a layer again puts it in front of the popovers open inside it,
 * which then can't use their anchor; moving a popover hides it without a
 * toggle event. Focus inside one stays where it was.
 */
export function reshowHeldInside(layer: HTMLElement): void {
  const doc = layer.ownerDocument;
  const active = doc.activeElement;
  for (const el of layer.querySelectorAll<HTMLElement>('[popover]')) {
    if (!held.has(el) || !el.isConnected) continue;
    if (isPopoverOpen(el)) el.hidePopover();
    el.showPopover();
  }
  if (active instanceof HTMLElement && active !== doc.activeElement && layer.contains(active)) {
    focusWithoutScroll(active);
  }
}
