/**
 * The tooltip anchored to `trigger`, found by the anchor name they share. A
 * Button's own tip is hidden from screen readers and joins no
 * aria-describedby, so that link can't find it. For browser tests.
 */
export function tipFor(trigger: HTMLElement): HTMLElement | null {
  const name = trigger.style.getPropertyValue('--todae-tooltip-anchor');
  if (!name) return null;
  for (const tip of document.querySelectorAll<HTMLElement>('[role="tooltip"]')) {
    if (tip.style.getPropertyValue('--todae-tooltip-anchor') === name) return tip;
  }
  return null;
}
