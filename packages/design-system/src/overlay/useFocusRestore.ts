import { useLayoutEffect, useRef, type RefObject } from 'react';
import { focusPath, isHTMLElement, topDocument } from '../internal/dom.js';

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
  const openedIn = useRef<Document | null>(null);

  // Follow a container that reaches another document after it opened, such as
  // a portal whose target is set later.
  useLayoutEffect(() => {
    const doc = containerRef?.current?.ownerDocument;
    if (wasActive.current && doc) openedIn.current = doc;
  });

  useLayoutEffect(() => {
    if (active) {
      // Only when it opens: a new restoreTo while it is open runs this again, with focus already inside.
      if (wasActive.current) return;
      wasActive.current = true;
      const doc = containerRef?.current?.ownerDocument ?? restoreTo?.current?.ownerDocument ?? document;
      openedIn.current = doc;
      // Focus may sit in the page around an iframe the overlay renders into. A
      // frame showing its own body holds focus as the frame.
      const path = focusPath(doc);
      let current = path.at(-1);
      if (path.length > 1 && current === current?.ownerDocument.body) current = path.at(-2);
      prior.current = isHTMLElement(current) ? current : null;
      return;
    }
    // Restore only when an open overlay closes, never on a closed first render.
    if (!wasActive.current) return;
    wasActive.current = false;
    const fallback = restoreTo?.current ?? prior.current;
    const container = containerRef?.current;
    // The container may already be gone, so fall back to the document it opened in.
    const doc = container?.ownerDocument ?? openedIn.current ?? restoreTo?.current?.ownerDocument ?? document;
    queueMicrotask(() => {
      // Read from the top document, so focus that left an iframe for the page around it counts as moved.
      // An overlay in a popup window reads the window focus is in, which may be the opener's.
      const top = topDocument(doc);
      const opener = fallback && topDocument(fallback.ownerDocument);
      const path = focusPath(opener && opener !== top && !top.hasFocus() && opener.hasFocus() ? opener : doc);
      const moved = path.at(-1) ?? null;
      // Focus dropped to the body of the overlay's document or of the page. A
      // page iframe's own body is the person in that frame.
      const dropped = moved === doc.body || (path.length === 1 && moved === moved?.ownerDocument.body);
      if (
        isHTMLElement(moved) &&
        !dropped &&
        moved !== fallback &&
        !(nativeReturn && moved === prior.current) &&
        (!container || !path.some((el) => container.contains(el)))
      ) {
        return;
      }
      fallback?.focus();
    });
  }, [active, containerRef, restoreTo, nativeReturn]);
}
