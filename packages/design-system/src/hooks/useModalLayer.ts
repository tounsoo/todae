import type { RefObject } from 'react';
import { useModalLayerElement } from '../overlay/useModalLayerElement';
import { useRefElement } from '../overlay/useRefElement';

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
  useModalLayerElement(useRefElement(ref), open);
}
