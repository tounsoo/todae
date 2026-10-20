// Every kind of element Tab could stop on.
const CANDIDATES = /* @__PURE__ */ [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(', ');

/**
 * Marks the element Toast.Region moves into an open modal. Its toasts are not
 * the modal's own content.
 */
export const TOAST_HOST_ATTRIBUTE = 'data-todae-toast-host';

/** Whether `el` sits in a toast host inside `root`, rather than being root's own content. */
export function inToastHostWithin(el: Element, root: Element): boolean {
  const host = el.closest(`[${TOAST_HOST_ATTRIBUTE}]`);
  return Boolean(host && host !== root && root.contains(host));
}

// Whether Tab would stop on `el`, one of root's CANDIDATES, were it enabled
// and shown: not taken out by a negative tabindex, and not inside a `hidden`
// or `aria-hidden` subtree within root. Both subtrees count as removed content
// on purpose; one around root is the page's business, not root's. Styles and
// `disabled` are not read.
function inTabOrder(el: HTMLElement, root: HTMLElement): boolean {
  // Engines differ on the default tabIndex of some candidates, such as
  // contenteditable, so only a tabindex that is set takes one out.
  if (el.hasAttribute('tabindex')) {
    if (el.tabIndex < 0) return false;
  } else if (el.localName === 'summary') {
    // Only a <details>'s own summary, its first summary child, takes focus.
    const details = el.parentElement;
    if (details?.localName !== 'details' || details.querySelector(':scope > summary') !== el) return false;
  }
  const removed = el.closest('[hidden], [aria-hidden="true"]');
  return !removed || !root.contains(removed);
}

/**
 * Whether focus can move to `el` now: not inert, and not hidden by a
 * stylesheet, `visibility`, or a closed `<details>`. `visibility: hidden`
 * blocks focus too. Tabindex and `disabled` are not read.
 */
export function isReachable(el: HTMLElement): boolean {
  if (el.closest('[inert]')) return false;
  // Without checkVisibility, only an inline display:none is seen.
  return el.checkVisibility?.({ visibilityProperty: true }) ?? el.style.display !== 'none';
}

// Whether Tab stops on `el`, one of root's CANDIDATES, now.
function isTabStop(el: HTMLElement, root: HTMLElement): boolean {
  return inTabOrder(el, root) && !el.matches(':disabled') && isReachable(el);
}

// root's candidates in document order, less the toasts moved into it.
function* candidatesIn(root: HTMLElement): Generator<HTMLElement> {
  for (const el of root.querySelectorAll<HTMLElement>(CANDIDATES)) {
    if (!inToastHostWithin(el, root)) yield el;
  }
}

/**
 * The elements in `root` that Todae treats as tab stops now, in document
 * order: the browser's tab order minus disabled, hidden, inert and
 * aria-hidden content.
 */
export function getTabbables(root: HTMLElement): HTMLElement[] {
  return [...candidatesIn(root)].filter((el) => isTabStop(el, root));
}

/**
 * The elements in `root` that Tab stops on or would once shown, disabled ones
 * too, in document order. For a question about what content holds rather than
 * what Tab reaches this moment, such as whether a closed panel holds a button.
 */
export function getTabOrder(root: HTMLElement): HTMLElement[] {
  return [...candidatesIn(root)].filter((el) => inTabOrder(el, root));
}

/**
 * The first element in `root` that Todae treats as a tab stop now, as
 * getTabbables does, and `accept` takes. It
 * stops at the first match, and runs `accept` before the costlier checks.
 */
export function firstTabbable(root: HTMLElement, accept?: (el: HTMLElement) => boolean): HTMLElement | null {
  for (const el of candidatesIn(root)) {
    if ((!accept || accept(el)) && isTabStop(el, root)) return el;
  }
  return null;
}
