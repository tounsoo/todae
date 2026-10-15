import { useEffect, useRef, type RefObject } from 'react';
import { frontModal, isModal } from './modalStack.js';

type Entry = { handle: () => void; enabled: () => boolean; element: () => Element | null };

const stack: Entry[] = [];
let listening = false;

/**
 * The modal <dialog> in front: the one the key was pressed in, or, when focus
 * has fallen back to the body, the one Todae opened last. Failing that, any
 * open modal counts.
 */
function modalsInFront(target: EventTarget | null): Element[] {
  let node = target instanceof Element ? target.closest('dialog[open]') : null;
  while (node && !isModal(node)) node = node.parentElement?.closest('dialog[open]') ?? null;
  if (node) return [node];
  const front = frontModal();
  if (front) return [front];
  return [...document.querySelectorAll('dialog[open]')].filter(isModal);
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  // A layer outside the modal dialog the key was pressed in sits behind it
  // and is inert. Escape belongs to the dialog's own close request.
  const modals = modalsInFront(event.target);
  const inFront = (entry: Entry) => {
    const el = entry.element();
    return modals.length === 0 || !el || modals.some((modal) => modal.contains(el));
  };
  // A disabled layer keeps its place but lets Escape fall through to the next enabled one.
  const top = [...stack].reverse().find((entry) => entry.enabled() && inFront(entry));
  if (!top) return;
  event.preventDefault();
  top.handle();
}

function push(entry: Entry): () => void {
  stack.push(entry);
  if (!listening) {
    document.addEventListener('keydown', onKeyDown);
    listening = true;
  }
  return () => {
    const index = stack.indexOf(entry);
    if (index !== -1) stack.splice(index, 1);
    if (stack.length === 0 && listening) {
      document.removeEventListener('keydown', onKeyDown);
      listening = false;
    }
  };
}

/**
 * Calls `handler` on Escape while `active && enabled`. Overlays stack: only the most recently
 * activated one handles the key, so Escape in a popover inside a sheet closes the popover first.
 * Order is activation order. Layers that activate in the same commit register child-first, so
 * open nested overlays one after another rather than together. Pass `elementRef` so a layer left
 * behind a modal `<dialog>` opened later skips the key, and the dialog gets it.
 */
export function useEscapeKey(
  active: boolean,
  enabled: boolean,
  handler: () => void,
  elementRef?: RefObject<Element | null>,
): void {
  const handlerRef = useRef(handler);
  const enabledRef = useRef(enabled);
  handlerRef.current = handler;
  enabledRef.current = enabled;
  // Keyed on `active` only: toggling `enabled` must not move the layer above overlays opened later.
  useEffect(() => {
    if (!active) return;
    return push({
      handle: () => handlerRef.current(),
      enabled: () => enabledRef.current,
      element: () => elementRef?.current ?? null,
    });
  }, [active, elementRef]);
}
