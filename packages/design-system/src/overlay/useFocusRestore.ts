import { useLayoutEffect, useRef, type RefObject } from 'react';

export function useFocusRestore(
  active: boolean,
  {
    restoreTo,
    containerRef,
  }: { restoreTo?: RefObject<HTMLElement | null>; containerRef?: RefObject<HTMLElement | null> } = {},
): void {
  const prior = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (active) {
      const current = document.activeElement;
      prior.current = current instanceof HTMLElement ? current : null;
      return;
    }
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
