const SELECTOR =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';

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

export function getTabbables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(SELECTOR)].filter((el) => {
    if (el.hasAttribute('disabled') || el.closest('[disabled]')) return false;
    if (el.hidden || el.closest('[hidden]')) return false;
    if (el.inert || el.closest('[inert]')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    if (el.style.display === 'none') return false;
    if (inToastHostWithin(el, root)) return false;
    return true;
  });
}
