import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { focusWithoutScroll } from '../internal/revealRing.js';
import { frontModal, isModal, subscribeModals } from './modalStack.js';
import { GUEST_LAYER_ATTRIBUTE } from './tabbables.js';
import { isPopoverOpen, reshowHeldInside } from './usePopoverSync.js';
import { isHTMLElement } from '../internal/dom.js';

/** Focuses `el` and says whether it took focus: an inert or hidden one does not. */
export function tryFocus(el: HTMLElement | null | undefined): boolean {
  if (!el?.isConnected) return false;
  focusWithoutScroll(el);
  return el.ownerDocument.activeElement === el;
}

/**
 * Shows the popover, then the popovers held open inside it again, such as a
 * button's tooltip: showing it puts it in front of them, and moving it hid
 * them.
 */
function show(el: HTMLElement): void {
  if (!el.isConnected || isPopoverOpen(el)) return;
  el.showPopover();
  reshowHeldInside(el);
}

function hasOpenModal(el: HTMLElement): boolean {
  return [...el.querySelectorAll('dialog[open]')].some(isModal);
}

/** Runs `change`, which may hide `el`, and puts focus back where it was inside. */
function keepingFocus(el: HTMLElement, change: () => void): void {
  const active = el.ownerDocument.activeElement;
  const focused = isHTMLElement(active) && el.contains(active) ? active : null;
  change();
  if (focused && el.isConnected) focusWithoutScroll(focused);
}

/**
 * Shows the popover again so it is last in the top layer, in front of
 * anything shown since. Focus inside comes back to where it was.
 */
function raise(el: HTMLElement): void {
  // Hiding it would hide a modal opened from a toast inside it.
  if (!el.isConnected || hasOpenModal(el)) return;
  keepingFocus(el, () => {
    if (isPopoverOpen(el)) el.hidePopover();
    show(el);
  });
}

export type ToastHostOptions = {
  /** The host's class, from the region's styles. */
  className: string;
  placement: string;
  /** Runs `change`, which moves or shows the host again, so the focus events it causes don't count as focus coming in. */
  whileMoving: (change: () => void) => void;
  /** The element focused inside the host, to focus again if the host left the document with it. */
  lastInside: RefObject<HTMLElement | null>;
  /** Runs after each move, with focus and the pointer possibly changed under the host; may return a cleanup for the next. */
  onPlace: () => (() => void) | undefined;
};

/**
 * The toast region's host: a `popover="manual"` element of Todae's own, made
 * outside React so it can move into a dialog and back without React noticing;
 * React only renders inside it. It lives inside the modal in front, or in
 * `homeRef` when none is open, and shows again on every move, which also puts
 * it in front.
 */
export function useToastHost(
  homeRef: RefObject<HTMLElement | null>,
  { className, placement, whileMoving, lastInside, onPlace }: ToastHostOptions,
): HTMLDivElement | null {
  const [host, setHost] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const home = homeRef.current;
    if (!home) return;
    const el = home.ownerDocument.createElement('div');
    el.setAttribute('popover', 'manual');
    el.className = className;
    // Marks it as not the dialog's own content when it moves into one.
    el.setAttribute(GUEST_LAYER_ATTRIBUTE, '');
    home.append(el);
    setHost(el);
    return () => {
      el.remove();
      setHost(null);
    };
  }, [homeRef, className]);

  useLayoutEffect(() => {
    if (host) host.dataset.placement = placement;
  }, [host, placement]);

  // Moving a popover hides it, so it is shown again, which also puts it in front.
  useLayoutEffect(() => {
    const home = homeRef.current;
    if (!host || !home) return;
    let observer: MutationObserver | null = null;
    let stopPlaced: (() => void) | undefined;
    const place = (reshown = false) => {
      // Not a modal opened from a toast, which sits inside the host itself.
      const target = frontModal((modal) => host.contains(modal)) ?? home;
      // Removed with focus inside, which then fell to the body.
      const lost = host.isConnected ? null : lastInside.current;
      observer?.disconnect();
      whileMoving(() => {
        keepingFocus(host, () => {
          if (host.parentNode !== target) target.append(host);
          // Where it is, it shows again only to go back in front of a modal
          // that was shown again.
          else if (reshown && target !== home && !hasOpenModal(host) && isPopoverOpen(host)) host.hidePopover();
          show(host);
        });
        // Only while focus is nowhere else, as it was left by the removal.
        const active = host.ownerDocument.activeElement;
        if (lost && host.contains(lost) && (!active || active === host.ownerDocument.body)) tryFocus(lost);
      });
      // Without the stack changing, React may take the host out of a dialog
      // it renders, such as when it sets the dialog's text, and code may take
      // the dialog out of the document with the host inside. Watching the
      // dialog and its ancestors, not their subtrees, sees both. They are
      // read again when code moves the dialog.
      if (target !== home) {
        const watch = (watcher: MutationObserver) => {
          watcher.disconnect();
          for (let node: Node | null = target; node; node = node.parentNode) watcher.observe(node, { childList: true });
        };
        observer = new MutationObserver((records, self) => {
          if (host.parentNode !== target || !host.isConnected) place();
          // Moved: a node it sits in was taken out and put back elsewhere.
          else if (records.some((record) => [...record.removedNodes].some((node) => node.contains(target)))) watch(self);
        });
        watch(observer);
      }
      stopPlaced?.();
      stopPlaced = onPlace();
    };
    place();
    const unsubscribe = subscribeModals(place);
    return () => {
      unsubscribe();
      observer?.disconnect();
      stopPlaced?.();
    };
  }, [homeRef, host, lastInside, onPlace, whileMoving]);

  return host;
}

/**
 * Raises `host` in front of overlays shown since, when a key in `openKeys`
 * (one per open toast and showing) is new: a toast that starts showing, new,
 * shown again or out of the queue.
 */
export function useRaiseOnNew(
  host: HTMLElement | null,
  openKeys: string,
  whileMoving: (change: () => void) => void,
): void {
  const raised = useRef<ReadonlySet<string>>(new Set());
  useLayoutEffect(() => {
    if (!host) return;
    const keys = openKeys ? openKeys.split('\n') : [];
    const fresh = keys.some((key) => !raised.current.has(key));
    raised.current = new Set(keys);
    if (fresh) whileMoving(() => raise(host));
  }, [host, openKeys, whileMoving]);
}
