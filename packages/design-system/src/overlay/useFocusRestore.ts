import { useLayoutEffect, useRef, type RefObject } from 'react';
import { isHTMLElement } from '../internal/dom.js';

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
      // Only when it opens: a new restoreTo while it is open runs this again, with focus already inside.
      if (wasActive.current) return;
      wasActive.current = true;
      const current = (containerRef?.current?.ownerDocument ?? restoreTo?.current?.ownerDocument ?? document).activeElement;
      prior.current = isHTMLElement(current) ? current : null;
      return;
    }
    // Restore only when an open overlay closes, never on a closed first render.
    if (!wasActive.current) return;
    wasActive.current = false;
    const fallback = restoreTo?.current ?? prior.current;
    const container = containerRef?.current;
    const doc = container?.ownerDocument ?? restoreTo?.current?.ownerDocument ?? document;
    queueMicrotask(() => {
      const moved = doc.activeElement;
      if (
        isHTMLElement(moved) &&
        moved !== doc.body &&
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
