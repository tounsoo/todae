import { useLayoutEffect } from 'react';
import { dropModal, isModal, pushModal } from './modalStack';

/** useModalLayer for a caller that already holds the element. */
export function useModalLayerElement(el: HTMLDialogElement | null, open: boolean): void {
  useLayoutEffect(() => {
    if (!open || !el) return;
    const sync = () => {
      if (el.open && isModal(el)) pushModal(el);
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
  }, [open, el]);
}
