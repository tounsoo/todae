// Keeps a focus ring whole inside the scroll container that holds it. Chrome
// scrolls a focused control into view only when part of its own box is
// hidden, so a control that just fits keeps a ring cut by the edge, and a ring
// drawn on an ancestor wider than the control, such as a Field shell, is
// never considered at all.

let quiet = 0;

/**
 * Focuses `el` without scrolling, the way `focus({ preventScroll: true })`
 * does, and tells `revealRing` to leave it where it is. Todae moves focus this
 * way when the move must not scroll, such as roving focus in a toolbar.
 */
export function focusWithoutScroll(el: HTMLElement) {
  quiet++;
  try {
    el.focus({ preventScroll: true });
  } finally {
    quiet--;
  }
}

/** The element that draws the ring around `target`: itself, or the nearest ancestor below `area` with an outline. */
function ringOf(area: Element, target: Element): { ringed: Element; room: number } {
  for (let el: Element | null = target; el && el !== area; el = el.parentElement) {
    const style = getComputedStyle(el);
    const width = style.outlineStyle === 'none' ? 0 : Number.parseFloat(style.outlineWidth) || 0;
    if (width > 0) return { ringed: el, room: width + (Number.parseFloat(style.outlineOffset) || 0) };
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
  const dy =
    box.top - pad('Top') < portTop
      ? box.top - pad('Top') - portTop
      : box.bottom + pad('Bottom') > portBottom
        ? box.bottom + pad('Bottom') - portBottom
        : 0;
  const dx =
    box.left - pad('Left') < portLeft
      ? box.left - pad('Left') - portLeft
      : box.right + pad('Right') > portRight
        ? box.right + pad('Right') - portRight
        : 0;
  if (dx || dy) area.scrollBy({ left: dx, top: dy, behavior: 'instant' });
}
