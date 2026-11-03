import { isExitTransition, transitionMs } from './useOverlayPresence.js';

/**
 * Calls `onExited` once `node`'s exit transition of `propertyName` ends, at
 * once when it has none, or as its computed duration runs out if no end
 * event comes. For an element that stays mounted, such as a popover, whose
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
    if (isExitTransition(event, propertyName)) finish();
  };
  const id = window.setTimeout(finish, ms);
  const cancel = () => {
    done = true;
    window.clearTimeout(id);
    node.removeEventListener('transitionend', onEnd);
  };
  node.addEventListener('transitionend', onEnd);
  return cancel;
}
