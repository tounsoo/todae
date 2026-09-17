const SELECTOR =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';

export function getTabbables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(SELECTOR)].filter((el) => {
    if (el.hasAttribute('disabled') || el.closest('[disabled]')) return false;
    if (el.hidden || el.closest('[hidden]')) return false;
    if (el.inert || el.closest('[inert]')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    if (el.style.display === 'none') return false;
    return true;
  });
}
