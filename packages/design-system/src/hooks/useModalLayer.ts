import { useLayoutEffect, useState, type RefObject } from 'react';
import { dropModal, isModal, pushModal } from '../overlay/modalStack';

/**
 * Puts a modal `<dialog>` in Todae's modal stack, the list of modals Todae
 * knows are open. Dialog and BottomSheet join it by themselves; call this for
 * a modal `<dialog>` of your own.
 *
 * The element counts while `open` is true and it is shown with `showModal()`,
 * in either order, until `close()` or `open` turning false. Toast.Region moves
 * its toasts into the modal in front, because everything outside a modal
 * dialog is inert. The element can attach later or be replaced while `open`
 * stays true.
 */
export function useModalLayer(ref: RefObject<HTMLDialogElement | null>, open: boolean): void {
  const [node, setNode] = useState<HTMLDialogElement | null>(null);
  // Every commit on purpose: a ref has no change signal, and the element can
  // attach later or be replaced. The updater bails out when it is the same.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const current = ref.current;
    setNode((prev) => (prev === current ? prev : current));
  });

  useLayoutEffect(() => {
    const el = node;
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
  }, [open, node]);
}
