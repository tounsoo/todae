import { useLayoutEffect, type RefObject } from 'react';
import { firstTabbable } from './tabbables.js';

const isClosePart = (el: HTMLElement) => el.hasAttribute('data-todae-close');

/**
 * Where an overlay puts focus when it opens: initialFocusRef, else, in an
 * alertdialog, its first tabbable close part, the least destructive choice,
 * else its first tabbable, else itself.
 */
export function initialFocusTarget(
  container: HTMLElement,
  initialFocusRef?: RefObject<HTMLElement | null>,
): HTMLElement {
  return (
    initialFocusRef?.current ??
    (container.getAttribute('role') === 'alertdialog' ? firstTabbable(container, isClosePart) : null) ??
    firstTabbable(container) ??
    container
  );
}

export function useInitialFocus(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  initialFocusRef?: RefObject<HTMLElement | null>,
): void {
  useLayoutEffect(() => {
    if (!active) return;
    // A usePopover caller can mount its Popover frames after open, behind
    // Suspense or an effect, so a missing container is retried.
    let tries = 0;
    let frame = 0;
    function go() {
      const container = containerRef.current;
      if (!container) {
        if (tries++ < 8) frame = requestAnimationFrame(go);
        return;
      }
      initialFocusTarget(container, initialFocusRef).focus();
    }
    go();
    return () => cancelAnimationFrame(frame);
  }, [active, containerRef, initialFocusRef]);
}
