import { useLayoutEffect } from 'react';

let locks = 0;
let prevOverflow = '';
let prevPadding = '';
let prevOverscroll = '';
let prevGutter = '';

export function useScrollLock(active: boolean): void {
  useLayoutEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    if (locks === 0) {
      prevOverflow = html.style.overflow;
      prevPadding = html.style.paddingRight;
      prevOverscroll = html.style.overscrollBehavior;
      prevGutter = html.style.scrollbarGutter;
      const gap = window.innerWidth - html.clientWidth;
      html.style.overflow = 'hidden';
      html.style.overscrollBehavior = 'none';
      html.style.scrollbarGutter = 'stable';
      if (gap > 0) html.style.paddingRight = `${gap}px`;
    }
    locks += 1;
    return () => {
      locks -= 1;
      if (locks === 0) {
        html.style.overflow = prevOverflow;
        html.style.paddingRight = prevPadding;
        html.style.overscrollBehavior = prevOverscroll;
        html.style.scrollbarGutter = prevGutter;
      }
    };
  }, [active]);
}
