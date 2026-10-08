import { useLayoutEffect, type RefObject } from 'react';
import { dropModal, isModal, pushModal } from '../overlay/modalStack';

/**
 * Puts a modal `<dialog>` in Todae's modal stack, the list of modals Todae
 * knows are open. Dialog and BottomSheet join it by themselves; call this for
 * a modal `<dialog>` of your own.
 *
 * The element counts while `open` is true and it is shown with `showModal()`,
 * in either order, until `close()` or `open` turning false. Toast.Region moves
 * its toasts into the modal in front, because everything outside a modal
 * dialog is inert. The same `<dialog>` element must be in the document while
 * `open` is true.
 */
export function useModalLayer(ref: RefObject<HTMLDialogElement | null>, open: boolean): void {
  useLayoutEffect(() => {
    const el = ref.current;
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
  }, [open, ref]);
}
