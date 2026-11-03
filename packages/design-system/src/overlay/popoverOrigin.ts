/**
 * Points `popover`'s transform origin at the corner of `anchor` it opened
 * from, so its open scale grows out of its trigger: the bottom when it sits
 * above the anchor, and the edge it lines up with. Physical, as
 * `transform-origin` is. Call it once the popover shows; a scale already
 * under way shrinks it toward its own box, which keeps both comparisons.
 */
export function aimPopoverOrigin(popover: HTMLElement, anchor: Element): void {
  const p = popover.getBoundingClientRect();
  const a = anchor.getBoundingClientRect();
  const y = p.top + p.bottom < a.top + a.bottom ? 'bottom' : 'top';
  const x = Math.abs(p.right - a.right) < Math.abs(p.left - a.left) ? 'right' : 'left';
  popover.style.setProperty('--_origin', `${x} ${y}`);
}
