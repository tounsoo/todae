/**
 * Scrolls `area` so the ring around `target` is inside it. Focus scrolls a
 * control into view only when part of its box is hidden, so one that just fits
 * would keep a cut ring. The ring can be on an ancestor, such as a Field shell.
 */
export function revealRing(area: HTMLElement, target: Element) {
  let ringed = target;
  let ring = 0;
  for (let el: Element | null = target; el && el !== area; el = el.parentElement) {
    const style = getComputedStyle(el);
    const width = style.outlineStyle === 'none' ? 0 : Number.parseFloat(style.outlineWidth) || 0;
    if (width > 0) {
      ringed = el;
      ring = width + (Number.parseFloat(style.outlineOffset) || 0);
      break;
    }
  }
  const room = Math.max(ring, Number.parseFloat(getComputedStyle(area).scrollPaddingTop) || 0);
  const box = ringed.getBoundingClientRect();
  const port = area.getBoundingClientRect();
  const top = port.top + area.clientTop;
  const left = port.left + area.clientLeft;
  const dy =
    box.top - room < top ? box.top - room - top : box.bottom + room > top + area.clientHeight ? box.bottom + room - top - area.clientHeight : 0;
  const dx =
    box.left - room < left ? box.left - room - left : box.right + room > left + area.clientWidth ? box.right + room - left - area.clientWidth : 0;
  if (dx || dy) area.scrollBy({ left: dx, top: dy, behavior: 'instant' });
}
