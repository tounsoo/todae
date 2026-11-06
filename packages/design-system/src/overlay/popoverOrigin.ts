/**
 * Points `popover`'s transform origin at the corner of `anchor` it opened
 * from, so its open scale grows out of its trigger: the bottom when it sits
 * above the anchor, and the edge it lines up with. Physical, as
 * `transform-origin` is. Call it once the popover shows. It compares the box
 * the popover lays out in, with any scale under way taken back out: scaled
 * toward its default left top origin, a right-aligned popover about as wide
 * as its trigger would measure closer on the left and grow from the wrong
 * side, in right-to-left text above all.
 */
export function aimPopoverOrigin(popover: HTMLElement, anchor: Element): void {
  const p = unscaledBox(popover);
  // A popover already gone, with no exit to show, has no box to aim.
  if (!p) return;
  const a = anchor.getBoundingClientRect();
  const y = p.top + p.bottom < a.top + a.bottom ? 'bottom' : 'top';
  const x = Math.abs(p.right - a.right) < Math.abs(p.left - a.left) ? 'right' : 'left';
  popover.style.setProperty('--_origin', `${x} ${y}`);
}

/**
 * `el`'s border box in the viewport before its `scale`: the rendered box
 * grown back about its transform origin, whose computed value is in pixels
 * from the box's own corner. Null when it has no box.
 */
function unscaledBox(el: HTMLElement): { top: number; right: number; bottom: number; left: number } | null {
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  const style = getComputedStyle(el);
  const [sx = 1, sy = sx] = style.scale === 'none' ? [] : style.scale.split(' ').map(Number);
  const [ox = 0, oy = 0] = style.transformOrigin.split(' ').map(parseFloat);
  // A scale it can't read or undo leaves the box as drawn.
  if (![sx, sy, ox, oy].every(Number.isFinite) || !sx || !sy) return r;
  const left = r.left - ox * (1 - sx);
  const top = r.top - oy * (1 - sy);
  return { top, right: left + r.width / sx, bottom: top + r.height / sy, left };
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
