import { isExitTransition, transitionMs } from './useOverlayPresence.js';

/**
 * Calls `onExited` once `node`'s exit transition of `propertyName` ends or
 * is cut short, at once when it has none, or as its computed duration runs
 * out if no end event comes. For an element that stays mounted, such as a popover, whose
 * closed state is already applied. Returns a cancel.
 */
export function whenExited(node: HTMLElement | null, propertyName: string, onExited: () => void): () => void {
  const ms = node ? transitionMs(node, propertyName) : null;
  if (!node || !ms) {
    onExited();
    return () => undefined;
  }
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    cancel();
    onExited();
  };
  const onEnd = (event: Event) => {
    if (!isExitTransition(event, propertyName)) return;
    // A cancel ends the wait only when no exit is left to run: closing over
    // an open fade cancels that fade and starts the exit.
    if (event.type === 'transitioncancel' && transitionMs(node, propertyName)) return;
    finish();
  };
  const id = window.setTimeout(finish, ms);
  const cancel = () => {
    done = true;
    window.clearTimeout(id);
    node.removeEventListener('transitionend', onEnd);
    node.removeEventListener('transitioncancel', onEnd);
  };
  // One cut short, as when a popover loses its anchor and goes at once,
  // ends too.
  node.addEventListener('transitionend', onEnd);
  node.addEventListener('transitioncancel', onEnd);
  return cancel;
}
