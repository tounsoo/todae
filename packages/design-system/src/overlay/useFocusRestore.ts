import { useLayoutEffect, useRef, type RefObject } from 'react';
import { isHTMLElement } from '../internal/dom.js';

/**
 * The element with focus in the window tree `doc` is in, looked up from its
 * top document, so focus that left an iframe for the page around it counts as
 * moved. Inside a frame focus is in, it is that frame's active element.
 */
function focusedElement(doc: Document): Element | null {
  let top = doc;
  for (let host = top.defaultView?.frameElement; host; host = top.defaultView?.frameElement) top = host.ownerDocument;
  let el = top.activeElement;
  while (el && (el.localName === 'iframe' || el.localName === 'frame')) {
    // A frame showing no HTML element with focus, such as an SVG document, counts as the frame.
    const inner = (el as HTMLIFrameElement).contentDocument?.activeElement;
    if (!isHTMLElement(inner)) break;
    el = inner;
  }
  return el;
}

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

  useLayoutEffect(() => {
    if (active) {
      // Only when it opens: a new restoreTo while it is open runs this again, with focus already inside.
      if (wasActive.current) return;
      wasActive.current = true;
      const doc = containerRef?.current?.ownerDocument ?? restoreTo?.current?.ownerDocument ?? document;
      openedIn.current = doc;
      const current = doc.activeElement;
      prior.current = isHTMLElement(current) ? current : null;
      return;
    }
    // Restore only when an open overlay closes, never on a closed first render.
    if (!wasActive.current) return;
    wasActive.current = false;
    const fallback = restoreTo?.current ?? prior.current;
    const container = containerRef?.current;
    // The container may already be gone, so fall back to the document it opened in.
    const doc = container?.ownerDocument ?? restoreTo?.current?.ownerDocument ?? openedIn.current ?? document;
    queueMicrotask(() => {
      const moved = focusedElement(doc);
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
