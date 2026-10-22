// Brings a focus ring whole into view in the scroll container that holds it
// when focus lands. The browser scrolls a focused control into view by its
// own box, so a ring drawn on another element, such as a Field shell around
// the control or a Checkbox indicator beside it, can stay cut at the edge.

let quiet = 0;

/**
 * Focuses `el` without scrolling, the way `focus({ preventScroll: true })`
 * does, and tells `revealRing` to leave it where it is. Todae moves focus this
 * way when the move must not scroll, such as Toolbar's Tab hop to the edge of a
 * run.
 */
export function focusWithoutScroll(el: HTMLElement) {
  quiet++;
  try {
    el.focus({ preventScroll: true });
  } finally {
    quiet--;
  }
}

/** Room an outline takes past `el`'s box, or null when it draws none. */
function outlineRoom(el: Element): number | null {
  const style = getComputedStyle(el);
  const width = style.outlineStyle === 'none' ? 0 : Number.parseFloat(style.outlineWidth) || 0;
  return width > 0 ? width + (Number.parseFloat(style.outlineOffset) || 0) : null;
}

/**
 * The element that draws the ring around `target`. A Todae part that draws it
 * on a child or sibling of the focused element, such as a Checkbox indicator,
 * or inside one, such as a Field.OneTimeCode box, marks that element
 * `data-todae-focus-ring`; otherwise it is the target or
 * the nearest ancestor below `area` with an outline, such as a Field shell.
 */
function ringOf(area: Element, target: Element): { ringed: Element; room: number } {
  // Marked rings first: a visually hidden input keeps the browser's own outline.
  for (const el of [...target.children, ...(target.parentElement?.children ?? [])]) {
    for (const marked of [el, ...el.querySelectorAll('[data-todae-focus-ring]')]) {
      if (!marked.hasAttribute('data-todae-focus-ring')) continue;
      const room = outlineRoom(marked);
      if (room !== null) return { ringed: marked, room };
    }
  }
  for (let el: Element | null = target; el && el !== area; el = el.parentElement) {
    const room = outlineRoom(el);
    if (room !== null) return { ringed: el, room };
  }
  return { ringed: target, room: 0 };
}

/**
 * Scrolls `area` so the focus ring around `target` is inside it, for a focus
 * event that bubbles to `area`. It leaves the area alone when the focus shows
 * no ring (`:focus-visible` does not match), when Todae moved focus with
 * `focusWithoutScroll`, and when the target sits in a popover or modal dialog
 * inside the area, which the top layer draws outside it.
 */
export function revealRing(area: HTMLElement, target: EventTarget | null) {
  if (quiet > 0 || !(target instanceof Element) || target === area || !area.contains(target)) return;
  // Nothing to scroll, so nothing to measure.
  if (area.scrollHeight <= area.clientHeight && area.scrollWidth <= area.clientWidth) return;
  if (!target.matches(':focus-visible')) return;
  const top = target.closest(':popover-open, dialog:modal');
  if (top && top !== area && area.contains(top)) return;

  const { ringed, room } = ringOf(area, target);
  const style = getComputedStyle(area);
  const pad = (side: 'Top' | 'Right' | 'Bottom' | 'Left') =>
    Math.max(room, Number.parseFloat(style[`scrollPadding${side}`]) || 0);
  const box = ringed.getBoundingClientRect();
  const port = area.getBoundingClientRect();
  const portTop = port.top + area.clientTop;
  const portLeft = port.left + area.clientLeft;
  const portBottom = portTop + area.clientHeight;
  const portRight = portLeft + area.clientWidth;
  // Like Chrome, leave an axis alone when the box and its ring can't fit, so a
  // tall list or panel keeps the part in view instead of jumping to an edge.
  const fitsY = box.height + pad('Top') + pad('Bottom') <= area.clientHeight;
  const fitsX = box.width + pad('Left') + pad('Right') <= area.clientWidth;
  const dy = !fitsY
    ? 0
    : box.top - pad('Top') < portTop
      ? box.top - pad('Top') - portTop
      : box.bottom + pad('Bottom') > portBottom
        ? box.bottom + pad('Bottom') - portBottom
        : 0;
  const dx = !fitsX
    ? 0
    : box.left - pad('Left') < portLeft
      ? box.left - pad('Left') - portLeft
      : box.right + pad('Right') > portRight
        ? box.right + pad('Right') - portRight
        : 0;
  if (dx || dy) area.scrollBy({ left: dx, top: dy, behavior: 'instant' });
}
