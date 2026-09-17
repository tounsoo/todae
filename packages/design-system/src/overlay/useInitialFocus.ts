import { useLayoutEffect, type RefObject } from 'react';
import { getTabbables } from './tabbables';

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
      const target = initialFocusRef?.current ?? getTabbables(container)[0] ?? container;
      target.focus();
    }
    go();
    return () => cancelAnimationFrame(frame);
  }, [active, containerRef, initialFocusRef]);
}
