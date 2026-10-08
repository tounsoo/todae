import { useLayoutEffect, useRef } from 'react';
import { dropModal, isModal, pushModal } from './modalStack';
import { inToastHostWithin } from './tabbables';
import { initialFocusTarget } from './useInitialFocus';

/**
 * useModalLayer for a caller that already holds the element. `shownModal`
 * says the caller opens it with showModal() itself, so it counts whenever it
 * is open, also in an engine without :modal.
 */
export function useModalLayerElement(el: HTMLDialogElement | null, open: boolean, shownModal = false): void {
  const latest = useRef({ open, shownModal });
  const syncRef = useRef<(reshown?: boolean) => void>(() => undefined);
  // First, so the effects below read this commit's values.
  useLayoutEffect(() => {
    latest.current = { open, shownModal };
  });
  useLayoutEffect(() => {
    if (!el) return;
    // Joins while `open` is true and it is shown modally. Once in, it stays
    // until close(), also after `open` turns false: until then the page is
    // still inert, so the toasts must stay inside.
    const sync = (reshown = false) => {
      if (!el.open || !(latest.current.shownModal || isModal(el))) dropModal(el);
      else if (latest.current.open) pushModal(el, reshown);
    };
    syncRef.current = sync;
    sync();
    // showModal() and close() set and remove the open attribute, so this sees
    // the element open and close however it happens.
    const observer = new MutationObserver((records) => {
      // Shown in this task. showModal() focuses the first focusable element
      // inside, which is a toast when the toasts were still inside and the
      // element has nothing focusable of its own before them.
      if (el.open && records.some((record) => record.oldValue === null)) {
        const active = el.ownerDocument.activeElement;
        if (active instanceof HTMLElement && inToastHostWithin(active, el)) initialFocusTarget(el).focus();
      }
      sync(true);
    });
    observer.observe(el, { attributes: true, attributeFilter: ['open'], attributeOldValue: true });
    return () => {
      observer.disconnect();
      syncRef.current = () => undefined;
      dropModal(el);
    };
  }, [el]);
  useLayoutEffect(() => {
    syncRef.current();
  }, [open, shownModal]);
}
