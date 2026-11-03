/**
 * Points `popover`'s transform origin at the corner of `anchor` it opened
 * from, so its open scale grows out of its trigger: the bottom when it sits
 * above the anchor, and the edge it lines up with. Physical, as
 * `transform-origin` is. Call it once the popover shows; a scale already
 * under way shrinks it toward its own box, which keeps both comparisons.
 */
export function aimPopoverOrigin(popover: HTMLElement, anchor: Element): void {
  const p = popover.getBoundingClientRect();
  // A popover already gone, with no exit to show, has no box to aim.
  if (!p.width && !p.height) return;
  const a = anchor.getBoundingClientRect();
  const y = p.top + p.bottom < a.top + a.bottom ? 'bottom' : 'top';
  const x = Math.abs(p.right - a.right) < Math.abs(p.left - a.left) ? 'right' : 'left';
  popover.style.setProperty('--_origin', `${x} ${y}`);
}

/** The element whose own `anchor-name` list holds `name`, such as a word a list of suggestions sits by. */
export function anchorNamed(doc: Document, name: string): HTMLElement | null {
  if (!name) return null;
  for (const el of doc.querySelectorAll<HTMLElement>('[style*="anchor-name"]')) {
    if (el.style.getPropertyValue('anchor-name').split(',').some((part) => part.trim() === name)) return el;
  }
  return null;
}
