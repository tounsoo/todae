import { useLayoutEffect, type RefObject } from 'react';

export function isPopoverOpen(el: HTMLElement): boolean {
  return el.matches(':popover-open') || el.hasAttribute('data-popover-open');
}

// The popovers React holds open, so a layer shown again can show them again
// in front of it.
const held = new WeakSet<HTMLElement>();

export function usePopoverSync(contentRef: RefObject<HTMLElement | null>, open: boolean): void {
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (!open) {
      if (isPopoverOpen(el)) el.hidePopover();
      return;
    }
    if (!isPopoverOpen(el)) el.showPopover();
    held.add(el);
    return () => {
      held.delete(el);
    };
  }, [contentRef, open]);
}

/**
 * Shows every popover React holds open inside `layer` again, in DOM order,
 * so each is back in front of `layer` after it was shown again or moved.
 * Showing a layer again puts it in front of the popovers open inside it,
 * which then can't use their anchor; moving a popover hides it without a
 * toggle event. Focus inside one stays where it was.
 */
export function reshowHeldInside(layer: HTMLElement): void {
  const doc = layer.ownerDocument;
  const active = doc.activeElement;
  for (const el of layer.querySelectorAll<HTMLElement>('[popover]')) {
    if (!held.has(el) || !el.isConnected) continue;
    if (isPopoverOpen(el)) el.hidePopover();
    el.showPopover();
  }
  if (active instanceof HTMLElement && active !== doc.activeElement && layer.contains(active)) {
    active.focus({ preventScroll: true });
  }
}
