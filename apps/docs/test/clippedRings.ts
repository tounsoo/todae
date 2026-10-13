const TABBABLE = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

/** The outline a focused control shows: on itself, or on a close ancestor that rings it, such as a Field shell. */
function ringOf(el: HTMLElement): { ringed: HTMLElement; box: DOMRect; room: number } | null {
  let target: HTMLElement | null = el;
  for (let depth = 0; target && depth < 4; depth++, target = target.parentElement) {
    const style = getComputedStyle(target);
    const width = style.outlineStyle === 'none' ? 0 : Number.parseFloat(style.outlineWidth) || 0;
    if (width > 0) {
      const room = width + (Number.parseFloat(style.outlineOffset) || 0);
      return room > 0 ? { ringed: target, box: target.getBoundingClientRect(), room } : null;
    }
  }
  return null;
}

/**
 * Focuses each tabbable control under `root` as a keyboard would and lists
 * every ring that a scroll or clip container cuts: a container whose overflow
 * is not visible, on an edge the ring crosses while the control itself is
 * inside that edge. A control the container has scrolled out of view does not
 * count. The ring can sit on an ancestor wider than the control, such as a
 * Field shell, so whether the control is in view is judged by its own box.
 */
export function clippedRings(root: ParentNode = document): string[] {
  const cut: string[] = [];
  const name = (el: Element) =>
    `${el.tagName.toLowerCase()}${[...el.classList].map((c) => `.${c}`).join('')}`;
  for (const el of root.querySelectorAll<HTMLElement>(TABBABLE)) {
    if (el.closest('[inert]') || !el.checkVisibility({ visibilityProperty: true })) continue;
    el.focus({ focusVisible: true } as FocusOptions);
    if (document.activeElement !== el) continue;
    const ring = ringOf(el);
    if (ring && ring.box.width > 0 && ring.box.height > 0) {
      const { ringed, box, room } = ring;
      const own = el.getBoundingClientRect();
      // Only containers around the ringed element clip its outline.
      for (let c = ringed.parentElement; c && c !== document.documentElement; c = c.parentElement) {
        const style = getComputedStyle(c);
        if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
        const rect = c.getBoundingClientRect();
        const left = rect.left + c.clientLeft;
        const top = rect.top + c.clientTop;
        const right = left + c.clientWidth;
        const bottom = top + c.clientHeight;
        const edges: string[] = [];
        // Within half a pixel, for layouts that land on fractions.
        if (style.overflowX !== 'visible') {
          if (own.left >= left - 0.5 && box.left - room < left - 0.5) edges.push('left');
          if (own.right <= right + 0.5 && box.right + room > right + 0.5) edges.push('right');
        }
        if (style.overflowY !== 'visible') {
          if (own.top >= top - 0.5 && box.top - room < top - 0.5) edges.push('top');
          if (own.bottom <= bottom + 0.5 && box.bottom + room > bottom + 0.5) edges.push('bottom');
        }
        if (edges.length) cut.push(`${name(el)} in ${name(c)}: ${edges.join(', ')}`);
      }
    }
    el.blur();
  }
  return cut;
}
