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
