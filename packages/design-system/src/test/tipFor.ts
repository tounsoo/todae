/**
 * The tooltip anchored to `trigger`, found by the anchor name they share. A
 * Button's own tip is hidden from screen readers and joins no
 * aria-describedby, so that link can't find it. For browser tests.
 */
export function tipFor(trigger: HTMLElement): HTMLElement | null {
  const names = trigger.style
    .getPropertyValue('anchor-name')
    .split(',')
    .map((name) => name.trim());
  for (const tip of document.querySelectorAll<HTMLElement>('[role="tooltip"]')) {
    const name = tip.style.getPropertyValue('--todae-tooltip-anchor');
    if (name && names.includes(name)) return tip;
  }
  return null;
}
