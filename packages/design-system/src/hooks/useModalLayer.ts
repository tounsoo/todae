import { useLayoutEffect, type RefObject } from 'react';
import { releasePageScrollbarOnUnmount, syncPageScrollbar } from '../overlay/pageScrollbar.js';
import { useModalLayerElement } from '../overlay/useModalLayerElement.js';
import { useRefElement } from '../overlay/useRefElement.js';

/**
 * Puts a modal `<dialog>` in Todae's modal stack, the list of modals Todae
 * knows are open. Dialog and BottomSheet join it by themselves; call this for
 * a modal `<dialog>` of your own.
 *
 * The element joins once `open` is true and it is shown with `showModal()`,
 * in either order, and stays until `close()`, also after `open` turns false.
 * Toast.Region moves its toasts into the modal in front, because everything
 * outside a modal dialog is inert.
 *
 * The hook reads `ref` each time the component that calls it renders, so
 * render the `<dialog>` in that component.
 */
export function useModalLayer(ref: RefObject<HTMLDialogElement | null>, open: boolean): void {
  // Before the caller's effect, which is where showModal() runs. The element
  // state from useRefElement arrives a commit later, after that effect.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!open || !el) return;
    syncPageScrollbar(el.ownerDocument);
    return () => {
      releasePageScrollbarOnUnmount(el);
    };
  }, [open, ref]);
  useModalLayerElement(useRefElement(ref), open);
}
