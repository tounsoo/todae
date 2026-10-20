/**
 * Every element Tab could stop on, before the checks that it is enabled,
 * shown and not taken out of the order by a negative tabindex.
 */
export const TABBABLE_CANDIDATES = /* @__PURE__ */ [
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

/** Whether Tab stops on `el`, one of `root`'s TABBABLE_CANDIDATES, rather than on a toast moved into `root`. */
export function isTabbable(el: HTMLElement, root: HTMLElement): boolean {
  // Engines differ on the default tabIndex of some candidates, such as
  // contenteditable, so only a tabindex that is set takes one out.
  if (el.hasAttribute('tabindex') && el.tabIndex < 0) return false;
  if (el.closest('[disabled], [hidden]')) return false;
  if (el.closest('[inert]')) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  if (inToastHostWithin(el, root)) return false;
  // Hidden by a stylesheet, visibility, or a closed <details>. The costliest
  // check, so last. Without checkVisibility, only an inline display:none is seen.
  return el.checkVisibility?.({ visibilityProperty: true }) ?? el.style.display !== 'none';
}

/** The elements in `root` that Tab stops on, in document order. */
export function getTabbables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(TABBABLE_CANDIDATES)].filter((el) => isTabbable(el, root));
}
