// Not instanceof: a node from an iframe or a popup window fails it against
// this window's classes, so these read the node itself.

export function isNode(node: unknown): node is Node {
  return typeof node === 'object' && node !== null && typeof (node as Node).nodeType === 'number';
}

export function isElement(node: unknown): node is Element {
  return typeof node === 'object' && node !== null && (node as Node).nodeType === 1;
}

export function isHTMLElement(node: unknown): node is HTMLElement {
  return isElement(node) && node.namespaceURI === 'http://www.w3.org/1999/xhtml';
}

/**
 * Where focus is in `doc`'s window and the same-origin frames around and in it:
 * the top document's active element, then each focused frame's, inside out
 * last. A window keeps its active element when focus moves to a frame or to
 * the page around it, so a document's own `activeElement` can be stale. A
 * frame showing no HTML element with focus, such as an SVG document, ends the
 * path at the frame.
 */
export function focusPath(doc: Document): Element[] {
  let top = doc;
  for (let host = top.defaultView?.frameElement; host; host = top.defaultView?.frameElement) top = host.ownerDocument;
  const path: Element[] = [];
  for (let el: Element | null | undefined = top.activeElement; el; ) {
    path.push(el);
    if (el.localName !== 'iframe' && el.localName !== 'frame') break;
    const inner: Element | null | undefined = (el as HTMLIFrameElement).contentDocument?.activeElement;
    el = isHTMLElement(inner) ? inner : null;
  }
  return path;
}
