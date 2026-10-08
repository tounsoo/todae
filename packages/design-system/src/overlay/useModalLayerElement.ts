import { useLayoutEffect, useRef } from 'react';
import { dropModal, isModal, pushModal } from './modalStack';

/**
 * useModalLayer for a caller that already holds the element. `shownModal`
 * says the caller opens it with showModal() itself, so it counts whenever it
 * is open, also in an engine without :modal.
 */
export function useModalLayerElement(el: HTMLDialogElement | null, open: boolean, shownModal = false): void {
  const latest = useRef({ open, shownModal });
  const syncRef = useRef<() => void>(() => undefined);
  useLayoutEffect(() => {
    if (!el) return;
    // Joins while `open` is true and it is shown modally. Once in, it stays
    // until close(), also after `open` turns false: until then the page is
    // still inert, so the toasts must stay inside.
    const sync = () => {
      if (!el.open || !(latest.current.shownModal || isModal(el))) dropModal(el);
      else if (latest.current.open) pushModal(el);
    };
    syncRef.current = sync;
    sync();
    // showModal() and close() set and remove the open attribute, so this sees
    // the element open and close however it happens.
    const observer = new MutationObserver(sync);
    observer.observe(el, { attributes: true, attributeFilter: ['open'] });
    return () => {
      observer.disconnect();
      syncRef.current = () => undefined;
      dropModal(el);
    };
  }, [el]);
  useLayoutEffect(() => {
    latest.current = { open, shownModal };
    syncRef.current();
  }, [open, shownModal]);
}
