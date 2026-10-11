/**
 * Scrolls `area` so the ring around `target` is inside it. Focus scrolls a
 * control into view only when part of its box is hidden, and only as far as
 * its box, so one that just fits, or one inside a Field shell, would keep a
 * cut ring. Call it from a focus handler: the browser's own scroll has run.
 *
 * It only finishes what the browser started. A control still partly hidden was
 * focused with `preventScroll`, and one in the top layer, such as a menu item,
 * is not clipped by `area`: both are left alone.
 */
export function revealRing(area: HTMLElement, target: Element) {
  const port = area.getBoundingClientRect();
  const top = port.top + area.clientTop;
  const left = port.left + area.clientLeft;
  const bottom = top + area.clientHeight;
  const right = left + area.clientWidth;
  const own = target.getBoundingClientRect();
  if (own.top < top - 0.5 || own.bottom > bottom + 0.5 || own.left < left - 0.5 || own.right > right + 0.5) return;
  let ringed = target;
  let ring = 0;
  for (let el: Element | null = target; el && el !== area; el = el.parentElement) {
    if (el.matches(':popover-open, dialog:modal')) return;
    const style = getComputedStyle(el);
    const width = style.outlineStyle === 'none' ? 0 : Number.parseFloat(style.outlineWidth) || 0;
    if (ring === 0 && width > 0) {
      ringed = el;
      ring = width + (Number.parseFloat(style.outlineOffset) || 0);
    }
  }
  const room = Math.max(ring, Number.parseFloat(getComputedStyle(area).scrollPaddingTop) || 0);
  const box = ringed.getBoundingClientRect();
  const dy = box.top - room < top ? box.top - room - top : box.bottom + room > bottom ? box.bottom + room - bottom : 0;
  const dx = box.left - room < left ? box.left - room - left : box.right + room > right ? box.right + room - right : 0;
  if (dx || dy) area.scrollBy({ left: dx, top: dy, behavior: 'instant' });
}
