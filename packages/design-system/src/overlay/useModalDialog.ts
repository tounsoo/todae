import { useCallback, useInsertionEffect, useLayoutEffect, useReducer, useRef, type FormEvent, type RefObject } from 'react';
import { dropModal } from './modalStack.js';
import { inToastHostWithin } from './tabbables.js';
import { takeCloseRequest, useLayerInside } from './useEscapeKey.js';
import { useModalLayerElement } from './useModalLayerElement.js';
import { reshowHeldInside } from './usePopoverSync.js';
import { focusWithoutScroll } from '../components/revealRing.js';

/** The close reasons a modal `<dialog>` reports by itself. */
export type ModalDialogCloseReason = 'escape' | 'form' | 'native';

// Chrome may close on Escape even though cancel was prevented. Its close
// event comes a task later, so a close shortly after a cancel is an Escape.
const CANCEL_CLOSE_WINDOW_MS = 500;

type Options = {
  dialogRef: RefObject<HTMLDialogElement | null>;
  /** The element as state, so listeners bind once it mounts. */
  node: HTMLDialogElement | null;
  /** Mounted, including the exit motion. */
  present: boolean;
  open: boolean;
  dismissOnEscape: boolean;
  onOpenChange: (open: boolean, reason: ModalDialogCloseReason) => void;
  requestClose: (reason: ModalDialogCloseReason) => void;
};

/**
 * Runs a Todae surface on a modal `<dialog>`: shows it with `showModal()`,
 * holds the browser's own closes so the owner closes it through
 * `onOpenChange` and the exit motion runs, and shows it again where the
 * person was if something closes it while the owner keeps it open.
 *
 * Call it where `showModal()` should run relative to the focus hooks. Pass
 * `closeOnFormSubmit` to the element's `onSubmit` after the consumer's own,
 * and put `closedby` on the element.
 */
export function useModalDialog({
  dialogRef,
  node,
  present,
  open,
  dismissOnEscape,
  onOpenChange,
  requestClose,
}: Options): {
  closeOnFormSubmit: (event: FormEvent<HTMLDialogElement>) => void;
  closedby: 'closerequest' | 'none';
} {
  const openRef = useRef(open);
  openRef.current = open;
  // Read from the listeners, so they bind once per element.
  const latest = useRef({ dismissOnEscape, onOpenChange, requestClose });
  latest.current = { dismissOnEscape, onOpenChange, requestClose };
  // Bumped when the element closes natively, so the effect below runs again
  // and shows it while the owner keeps it open.
  const [nativeCloses, noteNativeClose] = useReducer((n: number) => n + 1, 0);
  const lastFocus = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!open) lastFocus.current = null;
  }, [open]);

  useLayoutEffect(() => {
    // The ref, not node: the node state lands a render later, and the element
    // must be open before the initial focus runs in this commit.
    const el = dialogRef.current;
    if (!el) return;
    // Not while exiting: an element closed natively on its way out stays closed.
    if (present && open && !el.open) {
      const resume = lastFocus.current;
      el.showModal();
      // In front of the popovers already open inside it, such as a tooltip
      // held open, which go back in front of it.
      reshowHeldInside(el);
      // Rendered in place, a modal inside a hidden container makes the page
      // inert while showing nothing.
      if (process.env.NODE_ENV !== 'production' && el.checkVisibility?.() === false) {
        console.error(
          'Todae: a modal <dialog> opened inside a hidden container, so the page is inert and nothing shows. Render it outside display:none ancestors such as closed popovers, tabs or <details>.',
        );
      }
      // showModal() focuses the first focusable element; after a native close,
      // go back to where the person was instead.
      if (resume?.isConnected && el.contains(resume)) resume.focus();
    }
  }, [dialogRef, present, open, node, nativeCloses]);

  // Closes the element at the end of the exit motion, declared before
  // useModalLayerElement so it runs before the element leaves the stack.
  // close() sends focus back to the opener, also from a toast that
  // Toast.Region moved in; leaving the stack moves the toasts out, and focus
  // goes back to the toast once the page is no longer inert. An owner that
  // unmounts the element as it leaves, as BottomSheet does, has it removed
  // first; Toast.Region puts focus back then.
  const presentRef = useRef(present);
  // Updated at commit, not during render, so a render React throws away
  // can't make the cleanup below close the element. An insertion effect runs
  // before the layout cleanups of the same commit, so that cleanup reads it.
  useInsertionEffect(() => {
    presentRef.current = present;
  });
  useLayoutEffect(() => {
    const el = dialogRef.current;
    if (!present || !el) return;
    return () => {
      // Only at the end of the exit: not when the element is replaced, nor at
      // StrictMode's pretend unmount.
      if (presentRef.current || !el.open) return;
      const active = el.ownerDocument.activeElement;
      const toast = active instanceof HTMLElement && inToastHostWithin(active, el) ? active : null;
      el.close();
      if (!toast) return;
      dropModal(el);
      focusWithoutScroll(toast);
    };
  }, [dialogRef, present, node]);

  // In the stack from showModal() until close() at the end of the exit
  // motion, while the page is still inert. Toasts moved in stay usable, and
  // as their own top layer boxes they don't fade with the element.
  useModalLayerElement(node, present, true);

  const cancelledAt = useRef(-Infinity);
  useLayoutEffect(() => {
    if (!node) return;
    const el: HTMLDialogElement = node;
    // Escape is a close request. Hold it so the owner closes the element, or
    // a layer inside that Escape would reach, such as a menu or a Drilldown
    // going back, takes it. Chromium sends some close requests, depending on
    // the page's user activation, as an uncancelable cancel and closes the
    // element anyway; a layer still takes one, and onClose shows the element
    // again.
    function onCancel(event: Event) {
      cancelledAt.current = performance.now();
      event.preventDefault();
      if (takeCloseRequest(el)) return;
      if (latest.current.dismissOnEscape) latest.current.requestClose('escape');
    }
    function onClose() {
      // Something closed the element while the owner still has it open. A
      // close event that arrives after it opened again is stale.
      if (!openRef.current || el.open) return;
      const escaped = performance.now() - cancelledAt.current < CANCEL_CLOSE_WINDOW_MS;
      cancelledAt.current = -Infinity;
      noteNativeClose();
      // An Escape the browser forced through was already asked for by the
      // cancel, or turned off by dismissOnEscape. Either way, no second report.
      if (escaped) return;
      latest.current.onOpenChange(false, 'native');
    }
    function onFocusIn(event: FocusEvent) {
      // Only this element's own controls, not those of a modal written inside
      // it, nor a toast that Toast.Region moved in.
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('dialog') === el && !inToastHostWithin(target, el)) {
        lastFocus.current = target;
      }
    }
    el.addEventListener('cancel', onCancel);
    el.addEventListener('close', onClose);
    el.addEventListener('focusin', onFocusIn);
    return () => {
      el.removeEventListener('cancel', onCancel);
      el.removeEventListener('close', onClose);
      el.removeEventListener('focusin', onFocusIn);
    };
  }, [node]);

  const closeOnFormSubmit = useCallback(
    (event: FormEvent<HTMLDialogElement>) => {
      // A form inside that already prevented its submit keeps the element open, as natively.
      if (event.defaultPrevented) return;
      const native = event.nativeEvent as SubmitEvent;
      const form = event.target as HTMLFormElement;
      const submitter = native.submitter as HTMLButtonElement | HTMLInputElement | null;
      const method = submitter?.getAttribute('formmethod') ?? form.getAttribute('method') ?? '';
      // Natively the form closes its own nearest <dialog>, so a form portaled
      // out of this element (still inside it in the React tree) is not ours.
      if (method.toLowerCase() !== 'dialog' || form.closest('dialog') !== dialogRef.current) return;
      // Close through onOpenChange instead of letting the browser close the
      // element: the owner stays in control of `open`, and the exit motion runs.
      event.preventDefault();
      const dialog = dialogRef.current;
      // Natively a submit without a submitter leaves returnValue as it was.
      if (dialog && submitter) dialog.returnValue = submitter.value;
      latest.current.requestClose('form');
    },
    [dialogRef],
  );
  // A layer inside takes close requests even with dismissOnEscape off.
  const layerInside = useLayerInside(node);
  const closedby = dismissOnEscape || layerInside ? 'closerequest' : 'none';
  return { closeOnFormSubmit, closedby };
}
