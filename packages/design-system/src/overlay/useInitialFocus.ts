import { useLayoutEffect, type RefObject } from 'react';
import { getTabbables } from './tabbables';

/** Where an overlay puts focus when it opens: initialFocusRef, else its first tabbable, else itself. */
export function initialFocusTarget(
  container: HTMLElement,
  initialFocusRef?: RefObject<HTMLElement | null>,
): HTMLElement {
  return initialFocusRef?.current ?? getTabbables(container)[0] ?? container;
}

export function useInitialFocus(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  initialFocusRef?: RefObject<HTMLElement | null>,
): void {
  useLayoutEffect(() => {
    if (!active) return;
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
