/** The focused element in the document or shadow root that holds `el`. */
export function activeIn(el: Element): Element | null {
  const node = el.getRootNode() as Document | ShadowRoot;
  // By node type, not instanceof, which fails for an iframe's or a popup window's nodes.
  const holdsFocus = node.nodeType === 9 || (node.nodeType === 11 && 'host' in node);
  return holdsFocus ? node.activeElement : null;
}

/** The focused element, looking into shadow roots. */
function deepActive(doc: Document): Element | null {
  let active = doc.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

/** Whether focus is lost: on nothing, the body, or an element no longer in the page. */
export function focusLost(doc: Document): boolean {
  const active = deepActive(doc);
  return !active || !active.isConnected || active === doc.body;
}
