/** The focused element in the document or shadow root that holds `el`. */
export function activeIn(el: Element): Element | null {
  const node = el.getRootNode();
  return node instanceof Document || node instanceof ShadowRoot ? node.activeElement : null;
}
