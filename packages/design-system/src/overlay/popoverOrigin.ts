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

/**
 * The element `popover` was placed by when it was placed by `name`, such as
 * a word a list of suggestions sits by: the last one in its tree whose own
 * inline `anchor-name` list holds `name`, as CSS picks the last. A name set
 * from a stylesheet is not found, and the popover keeps its default origin.
 */
export function anchorNamed(popover: Element, name: string): HTMLElement | null {
  if (!name) return null;
  const root = popover.getRootNode() as Document | ShadowRoot;
  if (!root.querySelectorAll) return null;
  const named = root.querySelectorAll<HTMLElement>('[style*="anchor-name"]');
  for (let i = named.length - 1; i >= 0; i--) {
    const el = named[i]!;
    if (el.style.getPropertyValue('anchor-name').split(',').some((part) => part.trim() === name)) return el;
  }
  return null;
}
