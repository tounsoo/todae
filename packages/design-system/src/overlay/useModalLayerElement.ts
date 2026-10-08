import { useLayoutEffect } from 'react';
import { dropModal, isModal, pushModal } from './modalStack';

/**
 * useModalLayer for a caller that already holds the element. `shownModal`
 * says the caller opens it with showModal() itself, so it counts whenever it
 * is open, also in an engine without :modal.
 */
export function useModalLayerElement(el: HTMLDialogElement | null, open: boolean, shownModal = false): void {
  useLayoutEffect(() => {
    if (!open || !el) return;
    const sync = () => {
      if (el.open && (shownModal || isModal(el))) pushModal(el);
      else dropModal(el);
    };
    sync();
    // showModal() and close() set and remove the open attribute, so this sees
    // the element open and close however it happens.
    const observer = new MutationObserver(sync);
    observer.observe(el, { attributes: true, attributeFilter: ['open'] });
    return () => {
      observer.disconnect();
      dropModal(el);
    };
  }, [open, el, shownModal]);
}
