import { useLayoutEffect, useRef, type RefObject } from 'react';

export function useFocusRestore(
  active: boolean,
  {
    restoreTo,
    containerRef,
    nativeReturn = false,
  }: {
    restoreTo?: RefObject<HTMLElement | null>;
    containerRef?: RefObject<HTMLElement | null>;
    /**
     * The overlay closes a modal <dialog>, which returns focus to the opener by
     * itself. That return still gives way to restoreTo; focus the person put
     * on the opener in any other overlay is kept.
     */
    nativeReturn?: boolean;
  } = {},
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
        !(nativeReturn && moved === prior.current) &&
        (!container || !container.contains(moved))
      ) {
        return;
      }
      fallback?.focus();
    });
  }, [active, containerRef, restoreTo, nativeReturn]);
}
