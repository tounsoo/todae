import { useLayoutEffect, type RefObject } from 'react';

export function isPopoverOpen(el: HTMLElement): boolean {
  return el.matches(':popover-open') || el.hasAttribute('data-popover-open');
}

export function usePopoverSync(contentRef: RefObject<HTMLElement | null>, open: boolean): void {
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (!open) {
      if (isPopoverOpen(el)) el.hidePopover();
      return;
    }
    if (!isPopoverOpen(el)) el.showPopover();
  }, [contentRef, open]);
}
