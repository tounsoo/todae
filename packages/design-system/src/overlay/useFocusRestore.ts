import { useLayoutEffect, useRef, type RefObject } from 'react';

export function useFocusRestore(
  active: boolean,
  {
    restoreTo,
    containerRef,
  }: { restoreTo?: RefObject<HTMLElement | null>; containerRef?: RefObject<HTMLElement | null> } = {},
): void {
  const prior = useRef<HTMLElement | null>(null);
  const wasActive = useRef(false);

  useLayoutEffect(() => {
    if (active) {
      wasActive.current = true;
      const current = document.activeElement;
      prior.current = current instanceof HTMLElement ? current : null;
      return;
    }
    // Restore only when an open overlay closes, never on a closed first render.
    if (!wasActive.current) return;
    wasActive.current = false;
    const fallback = restoreTo?.current ?? prior.current;
    const container = containerRef?.current;
    queueMicrotask(() => {
      const moved = document.activeElement;
      if (
        moved instanceof HTMLElement &&
        moved !== document.body &&
        moved !== fallback &&
        (!container || !container.contains(moved))
      ) {
        return;
      }
      fallback?.focus();
    });
  }, [active, containerRef, restoreTo]);
}
